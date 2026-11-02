from datetime import timedelta

from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import MonthPlan, Task, Quote
from .serializers import (
    MonthPlanSerializer, MonthProgressSerializer, TaskSerializer, QuoteSerializer, )
from .filters import TaskFilter, TaskOrderingFilter
from . import services
from api.permissions import IsOwner


CalendarSerializer = inline_serializer('MonthCalendar', {
    'id': serializers.IntegerField(),
    'year': serializers.IntegerField(),
    'month': serializers.IntegerField(),
    'days': inline_serializer('CalendarDay', {
        'date': serializers.DateField(),
        'total': serializers.IntegerField(),
        'done': serializers.IntegerField(),
    }, many=True),
})


class MonthPlanViewSet(viewsets.ModelViewSet):
    # real data comes from get_queryset(); this only tells Swagger the model
    queryset = MonthPlan.objects.none()
    serializer_class = MonthPlanSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_fields = ["year", "month"]
    search_fields = ["title", "main_goal"]
    ordering_fields = ["year", "month"]

    def get_queryset(self):
        return services.with_progress(
            MonthPlan.objects.filter(user=self.request.user))

    def list(self, request, *args, **kwargs):
        # months that have ended get their final bouquet before being shown
        services.lock_finished_months(user=request.user)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @extend_schema(responses=CalendarSerializer)
    @action(detail=True, methods=["get"])
    def calendar(self, request, pk=None):
        """Number of tasks (and finished tasks) for every day of the month."""
        plan = self.get_object()
        days = (
            plan.tasks.values("date")
            .annotate(total=Count("id"), done=Count("id", filter=Q(is_done=True)))
            .order_by("date")
        )
        return Response({
            "id": plan.id, "year": plan.year, "month": plan.month,
            "days": list(days),
        })

    @extend_schema(responses=MonthProgressSerializer)
    @action(detail=True, methods=["get"])
    def garden(self, request, pk=None):
        """Completion percent and flower stage of the month."""
        return Response(services.month_progress(self.get_object()))


class TaskViewSet(viewsets.ModelViewSet):
    # real data comes from get_queryset(); this only tells Swagger the model
    queryset = Task.objects.none()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filter_backends = [DjangoFilterBackend, SearchFilter, TaskOrderingFilter]
    filterset_class = TaskFilter
    search_fields = ["title"]
    ordering_fields = ["date", "created_at", "priority"]
    ordering = ["date", "-priority_rank", "created_at"]

    def get_queryset(self):
        return (
            Task.objects.filter(user=self.request.user)
            .select_related("month_plan", "subject")
            # numeric priority so that sorting goes low < mid < high
            .annotate(priority_rank=Case(
                When(priority="low", then=Value(1)),
                When(priority="mid", then=Value(2)),
                When(priority="high", then=Value(3)),
                default=Value(2), output_field=IntegerField(),
            ))
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @extend_schema(request=None, responses=TaskSerializer)
    @action(detail=True, methods=["post"])
    def toggle(self, request, pk=None):
        """Mark the task as done, or as not done if it was already done."""
        task = self.get_object()
        task.is_done = not task.is_done
        task.save(update_fields=["is_done"])  # done_at is updated in Task.save()
        return Response(self.get_serializer(task).data)

    @extend_schema(request=None, responses=TaskSerializer)
    @action(detail=True, methods=["post"], url_path="move-tomorrow")
    def move_tomorrow(self, request, pk=None):
        """Move an unfinished task one day forward (overdue tasks go to tomorrow)."""
        task = self.get_object()
        if task.is_done:
            return Response(
                {"detail": "Выполненную задачу переносить не нужно."},
                status=status.HTTP_400_BAD_REQUEST)
        new_date = max(task.date, timezone.localdate()) + timedelta(days=1)
        serializer = self.get_serializer(task, data={"date": new_date}, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(responses=TaskSerializer(many=True))
    @action(detail=False, methods=["get"])
    def today(self, request):
        """All of today's tasks (not paginated)."""
        tasks = self.filter_queryset(self.get_queryset()).filter(date=timezone.localdate())
        return Response(self.get_serializer(tasks, many=True).data)


class QuoteViewSet(viewsets.ReadOnlyModelViewSet):
    """Quotes are a shared reference list: everyone can read, only admins edit (in Django Admin)."""
    serializer_class = QuoteSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        return Quote.objects.order_by('id')

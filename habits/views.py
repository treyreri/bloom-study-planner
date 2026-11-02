import calendar
from datetime import date

from django.db.models import Exists, OuterRef, Prefetch
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import django_filters

from .models import Habit, HabitCheck
from .serializers import HabitSerializer, HabitCheckSerializer, HabitCheckToggleSerializer
from .services import current_streak
from api.permissions import IsOwner


CheckResultSerializer = inline_serializer('HabitCheckResult', {
    'habit': serializers.IntegerField(),
    'date': serializers.DateField(),
    'checked': serializers.BooleanField(),
    'streak': serializers.IntegerField(),
})
StreakSerializer = inline_serializer('HabitStreak', {
    'habit': serializers.IntegerField(),
    'streak': serializers.IntegerField(),
})


class HabitViewSet(viewsets.ModelViewSet):
    # real data comes from get_queryset(); this only tells Swagger the model
    queryset = Habit.objects.none()
    serializer_class = HabitSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_fields = ["is_active"]
    search_fields = ["title"]

    def get_queryset(self):
        checked_today = HabitCheck.objects.filter(
            habit=OuterRef('pk'), date=timezone.localdate())
        return (Habit.objects.filter(user=self.request.user)
                .annotate(checked_today=Exists(checked_today)))

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @extend_schema(request=HabitCheckToggleSerializer, responses=CheckResultSerializer)
    @action(detail=True, methods=["post"])
    def check(self, request, pk=None):
        """Check the habit for a day (today by default). Calling it again removes the check."""
        habit = self.get_object()
        body = HabitCheckToggleSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        check_date = body.validated_data.get('date', timezone.localdate())

        habit_check, created = HabitCheck.objects.get_or_create(habit=habit, date=check_date)
        if not created:
            habit_check.delete()
        return Response({
            'habit': habit.id,
            'date': check_date,
            'checked': created,
            'streak': current_streak(habit),
        })

    @extend_schema(responses=StreakSerializer)
    @action(detail=True, methods=["get"])
    def streak(self, request, pk=None):
        """Current number of days in a row."""
        habit = self.get_object()
        return Response({'habit': habit.id, 'streak': current_streak(habit)})

    @extend_schema(
        parameters=[
            OpenApiParameter('year', int, description='Default: current year'),
            OpenApiParameter('month', int, description='Default: current month'),
        ],
        responses=inline_serializer('HabitGrid', {
            'year': serializers.IntegerField(),
            'month': serializers.IntegerField(),
            'days_in_month': serializers.IntegerField(),
            'habits': inline_serializer('HabitGridRow', {
                'id': serializers.IntegerField(),
                'title': serializers.CharField(),
                'emoji': serializers.CharField(),
                'is_active': serializers.BooleanField(),
                'streak': serializers.IntegerField(),
                'checked_dates': serializers.ListField(child=serializers.DateField()),
            }, many=True),
        }),
    )
    @action(detail=False, methods=["get"])
    def grid(self, request):
        """All habits with their checked days in one month (for the habit tracker grid)."""
        today = timezone.localdate()
        try:
            year = int(request.query_params.get('year', today.year))
            month = int(request.query_params.get('month', today.month))
            first_day = date(year, month, 1)
        except ValueError:
            raise ValidationError({'detail': 'Неверный год или месяц.'})
        days_in_month = calendar.monthrange(year, month)[1]
        last_day = date(year, month, days_in_month)

        month_checks = HabitCheck.objects.filter(date__range=(first_day, last_day))
        habits = self.get_queryset().prefetch_related(
            Prefetch('checks', queryset=month_checks, to_attr='month_checks'))
        return Response({
            'year': year,
            'month': month,
            'days_in_month': days_in_month,
            'habits': [
                {
                    'id': habit.id,
                    'title': habit.title,
                    'emoji': habit.emoji,
                    'is_active': habit.is_active,
                    'streak': current_streak(habit),
                    'checked_dates': sorted(check.date for check in habit.month_checks),
                }
                for habit in habits
            ],
        })


class HabitCheckFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name='date', lookup_expr='lte')

    class Meta:
        model = HabitCheck
        fields = ['habit', 'date']


class HabitCheckViewSet(mixins.CreateModelMixin,
                        mixins.RetrieveModelMixin,
                        mixins.DestroyModelMixin,
                        mixins.ListModelMixin,
                        viewsets.GenericViewSet):
    """Individual habit checks. A check is created or deleted, never edited."""
    # real data comes from get_queryset(); this only tells Swagger the model
    queryset = HabitCheck.objects.none()
    serializer_class = HabitCheckSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_class = HabitCheckFilter

    def get_queryset(self):
        return HabitCheck.objects.filter( habit__user=self.request.user ).select_related('habit')

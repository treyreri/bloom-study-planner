from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Subject, Deadline, ScheduleSlot
from .serializers import (
    SubjectSerializer, DeadlineSerializer, ScheduleSlotSerializer, )
from api.permissions import IsOwner

UPCOMING_LIMIT = 3


class SubjectViewSet(viewsets.ModelViewSet):
    # real data comes from get_queryset(); this only tells Swagger the model
    queryset = Subject.objects.none()
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_fields = ["name", "color"]
    search_fields = ["name", "teacher", "room"]
    ordering_fields = ["name"]
    def get_queryset(self):
        return Subject.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DeadlineViewSet(viewsets.ModelViewSet):
    # real data comes from get_queryset(); this only tells Swagger the model
    queryset = Deadline.objects.none()
    serializer_class = DeadlineSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_fields = ["kind", "due_date", "subject"]
    search_fields = ["title"]
    ordering_fields = ["due_date", "title"]
    ordering = ["due_date"]
    def get_queryset(self):
        return Deadline.objects.filter(
            user=self.request.user ).select_related('subject')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @extend_schema(responses=DeadlineSerializer(many=True))
    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        """The next 3 deadlines from today, with the number of days left."""
        deadlines = self.get_queryset().filter(
            due_date__gte=timezone.localdate()).order_by("due_date")[:UPCOMING_LIMIT]
        return Response(self.get_serializer(deadlines, many=True).data)


class ScheduleSlotViewSet(viewsets.ModelViewSet):
    # real data comes from get_queryset(); this only tells Swagger the model
    queryset = ScheduleSlot.objects.none()
    serializer_class = ScheduleSlotSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_fields = ["weekday", "subject"]
    ordering_fields = ["weekday", "start_time"]

    def get_queryset(self):
        return ScheduleSlot.objects.filter(
            user=self.request.user ).select_related('subject')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

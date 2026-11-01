from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Subject, Deadline, ScheduleSlot
from .serializers import (
    SubjectSerializer, DeadlineSerializer, ScheduleSlotSerializer, )
from api.permissions import IsOwner


class SubjectViewSet(viewsets.ModelViewSet):
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    def get_queryset(self):
        return Subject.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DeadlineViewSet(viewsets.ModelViewSet):
    serializer_class = DeadlineSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    def get_queryset(self):
        return Deadline.objects.filter(
            user=self.request.user ).select_related('subject')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ScheduleSlotViewSet(viewsets.ModelViewSet):
    serializer_class = ScheduleSlotSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        return ScheduleSlot.objects.filter(
            user=self.request.user ).select_related('subject')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import MonthPlan, Task, Quote
from .serializers import (
    MonthPlanSerializer, TaskSerializer, QuoteSerializer, )
from api.permissions import IsOwner


class MonthPlanViewSet(viewsets.ModelViewSet):
    serializer_class = MonthPlanSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_fields = ['year', 'month']
    search_fields = ['title', 'main_goal']
    ordering_fields = ['year', 'month']
    def get_queryset(self):
        return MonthPlan.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_fields = ['date', 'priority', 'is_done', 'month_plan']
    search_fields = ['title', 'description']
    ordering_fields = ['date', 'created_at', 'priority']

    def get_queryset(self):
        return Task.objects.filter(
            user=self.request.user ).select_related('month_plan', 'subject')
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class QuoteViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = QuoteSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        return Quote.objects.all()

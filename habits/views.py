from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Habit, HabitCheck
from .serializers import HabitSerializer, HabitCheckSerializer
from api.permissions import IsOwner


class HabitViewSet(viewsets.ModelViewSet):
    serializer_class = HabitSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    def get_queryset(self):
        return Habit.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class HabitCheckViewSet(viewsets.ModelViewSet):
    serializer_class = HabitCheckSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        return HabitCheck.objects.filter( habit__user=self.request.user ).select_related('habit')

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import PomodoroSession
from .serializers import PomodoroSessionSerializer
from api.permissions import IsOwner


class PomodoroSessionViewSet(viewsets.ModelViewSet):
    serializer_class = PomodoroSessionSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        return PomodoroSession.objects.filter(
            user=self.request.user ).select_related('subject')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import WeeklyReflection
from .serializers import WeeklyReflectionSerializer
from api.permissions import IsOwner


class WeeklyReflectionViewSet(viewsets.ModelViewSet):
    serializer_class = WeeklyReflectionSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    def get_queryset(self):
        return WeeklyReflection.objects.filter(
            user=self.request.user )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

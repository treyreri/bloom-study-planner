from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import WeeklyReflection
from .serializers import WeeklyReflectionSerializer
from api.permissions import IsOwner


class WeeklyReflectionViewSet(viewsets.ModelViewSet):
    # real data comes from get_queryset(); this only tells Swagger the model
    queryset = WeeklyReflection.objects.none()
    serializer_class = WeeklyReflectionSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_fields = ["week_start", "mood"]
    ordering_fields = ["week_start"]
    def get_queryset(self):
        return WeeklyReflection.objects.filter(
            user=self.request.user )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

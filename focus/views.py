from datetime import timedelta

from django.db.models import Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PomodoroSession
from .serializers import PomodoroSessionSerializer
from api.permissions import IsOwner

PERIODS = ('week', 'month')


def period_bounds(period, today):
    """First and last day of the current calendar week (Mon–Sun) or month."""
    if period == 'week':
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)
    start = today.replace(day=1)
    next_month = (start + timedelta(days=32)).replace(day=1)
    return start, next_month - timedelta(days=1)


class PomodoroSessionViewSet(viewsets.ModelViewSet):
    # real data comes from get_queryset(); this only tells Swagger the model
    queryset = PomodoroSession.objects.none()
    serializer_class = PomodoroSessionSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_fields = ["subject"]
    ordering_fields = ["started_at", "duration_min"]

    def get_queryset(self):
        return PomodoroSession.objects.filter(
            user=self.request.user ).select_related('subject')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @extend_schema(
        parameters=[OpenApiParameter('period', str, enum=PERIODS, description='Default: week')],
        responses=inline_serializer('PomodoroStats', {
            'period': serializers.CharField(),
            'start': serializers.DateField(),
            'end': serializers.DateField(),
            'total_minutes': serializers.IntegerField(),
            'sessions': serializers.IntegerField(),
            'by_subject': inline_serializer('PomodoroSubjectStats', {
                'subject': serializers.IntegerField(allow_null=True),
                'name': serializers.CharField(),
                'color': serializers.CharField(),
                'minutes': serializers.IntegerField(),
            }, many=True),
            'by_day': inline_serializer('PomodoroDayStats', {
                'date': serializers.DateField(),
                'minutes': serializers.IntegerField(),
            }, many=True),
        }),
    )
    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Focus minutes per subject and per day for the current week or month."""
        period = request.query_params.get('period', 'week')
        if period not in PERIODS:
            raise ValidationError({'period': f'Допустимые значения: {", ".join(PERIODS)}.'})
        start, end = period_bounds(period, timezone.localdate())
        sessions = self.get_queryset().filter(started_at__date__range=(start, end))

        by_subject = (
            sessions.values('subject', 'subject__name', 'subject__color')
            .annotate(minutes=Sum('duration_min'))
            .order_by('-minutes')
        )
        by_day = (
            sessions.annotate(day=TruncDate('started_at'))
            .values('day')
            .annotate(minutes=Sum('duration_min'))
            .order_by('day')
        )
        return Response({
            'period': period,
            'start': start,
            'end': end,
            'total_minutes': sessions.aggregate(total=Sum('duration_min'))['total'] or 0,
            'sessions': sessions.count(),
            'by_subject': [
                {
                    'subject': row['subject'],
                    'name': row['subject__name'] or 'Без предмета',
                    'color': row['subject__color'] or '#F48FA0',
                    'minutes': row['minutes'],
                }
                for row in by_subject
            ],
            'by_day': [{'date': row['day'], 'minutes': row['minutes']} for row in by_day],
        })

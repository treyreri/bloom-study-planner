from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers
from .models import PomodoroSession

MAX_DURATION_MIN = 180  # one focus session is at most 3 hours


class PomodoroSessionSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True, default=None)
    subject_color = serializers.CharField(source='subject.color', read_only=True, default=None)
    started_at = serializers.DateTimeField(required=False)

    class Meta:
        model = PomodoroSession
        fields = [
            'id', 'subject', 'subject_name', 'subject_color',
            'started_at', 'duration_min', ]
        read_only_fields = ['id']

    def validate_subject(self, subject):
        if subject is None:
            return subject
        request = self.context.get('request')

        if request and subject.user_id != request.user.id:
            raise serializers.ValidationError(
                'Нельзя использовать чужой предмет.' )
        return subject

    def validate_duration_min(self, minutes):
        if not 1 <= minutes <= MAX_DURATION_MIN:
            raise serializers.ValidationError(
                f'Длительность — от 1 до {MAX_DURATION_MIN} минут.')
        return minutes

    def validate_started_at(self, started_at):
        # a small allowance for the browser clock being slightly ahead
        if started_at > timezone.now() + timedelta(minutes=5):
            raise serializers.ValidationError('Сессия не может начинаться в будущем.')
        return started_at

    def create(self, validated_data):
        # without started_at the session is treated as just finished
        validated_data.setdefault(
            'started_at', timezone.now() - timedelta(minutes=validated_data['duration_min']))
        return super().create(validated_data)

from rest_framework import serializers
from .models import PomodoroSession


class PomodoroSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PomodoroSession
        fields = [
            'id', 'subject',
            'started_at', 'duration_min', ]
        read_only_fields = ['id']

    def validate_subject(self, subject):
        if subject is None:
            return subject
        request = self.context.get('request')

        if request and subject.user_id != request.user.id:
            raise serializers.ValidationError(
                'You cannot use another user\'s subject.' )
        return subject

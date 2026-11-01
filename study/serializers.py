from rest_framework import serializers
from .models import Subject, Deadline, ScheduleSlot


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = [
            'id', 'name', 'color', 'teacher', 'room', ]
        read_only_fields = ['id']


class DeadlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deadline
        fields = [
            'id', 'subject', 'title', 'kind', 'due_date', ]
        read_only_fields = ['id']

    def validate_subject(self, subject):
        request = self.context.get('request')

        if request and subject.user_id != request.user.id:
            raise serializers.ValidationError(
                'You cannot use another user\'s subject.' )
        return subject


class ScheduleSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleSlot
        fields = [
            'id', 'subject',
            'weekday', 'start_time', 'end_time', ]
        read_only_fields = ['id']

    def validate_subject(self, subject):
        request = self.context.get('request')

        if request and subject.user_id != request.user.id:
            raise serializers.ValidationError(
                'You cannot use another user\'s subject.' )
        return subject

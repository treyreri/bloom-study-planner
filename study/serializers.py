import re

from django.utils import timezone
from rest_framework import serializers
from .models import Subject, Deadline, ScheduleSlot

HEX_COLOR = re.compile(r'^#[0-9A-Fa-f]{6}$')


class OwnSubjectMixin:
    """Shared check: a record may only point to the current user's subject."""

    def validate_subject(self, subject):
        request = self.context.get('request')
        if subject is not None and request and subject.user_id != request.user.id:
            raise serializers.ValidationError(
                'Нельзя использовать чужой предмет.' )
        return subject


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = [
            'id', 'name', 'color', 'teacher', 'room', ]
        read_only_fields = ['id']

    def validate_color(self, color):
        if not HEX_COLOR.match(color):
            raise serializers.ValidationError('Укажите цвет в формате #FF0080.')
        return color.upper()

    def validate_name(self, name):
        name = name.strip()
        others = Subject.objects.filter(user=self.context['request'].user, name__iexact=name)
        if self.instance:
            others = others.exclude(pk=self.instance.pk)
        if others.exists():
            raise serializers.ValidationError('Предмет с таким названием уже есть.')
        return name


class DeadlineSerializer(OwnSubjectMixin, serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_color = serializers.CharField(source='subject.color', read_only=True)
    days_left = serializers.SerializerMethodField()

    class Meta:
        model = Deadline
        fields = [
            'id', 'subject', 'subject_name', 'subject_color',
            'title', 'kind', 'due_date', 'days_left', ]
        read_only_fields = ['id']

    def get_days_left(self, deadline) -> int:
        """Negative when the deadline has already passed."""
        return (deadline.due_date - timezone.localdate()).days


class ScheduleSlotSerializer(OwnSubjectMixin, serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_color = serializers.CharField(source='subject.color', read_only=True)
    subject_room = serializers.CharField(source='subject.room', read_only=True)

    class Meta:
        model = ScheduleSlot
        fields = [
            'id', 'subject', 'subject_name', 'subject_color', 'subject_room',
            'weekday', 'start_time', 'end_time', ]
        read_only_fields = ['id']

    def validate(self, attrs):
        start = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        end = attrs.get('end_time', getattr(self.instance, 'end_time', None))
        if start and end and start >= end:
            raise serializers.ValidationError(
                {'end_time': 'Пара должна заканчиваться позже, чем начинается.'})
        return attrs

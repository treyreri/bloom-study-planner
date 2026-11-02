from django.utils import timezone
from rest_framework import serializers
from .models import Habit, HabitCheck


def validate_not_in_future(check_date):
    if check_date > timezone.localdate():
        raise serializers.ValidationError('Нельзя отметить привычку на будущий день.')
    return check_date


class HabitSerializer(serializers.ModelSerializer):
    checked_today = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Habit
        fields = [
            'id', 'title',
            'emoji', 'is_active', 'checked_today', ]
        read_only_fields = ['id']

    def validate_title(self, title):
        title = title.strip()
        if not title:
            raise serializers.ValidationError('Укажите название привычки.')
        return title


class HabitCheckSerializer(serializers.ModelSerializer):
    """
    The (habit, date) UniqueConstraint on the model makes DRF reject
    a second check of the same habit on the same day with a 400 error.
    """
    class Meta:
        model = HabitCheck
        fields = [
            'id', 'habit', 'date', ]
        read_only_fields = ['id']

    def validate_habit(self, habit):
        request = self.context.get('request')
        if request and habit.user_id != request.user.id:
            raise serializers.ValidationError( 'Нельзя отметить чужую привычку.' )
        return habit

    def validate_date(self, check_date):
        return validate_not_in_future(check_date)


class HabitCheckToggleSerializer(serializers.Serializer):
    """Body of POST /habits/{id}/check/ — the date is optional (default: today)."""
    date = serializers.DateField(required=False, validators=[validate_not_in_future])

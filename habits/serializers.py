from rest_framework import serializers
from .models import Habit, HabitCheck


class HabitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Habit
        fields = [
            'id', 'title',
            'emoji', 'is_active', ]
        read_only_fields = ['id']

    def validate(self, attrs):
        habit = attrs.get(
            "habit", self.instance.habit if self.instance else None )
        check_date = attrs.get(
            "date", self.instance.date if self.instance else None)

        if habit and check_date:
            existing = habit.checks.filter(date=check_date)

            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)

            if existing.exists():
                raise serializers.ValidationError(
                    "Эта привычка уже отмечена за эту дату" )
        return attrs


class HabitCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = HabitCheck
        fields = [
            'id', 'habit', 'date', ]
        read_only_fields = ['id']

    def validate_habit(self, habit):
        request = self.context.get('request')
        if request and habit.user_id != request.user.id:
            raise serializers.ValidationError( 'You cannot check another user\'s habit.' )
        return habit

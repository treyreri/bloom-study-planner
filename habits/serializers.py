from rest_framework import serializers
from .models import Habit, HabitCheck


class HabitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Habit
        fields = [
            'id', 'title',
            'emoji', 'is_active', ]
        read_only_fields = ['id']


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

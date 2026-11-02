from rest_framework import serializers
from .models import WeeklyReflection


class WeeklyReflectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyReflection
        fields = [
            'id', 'week_start', 'mood',
            'proud_of', 'failed', 'carry_over', ]
        read_only_fields = ['id']

    def validate_week_start(self, week_start):
        # one reflection per calendar week, and a week starts on Monday
        if week_start.weekday() != 0:
            raise serializers.ValidationError('Неделя должна начинаться с понедельника.')
        others = WeeklyReflection.objects.filter(
            user=self.context['request'].user, week_start=week_start)
        if self.instance:
            others = others.exclude(pk=self.instance.pk)
        if others.exists():
            raise serializers.ValidationError('Рефлексия за эту неделю уже есть.')
        return week_start

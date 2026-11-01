from rest_framework import serializers
from .models import WeeklyReflection


class WeeklyReflectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyReflection
        fields = [
            'id', 'week_start', 'mood',
            'proud_of', 'failed', 'carry_over', ]
        read_only_fields = ['id']

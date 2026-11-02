from rest_framework import serializers
from .models import MonthPlan, Task, Quote
from django.utils import timezone

class MonthPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonthPlan
        fields = [
            'id', 'year', 'month', 'title',
            'main_goal', 'focus_goals', 'final_stage',]
        read_only_fields = ['id']


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            'id', 'month_plan', 'subject',
            'title', 'description', 'date', 'priority',
            'is_done', 'done_at', 'created_at', ]
        read_only_fields = ['id', 'done_at', 'created_at']

    def update(self, instance, validated_data):
        is_done = validated_data.get(
            "is_done", instance.is_done )

        if is_done and not instance.is_done:
            instance.done_at = timezone.now()

        elif not is_done:
            instance.done_at = None
        return super().update(instance, validated_data)

    def validate(self, attrs):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            month_plan = attrs.get(
             'month_plan', getattr(self.instance, 'month_plan', None) )
            subject = attrs.get(
             'subject', getattr(self.instance, 'subject', None))

            if month_plan and month_plan.user_id != request.user.id:
                raise serializers.ValidationError(
                    'You cannot use another user\'s month plan.' )
            if subject and subject.user_id != request.user.id:
                raise serializers.ValidationError(
                    'You cannot use another user\'s subject.' )
        return attrs


class QuoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quote
        fields = ['id', 'text', 'author']
        read_only_fields = ['id']

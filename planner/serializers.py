from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from .models import MonthPlan, Task, Quote
from . import services

MAX_FOCUS_GOALS = 3


class MonthProgressSerializer(serializers.Serializer):
    """Shape of services.month_progress(): used for the docs and the garden action."""
    total = serializers.IntegerField()
    done = serializers.IntegerField()
    percent = serializers.IntegerField()
    stage = serializers.ChoiceField(choices=MonthPlan.FLOWER_STAGE_CHOICES)
    emoji = serializers.CharField()
    is_final = serializers.BooleanField()


class MonthPlanSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()
    is_finished = serializers.SerializerMethodField()

    class Meta:
        model = MonthPlan
        fields = [
            'id', 'year', 'month', 'title',
            'main_goal', 'focus_goals', 'final_stage',
            'progress', 'is_finished', ]
        # final_stage is set by the server when the month ends
        read_only_fields = ['id', 'final_stage']

    @extend_schema_field(MonthProgressSerializer)
    def get_progress(self, plan):
        return services.month_progress(plan)

    def get_is_finished(self, plan) -> bool:
        return services.is_month_finished(plan.year, plan.month)

    def validate_month(self, month):
        if not 1 <= month <= 12:
            raise serializers.ValidationError('Месяц должен быть от 1 до 12.')
        return month

    def validate_year(self, year):
        if not 2000 <= year <= 2100:
            raise serializers.ValidationError('Год должен быть от 2000 до 2100.')
        return year

    def validate_focus_goals(self, goals):
        if not isinstance(goals, list) or not all(isinstance(goal, str) for goal in goals):
            raise serializers.ValidationError('Фокус-цели должны быть списком строк.')
        goals = [goal.strip() for goal in goals if goal.strip()]
        if len(goals) > MAX_FOCUS_GOALS:
            raise serializers.ValidationError(f'Не больше {MAX_FOCUS_GOALS} фокус-целей.')
        if any(len(goal) > 200 for goal in goals):
            raise serializers.ValidationError('Каждая фокус-цель — не длиннее 200 символов.')
        return goals

    def validate(self, attrs):
        if self.instance:
            # tasks belong to the month by their date, so the month itself is fixed
            for field in ('year', 'month'):
                if field in attrs and attrs[field] != getattr(self.instance, field):
                    raise serializers.ValidationError(
                        {field: 'Месяц существующего плана менять нельзя.'})
            return attrs

        user = self.context['request'].user
        if MonthPlan.objects.filter(
                user=user, year=attrs['year'], month=attrs['month']).exists():
            raise serializers.ValidationError(
                'План на этот месяц уже есть.')
        return attrs


class TaskSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True, default=None)
    subject_color = serializers.CharField(source='subject.color', read_only=True, default=None)

    class Meta:
        model = Task
        fields = [
            'id', 'month_plan', 'subject', 'subject_name', 'subject_color',
            'title', 'description', 'date', 'priority',
            'is_done', 'done_at', 'created_at', ]
        read_only_fields = ['id', 'done_at', 'created_at']
        # month_plan may be omitted: the plan of the task's month is used
        extra_kwargs = {'month_plan': {'required': False}}

    def validate(self, attrs):
        user = self.context['request'].user
        month_plan = attrs.get('month_plan')
        subject = attrs.get('subject')

        if month_plan and month_plan.user_id != user.id:
            raise serializers.ValidationError(
                {'month_plan': 'Нельзя использовать чужой план месяца.'})
        if subject and subject.user_id != user.id:
            raise serializers.ValidationError(
                {'subject': 'Нельзя использовать чужой предмет.'})

        task_date = attrs.get('date') or getattr(self.instance, 'date', None)
        if month_plan and task_date and (
                (task_date.year, task_date.month) != (month_plan.year, month_plan.month)):
            raise serializers.ValidationError(
                {'date': 'Дата задачи должна быть внутри месяца её плана.'})
        return attrs

    def create(self, validated_data):
        if not validated_data.get('month_plan'):
            validated_data['month_plan'] = services.get_or_create_month_plan(
                validated_data['user'], validated_data['date'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # moving the task to another month moves it to that month's plan
        if 'date' in validated_data and 'month_plan' not in validated_data:
            validated_data['month_plan'] = services.get_or_create_month_plan(
                instance.user, validated_data['date'])
        return super().update(instance, validated_data)


class QuoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quote
        fields = ['id', 'text', 'author']
        read_only_fields = ['id']

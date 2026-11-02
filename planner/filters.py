import django_filters
from django.utils import timezone
from rest_framework.filters import OrderingFilter

from .models import Task


class TaskFilter(django_filters.FilterSet):
    """?date=, ?date_from=&date_to= (a week), ?overdue=true, ?subject=, ?priority=, ?is_done="""
    date_from = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name='date', lookup_expr='lte')
    overdue = django_filters.BooleanFilter(method='filter_overdue')

    class Meta:
        model = Task
        fields = ['date', 'subject', 'priority', 'is_done', 'month_plan']

    def filter_overdue(self, queryset, name, value):
        overdue = {'date__lt': timezone.localdate(), 'is_done': False}
        return queryset.filter(**overdue) if value else queryset.exclude(**overdue)


class TaskOrderingFilter(OrderingFilter):
    """?ordering=priority sorts low → mid → high by the numeric priority_rank."""

    def get_ordering(self, request, queryset, view):
        ordering = super().get_ordering(request, queryset, view)
        if not ordering:
            return ordering
        rename = {'priority': 'priority_rank', '-priority': '-priority_rank'}
        return [rename.get(field, field) for field in ordering]

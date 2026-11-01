from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsOwner(BasePermission):
    """
    Allow users to access only their own objects.
    """
    def has_object_permission(self, request, view, obj):
        # read-only requests are also restricted to the owner.
        if hasattr(obj, 'user'):
            return obj.user == request.user
        # models without a direct user field.
        if hasattr(obj, 'habit'):
            return obj.habit.user == request.user
        return False

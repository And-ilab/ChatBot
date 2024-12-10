from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from chat_dashboard.models import User

class CustomAuthBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        try:
            user = User.objects.get(username=username)
            if not user.is_active:
                return None  # Возвращаем None, если пользователь не активен
            if user.check_password(password):
                return user
        except User.DoesNotExist:
            return None
from django.utils import timezone
from .models import User

class UpdateLastActivityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            user = request.user
            user.last_active = timezone.now()
            user.is_online = True
            user.save()  # Обновляем данные о пользователе

        response = self.get_response(request)

        return response
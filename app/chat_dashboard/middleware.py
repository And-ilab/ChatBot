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

class NoCacheMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response


class ResetSessionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.session.flush()
        response = self.get_response(request)
        for cookie in request.COOKIES:
            response.delete_cookie(cookie)
        return response

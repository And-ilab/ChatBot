from functools import wraps
from django.http import HttpResponseForbidden
import jwt
from django.conf import settings

def role_required(required_role):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            token = request.session.get('token')  # Получение токена из сессии
            if token:
                try:
                    # Декодирование токена
                    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                    user_role = payload.get('role')

                    # Проверка роли
                    if user_role == required_role:
                        return view_func(request, *args, **kwargs)

                except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                    return HttpResponseForbidden("Недействительный токен.")

            return HttpResponseForbidden("Доступ запрещен.")  # Если токен отсутствует или роль не соответствует
        return _wrapped_view
    return decorator
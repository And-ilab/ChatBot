from functools import wraps
from django.http import HttpResponseForbidden
from django.shortcuts import redirect
from django.contrib import messages
import jwt
from config import config_settings

def role_required(required_roles):
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
                    if user_role in required_roles:  # Проверяем, находится ли роль в списке разрешенных
                        return view_func(request, *args, **kwargs)
                    else:
                        messages.error(request, "Недостаточно прав для доступа к данной странице.")  # Сообщение о недостаточности прав
                        return HttpResponseForbidden("Недостаточно прав.")  # Или можно вернуть 403

                except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                    return redirect('authentication:login')  # Перенаправление на страницу логина

            return redirect('authentication:login')  # Перенаправление на страницу логина, если токен отсутствует
        return _wrapped_view
    return decorator
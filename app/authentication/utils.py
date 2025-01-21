import jwt
from config import config_settings
from django.shortcuts import redirect
from django.utils import timezone
from datetime import timedelta
from django.contrib import messages

def generate_jwt(user):
    payload = {
        'user_id': user.id,
        'role': user.role,  # Добавляем роль пользователя
        'exp': timezone.now() + timedelta(days=1),
        'iat': timezone.now()
    }
    return jwt.encode(payload, config_settings.SECRET_KEY, algorithm='HS256')


def decode_jwt(token):
    try:
        payload = jwt.decode(token, config_settings.SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None  # Токен истек
    except jwt.InvalidTokenError:
        return None  # Неверный токен


def get_role_by_token(token):
    try:
        payload = jwt.decode(token, config_settings.SECRET_KEY, algorithms=['HS256'])
        role = payload.get('role')
        return role
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        #messages.error(request, 'Ошибка при обработке токена.')
        return redirect('authentication/login')  # Перенаправление на страницу входа
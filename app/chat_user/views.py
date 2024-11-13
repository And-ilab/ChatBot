from django.shortcuts import render
from chat_dashboard.models import Dialog, Message
from chat_dashboard.views import get_messages
import jwt
from django.conf import settings


def user_chat(request):
    token = request.session.get('token')  # Получение токена из сессии
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user_id = payload.get('user_id')

            dialog, created = Dialog.objects.get_or_create(user_id=user_id)
            print(dialog.id, user_id)

            context = {
                'dialog_id': dialog.id,
                'user_id': user_id,
            }

            return render(request, 'user_chat/user_chat.html', context)

        except jwt.ExpiredSignatureError:
            return render(request, 'authentication/login.html', {'error': 'Токен истек.'})
        except jwt.InvalidTokenError:
            return render(request, 'authentication/login.html', {'error': 'Недействительный токен.'})

    return render(request, 'authentication/login.html', {'error': 'Необходимо войти в систему.'})

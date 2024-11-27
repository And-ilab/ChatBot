from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Count
from django.db.models.functions import TruncDate
from chat_dashboard.models import User, Message
from chat_training.models import TrainingMessage

def user_activity_data(request):
    # Агрегируем количество пользователей по дате последнего входа
    data = (
        User.objects.filter(last_login__isnull=False)  # Исключаем пользователей без логинов
        .annotate(login_date=TruncDate('last_login'))  # Трункуем дату
        .values('login_date')  # Группируем по дате
        .annotate(count=Count('id'))  # Считаем количество пользователей
        .order_by('login_date')  # Сортируем по дате
    )
    return JsonResponse(list(data), safe=False)

def messages_count_data(request):
    data = (
        Message.objects.annotate(message_date=TruncDate('created_at'))  # Трункуем дату создания
        .values('message_date', 'sender_type')  # Группируем по дате и типу отправителя
        .annotate(count=Count('id'))  # Считаем количество сообщений
        .order_by('message_date', 'sender_type')  # Сортируем по дате и типу отправителя
    )
    # Преобразуем данные в нужный формат
    formatted_data = {}
    for entry in data:
        date = entry['message_date']
        sender_type = entry['sender_type']
        count = entry['count']
        if date not in formatted_data:
            formatted_data[date] = {'user': 0, 'bot': 0}
        formatted_data[date][sender_type] = count

    # Преобразуем в список для фронтенда
    response_data = [
        {
            'date': date,
            'user': values['user'],
            'bot': values['bot']
        }
        for date, values in formatted_data.items()
    ]

    return JsonResponse(response_data, safe=False)

def daily_messages_data(request):
    data = (
        TrainingMessage.objects
        .annotate(date=TruncDate('created_at'))  # Группируем по дате
        .values('date')                         # Получаем только дату
        .annotate(count=Count('id'))            # Считаем количество сообщений
        .order_by('date')                       # Упорядочиваем по дате
    )
    return JsonResponse(list(data), safe=False)


def analytics(request):
    return render(request, 'analytics/analytics.html')

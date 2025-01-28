import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Exists, OuterRef, Subquery, Value, Case, When, F, Count
from django.db.models.functions import TruncDate, Concat
from django.utils.timezone import now
from .models import Dialog, Message, User, TrainingMessage, Settings
from chat_user.models import ChatUser, Session
from .forms import UserForm, UserFormUpdate
import json
import re
import spacy
import os
import pymorphy3
from config import config_settings
from django.conf import settings
import requests
from django.db.models import Q
from django.contrib import messages
from django.utils import timezone
from datetime import timedelta
import time

logger = logging.getLogger('chat_dashboard')


# @role_required(['admin', 'operator'])
def analytics(request):
    """Displays the analytics page."""
    logger.info("Accessing analytics page.")
    return render(request, 'chat_dashboard/analytics.html')


def user_activity_data(request):
    """Returns user login activity data."""
    logger.info("Fetching user activity data.")
    data = (
        User.objects.filter(last_login__isnull=False)
        .annotate(login_date=TruncDate('last_login'))
        .values('login_date')
        .annotate(count=Count('id'))
        .order_by('login_date')
    )
    logger.debug(f"User activity data retrieved: {list(data)}")
    return JsonResponse(list(data), safe=False)


@csrf_exempt
def send_message(request, dialog_id):
    """Sends a message in the specified dialog."""
    logger.info(f"Sending message to dialog ID: {dialog_id}")
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            content = data.get('content')
            sender_type = data.get('sender_type')
            sender_id = data.get('sender_id')
            timestamp = data.get('timestamp')
            message_type = data.get('message_type')

            logger.debug(
                f"Message data: content={content}, sender_type={sender_type}, sender_id={sender_id}, timestamp={timestamp}")

            if content and sender_type and timestamp and message_type:
                dialog = Dialog.objects.get(id=dialog_id)
                Message.objects.create(
                    dialog=dialog,
                    sender_type=sender_type,
                    sender_id=sender_id if sender_type == 'user' else None,
                    message_type=message_type,
                    content=content,
                    created_at=timestamp
                )
                logger.info("Message sent successfully.")
                return JsonResponse({'status': 'success', 'message': 'Message sent'})
            logger.warning("Invalid data: content or sender_type is missing.")
            return JsonResponse({'status': 'error', 'message': 'Invalid data'}, status=400)
        except Exception as e:
            logger.exception("An error occurred while sending a message.")
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

    logger.warning("Invalid method: only POST is supported.")
    return JsonResponse({'status': 'error', 'message': 'Invalid method'}, status=405)


def messages_count_data(request):
    """Returns message counts grouped by date and sender type."""
    logger.info("Fetching messages count data.")
    data = (
        Message.objects.annotate(message_date=TruncDate('created_at'))
        .values('message_date', 'sender_type')
        .annotate(count=Count('id'))
        .order_by('message_date', 'sender_type')
    )

    formatted_data = {}
    for entry in data:
        date = entry['message_date']
        sender_type = entry['sender_type']
        count = entry['count']
        if date not in formatted_data:
            formatted_data[date] = {'user': 0, 'bot': 0}
        formatted_data[date][sender_type] = count

    response_data = [
        {'date': date, 'user': values['user'], 'bot': values['bot']}
        for date, values in formatted_data.items()
    ]
    logger.debug(f"Formatted message count data: {response_data}")
    return JsonResponse(response_data, safe=False)


def daily_messages_data(request):
    """Returns daily training messages count."""
    logger.info("Fetching daily messages data.")
    data = (
        TrainingMessage.objects
        .annotate(date=TruncDate('created_at'))
        .values('date')
        .annotate(count=Count('id'))
        .order_by('date')
    )
    logger.debug(f"Daily messages data retrieved: {list(data)}")
    return JsonResponse(list(data), safe=False)


nlp = spacy.load("ru_core_news_sm")
morph = pymorphy3.MorphAnalyzer()
custom_stop_words = {"может", "могут", "какой", "какая", "какое", "какие", "что", "кто", "где", "когда", "зачем",
                     "почему"}


# @role_required(['admin', 'operator'])
def training_dashboard(request):
    """Displays the training dashboard."""
    logger.info("Accessing training dashboard.")
    unread_messages = TrainingMessage.objects.filter(is_unread=True, is_ignored=False).values(
        'id', 'content', 'created_at'
    )
    ignored_messages = TrainingMessage.objects.filter(is_ignored=True).values(
        'id', 'content', 'created_at'
    )

    context = {
        'all_messages': list(unread_messages) + list(ignored_messages),
        'unread_messages': list(unread_messages),
        'ignored_messages': list(ignored_messages),
    }
    logger.debug(f"Unread messages: {list(unread_messages)}, Ignored messages: {list(ignored_messages)}")
    return render(request, 'chat_dashboard/training.html', context)


def train_message(request, message_id):
    """Displays a message for training."""
    logger.info(f"Accessing training page for message ID: {message_id}")
    message = get_object_or_404(TrainingMessage, id=message_id)
    logger.debug(f"Training message retrieved: {message.content}")
    return render(request, 'chat_dashboard/train_message.html', {'message': message})


def toggle_ignore_message(request, message_id):
    """Toggle the ignored status of a training message."""
    logger.info(f"Toggling ignore status for message ID: {message_id}")
    try:
        message = TrainingMessage.objects.get(id=message_id)
        message.is_unread = not message.is_unread
        message.is_ignored = not message.is_ignored
        message.save()

        unread_count = TrainingMessage.objects.filter(is_unread=True, is_ignored=False).count()
        ignored_count = TrainingMessage.objects.filter(is_ignored=True).count()

        logger.info(f"Message {message_id} updated: unread={message.is_unread}, ignored={message.is_ignored}")
        return JsonResponse({
            'unread_count': unread_count,
            'ignored_count': ignored_count,
            'message_id': message.id,
            'is_unread': message.is_unread,
            'is_ignored': message.is_ignored,
        })
    except TrainingMessage.DoesNotExist:
        logger.error(f"Message ID {message_id} not found.")
        return JsonResponse({'error': 'Message not found'}, status=404)


def delete_message(request, message_id):
    """Deletes a training message."""
    logger.info(f"Attempting to delete message ID: {message_id}")
    try:
        message = TrainingMessage.objects.get(id=message_id)
        message.delete()

        unread_count = TrainingMessage.objects.filter(is_ignored=False).count()
        ignored_count = TrainingMessage.objects.filter(is_ignored=True).count()

        logger.info(f"Message ID {message_id} deleted successfully.")
        return JsonResponse({
            'unread_count': unread_count,
            'ignored_count': ignored_count
        })

    except TrainingMessage.DoesNotExist:
        logger.error(f"Message ID {message_id} not found for deletion.")
        return JsonResponse({'error': 'Message not found'}, status=404)


def extract_keywords(question):
    """Extracts keywords from a given question."""
    logger.info("Extracting keywords from question.")
    keywords = re.findall(r'\b\w+-\w+\b', question)
    question_cleaned = re.sub(r'\b\w+-\w+\b', '', question)
    doc = nlp(question_cleaned)

    for token in doc:
        if token.text.lower() not in custom_stop_words:
            if token.pos_ == "VERB":
                keywords.append(token.text)
            elif token.pos_ == "ADJ" and not token.is_stop:
                adj = morph.parse(token.text)[0]
                adj_feminine = adj.inflect({"femn", "sing", "nomn"})
                if adj_feminine:
                    keywords.append(adj_feminine.word)
                else:
                    keywords.append(token.lemma_)
            elif token.is_alpha and not token.is_stop and token.text.lower() not in custom_stop_words:
                keywords.append(token.lemma_)

    unique_keywords = list(set(keywords))
    logger.debug(f"Extracted keywords: {unique_keywords}")
    return unique_keywords


@csrf_exempt
def extract_keywords_view(request):
    """API endpoint to extract keywords from a question."""
    if request.method == "POST":
        logger.info("Extracting keywords via POST request.")
        try:
            data = json.loads(request.body)
            question = data.get('question', '')

            if not question:
                logger.warning("No question provided.")
                return JsonResponse({'error': 'Question not provided'}, status=400)

            keywords = extract_keywords(question)
            logger.info(f"Keywords extracted: {keywords}")
            return JsonResponse({'keywords': keywords})
        except json.JSONDecodeError:
            logger.error("Invalid JSON format received.")
            return JsonResponse({'error': 'Invalid JSON format'}, status=400)
    logger.warning("Invalid method: only POST is supported.")
    return JsonResponse({'error': 'Invalid request method'}, status=405)


@csrf_exempt
def create_node(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            node_class = data.get('class')
            node_name = data.get('name')
            node_content = data.get('content')

            if not node_class or not node_name:
                return JsonResponse({'error': 'Missing required fields: class or name'}, status=400)

            logger.info(f"node class: {node_class}")
            if node_content:
                sql_command = f"CREATE VERTEX {node_class} SET name = '{node_name}', content = '{node_content}'"
            else:
                sql_command = f"CREATE VERTEX {node_class} SET name = '{node_name}'"

            headers = {'Content-Type': 'application/json'}
            json_data = {"command": sql_command}
            response = requests.post(config_settings.ORIENT_COMMAND_URL, headers=headers, json=json_data,
                                     auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS))

            if response.status_code == 200:
                logger.info(f"Node created successfully: {response.text}")
                try:
                    response_data = response.json()
                    return JsonResponse({'status': 'success', 'data': response_data['result']}, status=201)

                except ValueError as e:
                    logger.error(f"Error parsing JSON response: {e}")
                    return JsonResponse({'error': 'Failed to parse response'}, status=500)

            else:
                logger.error(f"Error fetching data: HTTP {response.status_code} - {response.text}")
                return JsonResponse({'error': f"Error {response.status_code}: {response.text}"},
                                    status=response.status_code)

        except Exception as e:
            logger.error(f"Error in creating node: {e}")
            return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def create_relation(request):
    """Creates a relation between two nodes."""
    if request.method == 'POST':
        logger.info("Creating a new relation between nodes.")
        try:
            data = json.loads(request.body)

            # relation_type = data.get('type').lower()
            start_node_id = data.get('start_node_id')
            end_node_id = data.get('end_node_id')

            if not start_node_id or not end_node_id:
                logger.warning("Missing required fields for relation creation.")
                return JsonResponse({'error': 'Missing required fields'}, status=400)

            command = f"CREATE EDGE Includes FROM {start_node_id} TO {end_node_id}"
            headers = {'Content-Type': 'application/json'}
            json_data = {"command": command}

            response = requests.post(config_settings.ORIENT_COMMAND_URL, headers=headers, json=json_data,
                                     auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS))

            logger.info(f"Relation created between nodes {start_node_id} and {end_node_id}.")
            return JsonResponse({'message': 'Relation successfully created'}, status=201)
        except Exception as e:
            logger.exception("An error occurred while creating a relation.")
            return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def delete_node(request):
    """Creates a relation between two nodes."""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            node_id_to_delete = data.get('node_id')

            if not node_id_to_delete:
                logger.warning("Missing required fields for relation creation.")
                return JsonResponse({'error': 'Missing required fields'}, status=400)

            command = f"DELETE VERTEX {node_id_to_delete}"
            headers = {'Content-Type': 'application/json'}
            json_data = {"command": command}

            response = requests.post(config_settings.ORIENT_COMMAND_URL, headers=headers, json=json_data,
                                     auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS))

            return JsonResponse({'message': 'Node successfully deleted'}, status=201)
        except Exception as e:
            logger.exception("An error occurred while creating a relation.")
            return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def get_nodes(request):
    """Retrieves all nodes."""
    if request.method == 'GET':
        logger.info("Fetching all nodes.")

        try:
            sql_command = f"SELECT * FROM V"
            headers = {'Content-Type': 'application/json'}
            json_data = {"command": sql_command}

            response = requests.post(config_settings.ORIENT_QUERY_URL, headers=headers, json=json_data,
                                     auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS))

            if response.status_code == 200:
                logger.info(f"Nodes get successfully: {response.text}")
                try:
                    response_data = response.json()
                    logger.info(f"Response JSON: {response_data}")
                    return JsonResponse({'status': 'success', 'data': response_data}, status=201)
                except ValueError as e:
                    logger.error(f"Error parsing JSON response: {e}")
                    return JsonResponse({'error': 'Failed to parse response'}, status=500)

            else:
                logger.error(f"Error fetching data: HTTP {response.status_code} - {response.text}")
                return JsonResponse({'error': f"Error {response.status_code}: {response.text}"},
                                    status=response.status_code)
        except Exception as e:
            logger.exception("An error occurred while fetching nodes.")
            return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def create_training_message(request):
    """Creates a new training message."""
    logger.info("Creating a new training message.")
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            sender_id = data.get('sender_id')
            content = data.get('content')

            if not content:
                logger.warning("Content field is missing.")
                return JsonResponse({'error': 'Field "content" is required.'}, status=400)

            sender = None
            if sender_id:
                logger.debug(f"Fetching user with ID: {sender_id}")
                try:
                    sender = ChatUser.objects.get(id=sender_id)
                except ChatUser.DoesNotExist:
                    logger.error(f"User with ID {sender_id} not found.")
                    return JsonResponse({'error': 'User not found.'}, status=404)

            training_message = TrainingMessage.objects.create(
                sender=sender,
                content=content
            )
            logger.info(f"Training message created with ID: {training_message.id}")
            return JsonResponse({
                'id': training_message.id,
                'sender': sender_id,
                'content': training_message.content,
                'created_at': training_message.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'is_ignored': training_message.is_ignored,
                'is_unread': training_message.is_unread
            }, status=201)

        except json.JSONDecodeError:
            logger.error("Invalid JSON format received.")
            return JsonResponse({'error': 'Invalid JSON format.'}, status=400)
        except Exception as e:
            logger.exception("An error occurred while creating a training message.")
            return JsonResponse({'error': str(e)}, status=500)

    logger.warning("Invalid method: only POST is supported.")
    return JsonResponse({'error': 'Method not supported. Use POST.'}, status=405)


# @role_required('admin')
def user_list(request):
    """Displays a list of users."""
    logger.info("Accessing user list.")

    search_query = request.GET.get('search', '')
    sort_column = request.GET.get('sort', 'username')  # По умолчанию сортировка по username

    users = User.objects.all()

    # Фильтрация по поисковому запросу
    if search_query:
        users = users.filter(
            Q(first_name__icontains=search_query) |
            Q(last_name__icontains=search_query) |
            Q(username__icontains=search_query) |
            Q(email__icontains=search_query)
        )

    # Сортировка
    if sort_column.startswith('-'):
        users = users.order_by(sort_column[1:]).reverse()
    else:
        users = users.order_by(sort_column)

    logger.debug(f"Users retrieved: {list(users)}")
    return render(request, 'chat_dashboard/users.html', {'users': users})


# @role_required('admin')
def user_create(request):
    """Creates a new user."""
    logger.info("Creating a new user.")
    form = UserForm(request.POST or None)

    if request.method == 'POST':
        email = request.POST.get('email')
        if User.objects.filter(email=email).exists():
            logger.error(f"Attempt to create user failed: Email already registered - {email}")
            # Возвращаем информацию о том, что email уже зарегистрирован
            return render(request, 'chat_dashboard/user_create_form.html', {
                'form': form,
                'email_exists': True,
                'email': email
            })

        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.is_active = True
            user.save()
            logger.info(f"User created: ID={user.id}, Username={user.username}, Email={user.email}")

            messages.success(request,
                             "Создана новая учетная запись. Данные для её активации направлены на указанный вами электронный адрес.")
            return redirect('chat_dashboard:user_list')  # Перенаправляем на список пользователей

    return render(request, 'chat_dashboard/user_create_form.html', {'form': form})


# @role_required('admin')
def user_update(request, pk):
    """Updates user data."""
    logger.info(f"Updating user with ID: {pk}")
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        form = UserFormUpdate(request.POST, instance=user)
        if form.is_valid():
            old_data = {
                'username': user.username,
                'email': user.email,
            }
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password']) if form.cleaned_data.get('password') else None
            user.save()

            changed_data = {
                'username': user.username,
                'email': user.email,
            }
            logger.info(f"User updated: ID={pk}, Changed Data: {old_data} -> {changed_data}")
            return redirect('chat_dashboard:user_list')
    else:
        form = UserFormUpdate(instance=user)
    return render(request, 'chat_dashboard/user_update_form.html', {'form': form})


# @role_required('admin')
def user_delete(request, pk):
    """Deletes a user."""
    logger.info(f"Attempting to delete user with ID: {pk}")
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        user.delete()
        logger.info(f"User deleted with ID: {pk}")
        return redirect('chat_dashboard:user_list')
    return render(request, 'chat_dashboard/user_delete_form.html', {'user': user})


def get_last_message_subquery(field):
    logger.debug("Creating a subquery for the last message.")
    return Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values(field)[:1]


# @role_required(['admin', 'operator'])
def archive(request):
    user = request.user
    logger.info(f"Accessing archive page by user {user}.")

    # Получение данных о диалогах с аннотацией последнего сообщения и его отправителя
    dialogs = Dialog.objects.annotate(
        has_messages=Exists(Message.objects.filter(dialog=OuterRef('pk'))),
        username=Concat(
            F('user__first_name'),
            Value(' '),
            F('user__last_name')
        ),
        last_message=Subquery(
            Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('content')[:1]
        ),
        last_message_timestamp=Subquery(
            Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('created_at')[:1]
        ),
        last_message_sender_id=Subquery(
            Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender_id')[:1]
        ),
        last_message_username=Case(
            When(last_message_sender_id=None, then=Value('Bot')),
            default=Subquery(
                Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender__first_name')[:1]
            )
        ),
    ).filter(has_messages=True).order_by('-last_message_timestamp')

    # Логирование для отладки
    logger.debug(f"Dialogs retrieved: {list(dialogs)}")

    return render(request, 'chat_dashboard/archive.html', {
        'dialogs': dialogs,
        'user': user,
    })


# @role_required(['admin', 'operator'])
def create_or_edit_content(request):
    return render(request, 'chat_dashboard/edit_content.html')


def filter_dialogs_by_date_range(request):
    user = request.user
    start_date = request.GET.get('start')
    end_date = request.GET.get('end')

    start = timezone.datetime.fromisoformat(start_date)
    end = timezone.datetime.fromisoformat(end_date)
    dialogs = Dialog.objects.annotate(
        has_messages=Exists(Message.objects.filter(dialog=OuterRef('pk'))),
        username=Concat(F('user__first_name'), Value(' '), F('user__last_name')),
        last_message=Subquery(
            Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('content')[:1]),
        last_message_timestamp=Subquery(
            Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('created_at')[:1]),
        last_message_sender_id=Subquery(
            Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender_id')[:1]),
        last_message_username=Case(
            When(last_message_sender_id=None, then=Value('Bot')),
            default=Subquery(
                Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender__first_name')[
                :1])
        ),
    ).filter(has_messages=True, last_message_timestamp__range=(start, end)).order_by('-last_message_timestamp')

    logger.debug(f"Filtered dialogs: {list(dialogs)}")

    # Возвращаем отфильтрованные диалоги в формате JSON
    dialogs_data = [
        {
            'id': dialog.id,
            'user': {
                'id': dialog.user.id,
                'username': dialog.user.username
            },
            'last_message': dialog.last_message,
            'last_message_timestamp': dialog.last_message_timestamp,
            'last_message_username': dialog.last_message_username
        }
        for dialog in dialogs
    ]

    return JsonResponse(dialogs_data, safe=False)


# @role_required(['admin', 'operator'])
def filter_dialogs(request, period):
    user = request.user
    logger.info(f"Filtering dialogs by user {user} with period {period}.")

    # Определяем дату для фильтрации
    now = timezone.now()

    if period == 0:
        # Если фильтруем все диалоги, то период не ограничиваем
        dialogs = Dialog.objects.annotate(
            has_messages=Exists(Message.objects.filter(dialog=OuterRef('pk'))),
            username=Concat(F('user__first_name'), Value(' '), F('user__last_name')),
            last_message=Subquery(
                Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('content')[:1]),
            last_message_timestamp=Subquery(
                Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('created_at')[:1]),
            last_message_sender_id=Subquery(
                Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender_id')[:1]),
            last_message_username=Case(
                When(last_message_sender_id=None, then=Value('Bot')),
                default=Subquery(
                    Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender__first_name')[
                    :1])
            ),
        ).filter(has_messages=True).order_by('-last_message_timestamp')
    else:
        # Если фильтруем по дате, создаем фильтрацию по времени
        time_filter = now - timedelta(days=period)
        dialogs = Dialog.objects.annotate(
            has_messages=Exists(Message.objects.filter(dialog=OuterRef('pk'))),
            username=Concat(F('user__first_name'), Value(' '), F('user__last_name')),
            last_message=Subquery(
                Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('content')[:1]),
            last_message_timestamp=Subquery(
                Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('created_at')[:1]),
            last_message_sender_id=Subquery(
                Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender_id')[:1]),
            last_message_username=Case(
                When(last_message_sender_id=None, then=Value('Bot')),
                default=Subquery(
                    Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender__first_name')[
                    :1])
            ),
        ).filter(has_messages=True, last_message_timestamp__gte=time_filter).order_by('-last_message_timestamp')

    # Логирование для отладки
    logger.debug(f"Filtered dialogs: {list(dialogs)}")

    # Возвращаем отфильтрованные диалоги в формате JSON
    dialogs_data = [
        {
            'id': dialog.id,
            'user': {
                'id': dialog.user.id,
                'username': dialog.user.username
            },
            'last_message': dialog.last_message,
            'last_message_timestamp': dialog.last_message_timestamp,
            'last_message_username': dialog.last_message_username
        }
        for dialog in dialogs
    ]

    return JsonResponse(dialogs_data, safe=False)


def filter_dialogs_by_id(request, user_id):
    user = request.user
    logger.info(f"Filtering dialogs by user {user} with user ID {user_id}.")

    dialogs = Dialog.objects.filter(user_id=user_id).annotate(
        has_messages=Exists(Message.objects.filter(dialog=OuterRef('pk'))),
        username=Concat(F('user__first_name'), Value(' '), F('user__last_name')),
        last_message=Subquery(
            Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('content')[:1]),
        last_message_timestamp=Subquery(
            Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('created_at')[:1]),
        last_message_sender_id=Subquery(
            Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender_id')[:1]),
        last_message_username=Case(
            When(last_message_sender_id=None, then=Value('Bot')),
            default=Subquery(
                Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender__first_name')[:1])
        ),
    ).filter(has_messages=True).order_by('-last_message_timestamp')

    # Возвращаем отфильтрованные диалоги в формате JSON
    dialogs_data = [
        {
            'id': dialog.id,
            'user': {
                'id': dialog.user.id,
                'username': dialog.user.username
            },
            'last_message': dialog.last_message,
            'last_message_timestamp': dialog.last_message_timestamp,
            'last_message_username': dialog.last_message_username
        }
        for dialog in dialogs
    ]

    return JsonResponse(dialogs_data, safe=False)


def get_messages(request, dialog_id):
    """Retrieves all messages in a dialog."""
    logger.info(f"Fetching messages for dialog ID: {dialog_id}")

    try:
        messages = Message.objects.filter(dialog_id=dialog_id).order_by('created_at')

        # Если сообщений нет
        if not messages:
            logger.error(f"No messages found for dialog ID {dialog_id}.")
            return JsonResponse({"status": "error", "message": "No messages found."}, status=404)

        logger.debug(f"Messages retrieved: {messages}")
        messages_data = [
            {
                'sender': (
                    f"{message.sender.first_name} {message.sender.last_name}".strip()
                    if message.sender and message.sender_type == 'user'
                    else 'bot'
                ),
                'message_type': message.message_type,
                'content': message.content,
                'timestamp': message.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
            for message in messages
        ]
        logger.debug(f"Messages retrieved: {messages_data}")
        return JsonResponse({'messages': messages_data})

    except Exception as e:
        logger.error(f"Error fetching messages for dialog ID {dialog_id}: {str(e)}")
        return JsonResponse({"status": "error", "message": "Internal server error."}, status=500)


def get_info(request, user_id):
    try:
        user = ChatUser.objects.get(id=user_id)
        # Проверяем активность сессий пользователя
        active_session = Session.objects.filter(user=user, expires_at__gt=now()).first()
        if active_session:
            # Если сессия активна
            user_status = {
                'is_online': True,
                'last_active': 'Недавно'
            }
        else:
            # Если сессия не активна
            last_session = Session.objects.filter(user=user).order_by('-expires_at').first()
            user_status = {
                'is_online': False,
                'last_active': last_session.expires_at if last_session else 'Неизвестно'
            }
    except ChatUser.DoesNotExist:
        user_status = {
            'is_online': False,
            'last_active': 'Неизвестно'
        }

    return JsonResponse({'status': user_status})


# @role_required(['admin'])
def settings_view(request):
    settings, created = Settings.objects.get_or_create(id=1)

    months = list(range(1, 25))
    current_retention_months = settings.message_retention_days // 30 if settings.message_retention_days else 1

    return render(request, 'chat_dashboard/settings.html', {
        'settings': settings,
        'months': months,
        'current_retention_months': current_retention_months,
        'ip_address': settings.ip_address,
        'logs_backup': settings.logs_backup
    })


def update_session_duration(request):
    if request.method == 'POST':
        try:
            session_duration = int(request.POST.get('session_duration'))
            ip_address = request.POST.get('ip_address')
            enable_ad = request.POST.get('enable_ad') == 'on'  # Проверяем на 'on'
            ldap_server = request.POST.get('ad_server')
            domain = request.POST.get('ad_domain')
            retention_months = request.POST.get('message_retention_months')
            logs_backup = request.POST.get('logs_backup')

            settings = Settings.objects.first()
            settings.session_duration = session_duration
            settings.ip_address = ip_address
            settings.logs_backup = logs_backup
            settings.ad_enabled = enable_ad  # Обновляем значение AD
            settings.ldap_server = ldap_server
            settings.domain = domain
            settings.message_retention_days = int(
                retention_months) * 30 if retention_months.isdigit() else settings.message_retention_days
            settings.save()

            return JsonResponse({'status': 'success', 'message': 'Настройки успешно обновлены!'})

        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)})

    return JsonResponse({'status': 'error', 'message': 'Неверный запрос'})


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # Корневая директория проекта

@csrf_exempt
def upload_document(request):
    if request.method == 'POST' and request.FILES.get('file'):
        uploaded_file = request.FILES['file']
        file_name = uploaded_file.name
        file_path = os.path.join(settings.MEDIA_ROOT, 'documents', file_name)

        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        return JsonResponse({'message': 'Файл успешно загружен!', 'file_name': file_name}, status=200)

    return JsonResponse({'message': 'Файл не загружен!'}, status=400)


import os
from django.conf import settings
from django.http import JsonResponse


def get_document_link_by_name(request, file_name):
    documents_path = os.path.join(settings.MEDIA_ROOT, 'documents')
    available_files = os.listdir(documents_path)

    for file in available_files:
        print(f"file = ss{file_name.strip()}ss, compare = ss{file.split('.docx')[0].strip()}ss")
        if file_name.strip() == file.split('.')[0]:
            file_url = f"{settings.MEDIA_URL}documents/{file}"
            return JsonResponse({'file_url': file_url}, status=200)

    # Если файл не найден
    return JsonResponse({'error': 'Файл не найден'}, status=404)

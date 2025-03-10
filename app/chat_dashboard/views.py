import logging
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.contrib.auth import get_user_model
from django.forms import CharField
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Exists, OuterRef, Subquery, Value, Case, When, F, Count
from django.db.models.functions import TruncDate, Concat
from django.utils.timezone import now
from .models import Dialog, Message, User, TrainingMessage, Settings, Documents
from chat_user.models import ChatUser, Session
from .forms import UserForm, UserFormUpdate
import json
import re
import spacy
import os
import os
from django.conf import settings
import pymorphy3
from config import config_settings
from django.conf import settings
import requests
from django.db.models import Q
from django.contrib import messages
from django.utils import timezone
from datetime import timedelta, datetime
from chat_user.models import ChatUser
from django.core.mail import send_mail
from authentication.decorators import role_required
import random
import uuid

logger = logging.getLogger('chat_dashboard')
user_action = logging.getLogger('user_actions')

@role_required(['admin', 'operator'])
def analytics(request):
    user = request.user
    user_action.info(
        'Accessing analytics page',
        extra={
            'user_id': user.id,
            'user_name': user.first_name + ' ' + user.last_name,
            'action_type': 'Accessing analytics page',
            'time': datetime.now(),
            'details': json.dumps({
                'status': f"{user.first_name} {user.last_name}' get access to analytics",
            })

        }
    )
    """Displays the analytics page."""
    logger.info("Accessing analytics page.")
    return render(request, 'chat_dashboard/analytics.html')


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
        {'created_at': date, 'user': values['user'], 'bot': values['bot']}
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


@role_required(['admin', 'operator'])
def training_dashboard(request):
    """Displays the training dashboard."""
    logger.info("Accessing training dashboard.")
    user = request.user
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
    user_action.info(
        'Accessing training dashboard',
        extra={
            'user_id': user.id,
            'user_name': user.first_name + ' ' + user.last_name,
            'action_type': 'Accessing training dashboard',
            'time': datetime.now(),
            'details': json.dumps({
                'status': f"{user.first_name} {user.last_name}' get access to training dashboard",
            })

        }
    )
    logger.debug(f"Unread messages: {list(unread_messages)}, Ignored messages: {list(ignored_messages)}")
    return render(request, 'chat_dashboard/training.html', context)




@csrf_exempt
def mark_question_trained(request):
    try:
        user = request.user
        data = json.loads(request.body)
        message_id = data.get('message_id')
        sender = data.get('sender_id')
        answer = data.get('answer')

        if not message_id:
            return JsonResponse({'error': 'Не передан идентификатор сообщения.'}, status=400)

        training_message = TrainingMessage.objects.get(id=message_id)
        sender = ChatUser.objects.get(id=sender)
        last_dialog = Dialog.objects.filter(user=sender).order_by('-started_at').first()

        greetings = ["Привет! Спасибо за ваше терпение. Вот ответ на ваш вопрос от нашего оператора. Надеюсь, он будет полезен! 😊",
                     "Здравствуйте! Ваш вопрос обработан, и вот ответ от нашего специалиста. Если что-то непонятно, дайте знать — я всегда готов помочь! 🚀",
                     "Приветствую! Вот ответ на ваш вопрос. Спасибо, что обратились к нам. Если остались вопросы, задавайте — я здесь, чтобы помочь! 📩",
                     "Добрый день! Ваш вопрос рассмотрен, и вот ответ от оператора. Надеюсь, он решит вашу задачу. Если что-то ещё нужно, просто спросите! 😄",
                     "Привет! Вот ответ на ваш вопрос. Спасибо за обращение! Если нужно что-то уточнить, я всегда на связи. 🛎️",
                     "Здравствуйте! Ваш вопрос обработан, и вот ответ от нашего специалиста. Надеюсь, он будет полезен. Если есть ещё вопросы, задавайте! 📨",
                     "Привет! Вот ответ на ваш вопрос. Спасибо за терпение! Если что-то непонятно или нужно уточнить, дайте знать — я готов помочь. 🕒",
                     "Добрый день! Ваш вопрос рассмотрен, и вот ответ от оператора. Надеюсь, он решит вашу задачу. Если что-то ещё нужно, просто спросите! 😊",
                     "Приветствую! Вот ответ на ваш вопрос. Спасибо за обращение! Если нужно что-то уточнить, я всегда на связи. 🚀",
                     "Здравствуйте! Ваш вопрос обработан, и вот ответ от нашего специалиста. Надеюсь, он будет полезен. Если есть ещё вопросы, задавайте! 📩",]
        random_greeting = random.choice(greetings)

        if last_dialog is None:
            return JsonResponse({'error': 'У пользователя нет активных диалогов.'}, status=400)

        Message.objects.create(
            dialog=last_dialog,
            sender_type='bot',
            sender=sender,
            content=f'''{random_greeting}<br>
                        Ваш вопрос:<br>
                        {training_message.content}<br>
                        <br>
                        Ответ оператора:<br>
                        {answer}''',
            message_type='message'
        )

        if training_message.sender and training_message.sender.email:
            subject = "Ваш вопрос обработан — ответ ждёт вас в чате"
            message = (
                f''' Уважаемый(ая) {sender.first_name} {sender.last_name}!,
                Большое спасибо за ваше терпение! Мы рады сообщить, что ваш вопрос был обработан, и ответ уже направлен вам в чат.
                Для вашего удобства дублируем вопрос и ответ ниже:
                Ваш вопрос:
                {training_message.content}

                Ответ оператора:
                {answer}

                Если у вас остались вопросы или что-то требует уточнения, пожалуйста, напишите нам в чат — мы всегда готовы помочь!

                С уважением,
                Команда поддержки Интеллектуальной платформы взаимодействия с пользователями HelpDeskBot'''
             )
            from_email = 'sapunowdany@yandex.by'
            send_mail(subject, message, from_email, [training_message.sender.email],fail_silently=False)
        training_message.delete()
        return JsonResponse({'status': 'success'})
    except TrainingMessage.DoesNotExist:
        user_action.error(
            'Mark_question_trained_unsuccessfully',
            extra={
                'user_id': user.id,
                'user_name': user.first_name + ' ' + user.last_name,
                'action_type': 'mark question trained',
                'time': datetime.now(),
                'details': json.dumps({
                    'status': f"Message not found",
                })

            }
        )
        return JsonResponse({'error': 'Сообщение для дообучения не найдено.'}, status=404)
    except Exception as e:
        user_action.error(
            'Mark_question_trained_unsuccessfully',
            extra={
                'user_id': user.id,
                'user_name': user.first_name + ' ' + user.last_name,
                'action_type': 'mark question trained',
                'time': datetime.now(),
                'details': json.dumps({
                    'status': f"Error {e}",
                })

            }
        )
        return JsonResponse({'error': str(e)}, status=500)


@role_required(['admin', 'operator'])
def train_message(request, message_id):
    """Displays a message for training."""
    logger.info(f"Accessing training page for message ID: {message_id}")
    user_message = get_object_or_404(TrainingMessage, id=message_id)
    logger.debug(f"Training message retrieved: {user_message.content}")
    user = request.user
    user_action.info(
        'f"Accessing training page for message ID: {message_id}"',
        extra={
            'user_id': user.id,
            'user_name': user.first_name + ' ' + user.last_name,
            'action_type': 'accessing train_message',
            'time': datetime.now(),
            'details': json.dumps({
                'status': f"{user.first_name} {user.last_name}' get accessing training page for message ID: {message_id}",
            })

        }
    )
    return render(request, 'chat_dashboard/train_message.html',
                  {'user_message': user_message,
                   'recognized_question': 'Здесь будет распознанный вопрос',
                   'neural_answer': 'Здесь будет ответ нейросетевой модели (в разработке)'})


def ignore_message(request, message_id):
    """Toggle the ignored status of a training message."""
    logger.info(f"Toggling ignore status for message ID: {message_id}")
    user = request.user
    try:
        message = TrainingMessage.objects.get(id=message_id)
        message.is_unread = False
        message.is_ignored = True
        message.save()

        unread_count = TrainingMessage.objects.filter(is_unread=True, is_ignored=False).count()
        ignored_count = TrainingMessage.objects.filter(is_ignored=True).count()

        logger.info(f"Message {message_id} updated: unread={message.is_unread}, ignored={message.is_ignored}")
        user_action.info(
            'f"toggle_ignore_message successfully"',
            extra={
                'user_id': user.id,
                'user_name': user.first_name + ' ' + user.last_name,
                'action_type': 'Toggle ignore message',
                'time': datetime.now(),
                'details': json.dumps({
                    'status': f"Toggle ignore message is successful",
                })

            }
        )
        return JsonResponse({
            'unread_count': unread_count,
            'ignored_count': ignored_count,
            'message_id': message.id,
            'is_unread': message.is_unread,
            'is_ignored': message.is_ignored,
        })
    except TrainingMessage.DoesNotExist:
        user_action.error(
            'f"TrainingMessage is not found"',
            extra={
                'user_id': user.id,
                'user_name': user.first_name + ' ' + user.last_name,
                'action_type': 'TrainingMessage is not found',
                'time': datetime.now(),
                'details': json.dumps({
                    'status': f"TrainingMessage is not found",
                })
            }
        )
        logger.error(f"Message ID {message_id} not found.")
        return JsonResponse({'error': 'Message not found'}, status=404)


def delete_training_message(request, message_id):
    """Deletes a training message."""
    logger.info(f"Attempting to delete message ID: {message_id}")
    try:
        message = TrainingMessage.objects.get(id=message_id)
        message.delete()
        user = request.user
        unread_count = TrainingMessage.objects.filter(is_ignored=False).count()
        ignored_count = TrainingMessage.objects.filter(is_ignored=True).count()

        logger.info(f"Message ID {message_id} deleted successfully.")
        user_action.info(
            f"Message ID {message_id} deleted successfully.",
            extra={
                'user_id': user.id,
                'user_name': user.first_name + ' ' + user.last_name,
                'action_type': 'delete message',
                'time': datetime.now(),
                'details': json.dumps({
                    'status': f"{user.first_name} {user.last_name}' delete message with id = {message_id} successfully.",
                })

            }
        )
        return JsonResponse({
            'unread_count': unread_count,
            'ignored_count': ignored_count
        })

    except TrainingMessage.DoesNotExist:
        user_action.error(
            f"Message not found",
            extra={
                'user_id': user.id,
                'user_name': user.first_name + ' ' + user.last_name,
                'action_type': 'Message not found',
                'time': datetime.now(),
                'details': json.dumps({
                    'status': f"Message not found",
                })

            }
        )
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
    user = request.user
    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            node_class = data.get('class')
            node_name = data.get('name')
            node_content = data.get('content')
            node_uuid = data.get('uuid')

            if not node_class or not node_name:
                return JsonResponse({'error': 'Missing required fields: class or name'}, status=400)

            logger.info(f"node class: {node_class}")
            sql_command = f"CREATE VERTEX {node_class} SET name = '{node_name}'"
            if node_content:
                sql_command += f", content = '{node_content}'"
            elif node_uuid:
                sql_command += f", uuid = '{node_uuid}'"

            headers = {'Content-Type': 'application/json'}
            json_data = {"command": sql_command}
            response = requests.post(config_settings.ORIENT_COMMAND_URL, headers=headers, json=json_data,
                                     auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),proxies=None)

            if response.status_code == 200:
                logger.info(f"Node created successfully: {response.text}")
                user_action.info(
                    f"Node created successfully: {response.text}",
                    extra={
                        'user_id': user.id,
                        'user_name': user.first_name + ' ' + user.last_name,
                        'action_type': 'create_node',
                        'time': datetime.now(),
                        'details': json.dumps({
                            'status': f"{user.first_name} {user.last_name}' create node successfully",
                        })
                    }
                )
                try:
                    response_data = response.json()
                    return JsonResponse({'status': 'success', 'data': response_data['result']}, status=201)

                except ValueError as e:
                    logger.error(f"Error parsing JSON response: {e}")
                    user_action.error(
                        f"Error parsing JSON response: {e}",
                        extra={
                            'user_id': user.id,
                            'user_name': user.first_name + ' ' + user.last_name,
                            'action_type': 'create_node',
                            'time': datetime.now(),
                            'details': json.dumps({
                                'status': f"Error parsing JSON response: {e}",
                            })

                        }
                    )

                    return JsonResponse({'error': 'Failed to parse response'}, status=500)

            else:
                logger.error(f"Error fetching data: HTTP {response.status_code} - {response.text}")
                user_action.error(
                    f"Error fetching data: HTTP {response.status_code} - {response.text}",
                    extra={
                        'user_id': user.id,
                        'user_name': user.first_name + ' ' + user.last_name,
                        'action_type': 'create_node',
                        'time': datetime.now(),
                        'details': json.dumps({
                            'status': f"Error fetching data: HTTP {response.status_code} - {response.text}",
                        })

                    }
                )
                return JsonResponse({'error': f"Error {response.status_code}: {response.text}"},
                                    status=response.status_code)

        except Exception as e:
            logger.error(f"Error in creating node: {e}")
            user_action.error(
                f"Error in creating node: {e}",
                extra={
                    'user_id': user.id,
                    'user_name': user.first_name + ' ' + user.last_name,
                    'action_type': 'create_node',
                    'time': datetime.now(),
                    'details': json.dumps({
                        'status': f"{user.first_name} {user.last_name}' create node unsuccessfully",
                    })

                }
            )
            return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def create_relation(request):
    """Creates a relation between two nodes."""
    user = request.user
    if request.method == 'POST':
        logger.info("Creating a new relation between nodes.")
        try:
            data = json.loads(request.body)

            # relation_type = data.get('type').lower()
            start_node_id = data.get('start_node_id')
            end_node_id = data.get('end_node_id')

            if not start_node_id or not end_node_id:
                logger.warning("Missing required fields for relation creation.")
                user_action.info(
                    f"Missing required fields for relation creation.",
                    extra={
                        'user_id': user.id,
                        'user_name': user.first_name + ' ' + user.last_name,
                        'action_type': 'create_relation',
                        'time': datetime.now(),
                        'details': json.dumps({
                            'status': f"Missing required fields for relation creation.",
                        })

                    }
                )
                return JsonResponse({'error': 'Missing required fields'}, status=400)

            command = f"CREATE EDGE Includes FROM {start_node_id} TO {end_node_id}"
            headers = {'Content-Type': 'application/json'}
            json_data = {"command": command}

            response = requests.post(config_settings.ORIENT_COMMAND_URL, headers=headers, json=json_data,
                                     auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),proxies=None)

            logger.info(f"Relation created between nodes {start_node_id} and {end_node_id}.")
            user_action.info(
                f"Relation created between nodes {start_node_id} and {end_node_id}.",
                extra={
                    'user_id': user.id,
                    'user_name': user.first_name + ' ' + user.last_name,
                    'action_type': 'create_relation',
                    'time': datetime.now(),
                    'details': json.dumps({
                        'status': f"Relation created between nodes {start_node_id} and {end_node_id}.",
                    })

                }
            )
            return JsonResponse({'message': 'Relation successfully created'}, status=201)
        except Exception as e:
            logger.exception("An error occurred while creating a relation.")
            user_action.error(
                "An error occurred while creating a relation.",
                extra={
                    'user_id': user.id,
                    'user_name': user.first_name + ' ' + user.last_name,
                    'action_type': 'create_relation',
                    'time': datetime.now(),
                    'details': json.dumps({
                        'status': "An error occurred while creating a relation.",
                    })

                }
            )
            return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def delete_node(request):
    """Creates a relation between two nodes."""
    user = request.user
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            node_id_to_delete = data.get('node_id')

            if not node_id_to_delete:
                logger.warning("Missing required fields for relation creation.")
                user_action.warning(
                    f"Missing required fields for relation creation.",
                    extra={
                        'user_id': user.id,
                        'user_name': user.first_name + ' ' + user.last_name,
                        'action_type': 'delete_node',
                        'time': datetime.now(),
                        'details': json.dumps({
                            'status': f"Missing required fields for relation creation.",
                        })

                    }
                )
                return JsonResponse({'error': 'Missing required fields'}, status=400)

            command = f"DELETE VERTEX {node_id_to_delete}"
            headers = {'Content-Type': 'application/json'}
            json_data = {"command": command}

            response = requests.post(config_settings.ORIENT_COMMAND_URL, headers=headers, json=json_data,
                                     auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),proxies=None)

            user_action.info(
                f"Node successfully deleted",
                extra={
                    'user_id': user.id,
                    'user_name': user.first_name + ' ' + user.last_name,
                    'action_type': 'delete_node',
                    'time': datetime.now(),
                    'details': json.dumps({
                        'status': f"Node successfully deleted.",
                    })

                }
            )

            return JsonResponse({'message': 'Node successfully deleted'}, status=201)
        except Exception as e:
            user_action.warning(
                "An error occurred while creating a relation.",
                extra={
                    'user_id': user.id,
                    'user_name': user.first_name + ' ' + user.last_name,
                    'action_type': 'delete_node',
                    'time': datetime.now(),
                    'details': json.dumps({
                        'status': "An error occurred while creating a relation.",
                    })

                }
            )
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

            response = requests.post(config_settings.ORIENT_COMMAND_URL, headers=headers, json=json_data,
                                     auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),proxies=None)

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
    user = request.user
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
            user_action.info(
                f"Training message created with ID: {training_message.id}",
                extra={
                    'user_id': user.id,
                    'user_name': user.first_name + ' ' + user.last_name,
                    'action_type': 'create_training_message',
                    'time': datetime.now(),
                    'details': json.dumps({
                        'status': f"Training message created with ID: {training_message.id}",
                    })

                }
            )

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

@role_required(['admin',])
def user_list(request):
    """Displays a combined list of User and ChatUser."""
    logger.info("Accessing user list.")
    user = request.user

    search_query = request.GET.get('search', '')
    sort_column = request.GET.get('sort', 'username')
    page_number = request.GET.get('page', 1)


    users = User.objects.all()
    chat_users = ChatUser.objects.all()


    combined_users = []
    for user in users:
        combined_users.append({
            'type': 'admin',
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'username': user.username,
            'email': user.email,
            'role': user.get_role_display(),
        })

    for chat_user in chat_users:
        combined_users.append({
            'type': 'chat',
            'id': chat_user.id,
            'first_name': chat_user.first_name,
            'last_name': chat_user.last_name,
            'username': chat_user.username,
            'email': chat_user.email,
            'role': chat_user.get_role_display(),
        })

    # Фильтрация по поисковому запросу
    if search_query:
        combined_users = [
            u for u in combined_users
            if (search_query.lower() in u['first_name'].lower() or
                search_query.lower() in u['last_name'].lower() or
                search_query.lower() in u['email'].lower() or
                search_query.lower() in u['username'].lower())
        ]

    # Сортировка
    reverse_sort = sort_column.startswith('-')
    sort_key = sort_column.lstrip('-') if reverse_sort else sort_column

    combined_users.sort(
        key=lambda x: str(x.get(sort_key, '')).lower(),
        reverse=reverse_sort
    )

    paginator = Paginator(combined_users, 10)  # 10 элементов на странице
    try:
        page_obj = paginator.page(page_number)
    except PageNotAnInteger:
        page_obj = paginator.page(1)
    except EmptyPage:
        page_obj = paginator.page(paginator.num_pages)
    user_action.info(
        f"Access to user_list",
        extra={
            'user_id': user.id,
            'user_name': user.first_name + ' ' + user.last_name,
            'action_type': 'access to user_list',
            'time': datetime.now(),
            'details': json.dumps({
                'status': f"Access to user_list",
            })
        })
    return render(request, 'chat_dashboard/users.html', {
        #'users': combined_users,
        'page_obj': page_obj,
        'sort_column': sort_column,
        'search_query': search_query
    })
@role_required('admin')
def user_create(request):
    """Creates a new user."""
    logger.info("Creating a new user.")
    form = UserForm(request.POST or None)
    user = request.user
    if request.method == 'POST':
        email = request.POST.get('email')
        if User.objects.filter(email=email).exists():
            logger.error(f"Attempt to create user failed: Email already registered - {email}")
            user_action.warning(
                f"Attempt to create user failed: Email already registered - {email}",
                extra={
                    'user_id': user.id,
                    'user_name': user.first_name + ' ' + user.last_name,
                    'action_type': 'create_user',
                    'time': datetime.now(),
                    'details': json.dumps({
                        'status': f"Attempt to create user failed: Email already registered - {email}",
                    })
                })
            # Возвращаем информацию о том, что email уже зарегистрирован
            return render(request, 'chat_dashboard/user_create_form.html', {
                'form': form,
                'email_exists': True,
                'email': email
            })

        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            #user.is_active = True
            user.save()
            logger.info(f"User created: ID={user.id}, Username={user.username}, Email={user.email}")

            user_action.info(
                f"User created: ID={user.id}, Username={user.username}, Email={user.email}",
                extra={
                    'user_id': user.id,
                    'user_name': user.first_name + ' ' + user.last_name,
                    'action_type': 'create_user',
                    'time': datetime.now(),
                    'details': json.dumps({
                        'status': f"User created: ID={user.id}, Username={user.username}, Email={user.email}",
                    })
                })
            messages.success(request,
                             "Создана новая учетная запись. Данные для её активации направлены на указанный вами электронный адрес.")
            return redirect('chat_dashboard:user_list')  # Перенаправляем на список пользователей

    return render(request, 'chat_dashboard/user_create_form.html', {'form': form})

def get_user_model_by_type(user_type):
    if user_type == 'admin':
        return get_user_model()
    elif user_type == 'chat':
        return ChatUser
    raise Http404("Invalid user type")


@role_required('admin')
def user_update(request, user_type, pk):
    """Updates user data for both User and ChatUser models."""
    logger.info(f"Updating {user_type} user with ID: {pk}")
    model = get_user_model_by_type(user_type)
    user = get_object_or_404(model, pk=pk)

    if request.method == 'POST':
        form = UserFormUpdate(request.POST, instance=user)
        if form.is_valid():
            user = form.save(commit=False)
            if user_type == 'admin' and form.cleaned_data.get('password'):
                user.set_password(form.cleaned_data['password'])
            user.save()
            logger.info(f"{user_type.capitalize()} user updated: ID={pk}")
            user_action.info(
                f"{user_type.capitalize()} user updated: ID={pk}",
                extra={
                    'user_id': user.id,
                    'user_name': user.first_name + ' ' + user.last_name,
                    'action_type': 'update_user',
                    'time': datetime.now(),
                    'details': json.dumps({
                        'status': f"{user_type.capitalize()} user updated: ID={pk}",
                    })
                })
            return redirect('chat_dashboard:user_list')
    else:
        form = UserFormUpdate(instance=user)

    return render(request, 'chat_dashboard/user_update_form.html', {
        'form': form,
        'user_type': user_type
    })

@role_required('admin')
def user_delete(request, user_type, pk):
    """Deletes a user from specified model."""
    logger.info(f"Attempting to delete {user_type} user with ID: {pk}")
    model = get_user_model_by_type(user_type)
    user = get_object_or_404(model, pk=pk)

    if request.method == 'POST':
        user.delete()
        user_action.info(
            f"user deleted: ID={pk}",
            extra={
                'user_id': user.id,
                'user_name': user.first_name + ' ' + user.last_name,
                'action_type': 'delete_user',
                'time': datetime.now(),
                'details': json.dumps({
                    'status': f" user deleted: ID={pk}",
                })
            })
        logger.info(f"user deleted: ID={pk}")
        return redirect('chat_dashboard:user_list')

    return render(request, 'chat_dashboard/user_delete_form.html', {
        'user': user,
        'user_type': user_type
    })


def get_last_message_subquery(field):
    logger.debug("Creating a subquery for the last message.")
    return Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values(field)[:1]


@role_required(['admin', 'operator'])
def archive(request):
    user = request.user
    logger.info(f"Accessing archive page by user {user}.")
    if request.method == 'POST':
        user.delete()
        user_action.info(
            f"Accessing archive page by user {user}.",
            extra={
                'user_id': user.id,
                'user_name': user.first_name + ' ' + user.last_name,
                'action_type': 'access to archive',
                'time': datetime.now(),
                'details': json.dumps({
                    'status': f"Accessing archive page by user {user}.",
                })
            })


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


@role_required(['admin', 'operator'])
def create_or_edit_content(request):
    user = request.user
    user_action.info(
        f"Accessing create_or_edit_content page by user {user}.",
        extra={
            'user_id': user.id,
            'user_name': user.first_name + ' ' + user.last_name,
            'action_type': 'access to create_or_edit_content',
            'time': datetime.now(),
            'details': json.dumps({
                'status': f"Accessing create_or_edit_content page by user {user}.",
            })
        })
    return render(request, 'chat_dashboard/edit_content.html')


def filter_dialogs_by_date_range(request):
    user = request.user
    start_date = request.GET.get('start')
    end_date = request.GET.get('end')

    # Преобразование в aware datetime
    start = timezone.make_aware(timezone.datetime.fromisoformat(start_date))
    end = timezone.make_aware(timezone.datetime.fromisoformat(end_date))

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
                Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender__first_name')[:1])
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




# def filter_dialogs(request, period):
    # user = request.user
    # logger.info(f"Filtering dialogs by user {user} with period {period}.")
    #
    # # Определяем дату для фильтрации
    # now = timezone.now()
    #
    # if period == 0:
    #     # Фильтруем все диалоги
    #     dialogs = Dialog.objects.annotate(
    #         has_messages=Exists(Message.objects.filter(dialog=OuterRef('pk'))),
    #         username=Concat(F('user__first_name'), Value(' '), F('user__last_name')),
    #         last_message=Subquery(
    #             Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('content')[:1]),
    #         last_message_timestamp=Subquery(
    #             Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('created_at')[:1]),
    #         last_message_sender_id=Subquery(
    #             Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender_id')[:1]),
    #         last_message_username=Case(
    #             When(last_message_sender_id=None, then=Value('Bot')),
    #             default=Subquery(
    #                 Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender__first_name')[:1])
    #         ),
    #     ).filter(has_messages=True).order_by('-last_message_timestamp')
    # else:
    #     # Фильтруем по времени
    #     time_filter = now - timedelta(days=period)
    #     dialogs = Dialog.objects.annotate(
    #         has_messages=Exists(Message.objects.filter(dialog=OuterRef('pk'))),
    #         username=Concat(F('user__first_name'), Value(' '), F('user__last_name')),
    #         last_message=Subquery(
    #             Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('content')[:1]),
    #         last_message_timestamp=Subquery(
    #             Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('created_at')[:1]),
    #         last_message_sender_id=Subquery(
    #             Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender_id')[:1]),
    #         last_message_username=Case(
    #             When(last_message_sender_id=None, then=Value('Bot')),
    #             default=Subquery(
    #                 Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender__first_name')[:1])
    #         ),
    #     ).filter(has_messages=True, last_message_timestamp__gte=time_filter).order_by('-last_message_timestamp')
    #
    # # Логирование для отладки
    # logger.debug(f"Filtered dialogs: {list(dialogs)}")
    #
    # # Возвращаем отфильтрованные диалоги в формате JSON
    # dialogs_data = [
    #     {
    #         'id': dialog.id,
    #         'user': {
    #             'id': dialog.user.id,
    #             'username': dialog.user.username
    #         },
    #         'last_message': dialog.last_message,
    #         'last_message_timestamp': dialog.last_message_timestamp,
    #         'last_message_username': dialog.last_message_username
    #     }
    #     for dialog in dialogs
    # ]
    #
    # return JsonResponse(dialogs_data, safe=False)
from django.db.models import CharField


def filter_dialogs(request):
    period = request.GET.get('period', 0)
    user_id = request.GET.get('user_id')
    start_date = request.GET.get('start')
    end_date = request.GET.get('end')

    try:
        period = int(period)
    except ValueError:
        period = 0

    dialogs = Dialog.objects.annotate(
        has_messages=Exists(Message.objects.filter(dialog=OuterRef('pk'))),
        last_message=Subquery(
            Message.objects.filter(dialog=OuterRef('pk'))
            .order_by('-created_at')
            .values('content')[:1]
        ),
        last_message_timestamp=Subquery(
            Message.objects.filter(dialog=OuterRef('pk'))
            .order_by('-created_at')
            .values('created_at')[:1]
        ),
        last_message_sender_id=Subquery(
            Message.objects.filter(dialog=OuterRef('pk'))
            .order_by('-created_at')
            .values('sender_id')[:1]
        ),
        last_message_username=Case(
            When(last_message_sender_id__isnull=True, then=Value('Bot')),
            default=Concat(
                Subquery(
                    ChatUser.objects.filter(pk=OuterRef('last_message_sender_id'))
                    .values('first_name')[:1]
                ),
                Value(' '),
                Subquery(
                    ChatUser.objects.filter(pk=OuterRef('last_message_sender_id'))
                    .values('last_name')[:1]
                ),
            ),
            output_field=CharField()
        ),
        username=Concat(
            F('user__first_name'),
            Value(' '),
            F('user__last_name'),
            output_field=CharField()
        )
    ).filter(has_messages=True)

    if user_id:
        dialogs = dialogs.filter(user_id=user_id)

    if period > 0:
        time_filter = timezone.now() - timedelta(days=period)
        dialogs = dialogs.filter(last_message_timestamp__gte=time_filter)

    if start_date and end_date:
        try:
            start = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
            end = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d')) + timedelta(days=1)
            dialogs = dialogs.filter(last_message_timestamp__range=(start, end))
        except ValueError:
            return JsonResponse({'error': 'Invalid date format'}, status=400)

    dialogs = dialogs.order_by('-last_message_timestamp').distinct()

    dialogs_data = [
        {
            'id': dialog.id,
            'user': {
                'id': dialog.user.id,
                'username': dialog.username
            },
            'last_message': dialog.last_message,
            'last_message_timestamp': dialog.last_message_timestamp,
            'last_message_username': dialog.last_message_username
        }
        for dialog in dialogs
    ]

    return JsonResponse(dialogs_data, safe=False)

def filter_dialogs_by_id(request):
    user = request.user
    user_id = request.GET.get('user_id')
    if not user_id:
        return JsonResponse({'error': 'user_id parameter is required'}, status=400)

    period = request.GET.get('period', 0)

    logger.info(f"Filtering dialogs by user {user} with user ID {user_id}.")
    try:
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

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

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

    if not dialogs_data:
        return JsonResponse({
            'message': 'Диалогов не найдено',
            'data': []
        }, status=200)

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
        active_session = Session.objects.filter(user=user, expires_at__gt=now()).first()
        if active_session:
            user_status = {
                'is_online': True,
                'last_active': 'Недавно'
            }
        else:
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


@role_required(['admin'])
def settings_view(request):
    settings, created = Settings.objects.get_or_create(id=1)
    user = request.user
    user_action.info(
        f"Accessing settings page by user {user}.",
        extra={
            'user_id': user.id,
            'user_name': user.first_name + ' ' + user.last_name,
            'action_type': 'access to settings page',
            'time': datetime.now(),
            'details': json.dumps({
                'status': f"Accessing settings page by user {user}.",
            })
        })
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
    global DOCUMENTS_DICT
    user = request.user
    if request.method == 'POST' and request.FILES.get('file'):
        uploaded_file = request.FILES['file']
        file_name = uploaded_file.name
        file_path = os.path.join(settings.MEDIA_ROOT, 'documents', file_name)
        document_uuid = str(uuid.uuid4())
        new_document = Documents.objects.create(
            document_name=file_name,
            document_uuid=document_uuid
        )

        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        user_action.info(
            f"Trying upload document by user {user} success",
            extra={
                'user_id': user.id,
                'user_name': user.first_name + ' ' + user.last_name,
                'action_type': 'upload document',
                'time': datetime.now(),
                'details': json.dumps({
                    'status': f"Trying upload document by user {user} success",
                })
            })

        return JsonResponse({'message': 'Файл успешно загружен!', 'data': {'file_name': file_name, 'file_id': document_uuid}}, status=200)
    user_action.info(
        f"Trying upload document by user {user} unsuccess",
        extra={
            'user_id': user.id,
            'user_name': user.first_name + ' ' + user.last_name,
            'action_type': 'upload document',
            'time': datetime.now(),
            'details': json.dumps({
                'status': f"Trying upload document by user {user} unsuccess",
            })
        })

    return JsonResponse({'message': 'Файл не загружен!'}, status=400)


def get_document_link_by_uuid(request, uuid):
    documents_path = os.path.join(settings.MEDIA_ROOT, 'documents')
    available_files = os.listdir(documents_path)

    document = Documents.objects.get(document_uuid=uuid)
    document_name = document.document_name

    for file in available_files:
        if document_name.strip() == file.strip():
            file_url = f"{settings.MEDIA_URL}documents/{file}"

            return JsonResponse({'file_url': file_url}, status=200)

    # Если файл не найден
    return JsonResponse({'error': 'Файл не найден'}, status=404)

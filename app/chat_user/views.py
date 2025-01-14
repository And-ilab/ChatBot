import urllib
import jwt
import logging
import requests
import json
from datetime import datetime, timedelta
from django.shortcuts import render, get_object_or_404
from django.utils.timezone import now
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.conf import settings
from chat_dashboard.models import Dialog, Message, Settings
from .models import ChatUser, Session
from chat_dashboard.models import Settings
from urllib.parse import unquote

logger = logging.getLogger('Chat')


def user_chat(request):
    logger.info("Rendering user chat page.")
    return render(request, 'user_chat/user_chat.html')


def chat_login(request):
    if request.method == "POST":
        try:
            # Получение данных из тела запроса
            data = json.loads(request.body)
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            email = data.get("email")

            # Логирование полученных данных
            logger.info(f"Received login request: first_name={first_name}, last_name={last_name}, email={email}")
        except KeyError as e:
            logger.error(f"KeyError: Missing key {str(e)} in request data.")
            return JsonResponse({"status": "error", "message": "Invalid data."}, status=400)

        try:
            # Получение или создание пользователя
            user, created = ChatUser.objects.get_or_create(email=email, defaults={
                "first_name": first_name,
                "last_name": last_name
            })

            if created:
                logger.info(f"New user created with email {email}.")
            else:
                logger.info(f"Existing user logged in with email {email}.")

            # Получаем длительность сессии из таблицы settings
            session_duration_minutes = Settings.objects.first().session_duration  # предполагается, что есть хотя бы одна запись в settings
            logger.info(f"Session duration set to {session_duration_minutes} minutes.")

            # Создание JWT
            payload = {
                "user_id": user.id,
                "email": user.email,
                "exp": datetime.utcnow() + timedelta(minutes=session_duration_minutes),  # Время истечения токена
            }
            session_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

            # Логирование успешного создания токена
            logger.info(f"JWT created for user {user.email} with token {session_token}.")

            # Создание записи сессии в базе данных
            expires_at = datetime.utcnow() + timedelta(minutes=session_duration_minutes)
            session = Session.objects.create(
                user=user,
                session_token=session_token,
                expires_at=expires_at
            )
            logger.info(f"Session created for user {user.email} with token {session_token}.")

            return JsonResponse({
                "status": "success",
                "message": "User logged in successfully.",
                "session_token": session_token
            })

        except Exception as e:
            logger.error(f"Error occurred while creating session: {str(e)}")
            return JsonResponse({"status": "error", "message": "Internal server error."}, status=500)

    # Логирование при попытке использовать не-POST запрос
    logger.warning("Attempted to access chat_login with a non-POST request.")
    return JsonResponse({"status": "error", "message": "Only POST method allowed."}, status=405)


def check_session(request):
    """Проверка активности сессии."""
    if request.method == "GET":
        session_token = request.headers.get("Authorization")

        if not session_token:
            logger.warning("Session token not provided.")
            return JsonResponse({"status": "login", "message": "Токен сессии отсутствует"}, status=200)

        logger.info(f"Checking session with token: {session_token}")

        try:
            # Поиск сессии в базе данных
            session = Session.objects.get(session_token=session_token)
            logger.info(f"Session found for user: {session.user.email} with token: {session_token}")

            if session.is_active():
                logger.info(f"Session is active for user: {session.user.email}. Expires at: {session.expires_at}")
                return JsonResponse({
                    "status": "success",
                    "message": "Сессия активна",
                    "user_id": session.user.id,
                    "user_email": session.user.email,
                    "expires_at": session.expires_at,
                }, status=200)
            else:
                logger.warning(f"Session for user {session.user.email} is expired.")
                return JsonResponse({
                    "status": "expired",
                    "message": "Сессия истекла. Необходимо создать новую."
                }, status=200)

        except Session.DoesNotExist:
            logger.error("Session not found with provided token.")
            return JsonResponse({
                "status": "login",
                "message": "Сессия не найдена. Пожалуйста, войдите заново."
            }, status=200)

    # Логирование при попытке использовать не-GET запрос
    logger.warning("Attempted to access check_session with a non-GET request.")
    return JsonResponse({"status": "error", "message": "Метод не поддерживается"}, status=405)


@csrf_exempt
def extend_session(request):
    """Функция для продления сессии."""
    if request.method == "POST":
        session_token = request.headers.get("Authorization")

        if not session_token:
            logger.warning("Session token not provided.")
            return JsonResponse({"status": "error", "message": "Токен сессии обязателен."}, status=400)

        try:
            # Поиск сессии в базе данных
            session = Session.objects.get(session_token=session_token)
            logger.info(f"Сессия найдена для пользователя: {session.user.email} с токеном: {session_token}")

            # Получаем продолжительность сессии из настроек
            try:
                session_duration_minutes = Settings.objects.first().session_duration
            except Settings.DoesNotExist:
                logger.error("Настройки не найдены, используем значение по умолчанию в 30 минут.")
                session_duration_minutes = 30  # Значение по умолчанию

            # Обновляем время истечения сессии
            new_expires_at = now() + timedelta(minutes=session_duration_minutes)
            session.expires_at = new_expires_at
            session.save()

            logger.info(f"Сессия для пользователя {session.user.email} продлена. Новое время истечения: {new_expires_at}")

            return JsonResponse({
                "status": "success",
                "message": "Сессия успешно продлена.",
                "expires_at": new_expires_at,
            })

        except Session.DoesNotExist:
            logger.error("Сессия не найдена с предоставленным токеном.")
            return JsonResponse({
                "status": "error",
                "message": "Сессия не найдена. Пожалуйста, войдите снова."
            }, status=404)

        except Exception as e:
            logger.error(f"Неожиданная ошибка: {str(e)}", exc_info=True)
            return JsonResponse({
                "status": "error",
                "message": "Произошла неожиданная ошибка."
            }, status=500)

    logger.warning("Попытка доступа к extend_session с не-POST запросом.")
    return JsonResponse({"status": "error", "message": "Разрешён только метод POST."}, status=405)


def get_user_details(request, user_id):
    """Retrieve first_name and last_name of a user by their ID."""
    # Validate user_id is a valid integer
    try:
        user_id = int(user_id)
    except ValueError:
        logger.warning(f"Invalid user_id format: {user_id}")
        return JsonResponse({"status": "error", "message": "Invalid user ID format."}, status=400)

    logger.info(f"Received request to fetch user details for user_id: {user_id}")

    try:
        # Use get() to fetch the user directly
        user = ChatUser.objects.get(id=user_id)

        user_data = {
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
        logger.info(f"User details fetched successfully for user_id: {user_id}: {user_data}")
        return JsonResponse({"status": "success", "user": user_data}, status=200)

    except ChatUser.DoesNotExist:
        logger.warning(f"User with ID {user_id} not found.")
        return JsonResponse({"status": "error", "message": "User not found."}, status=404)

    except Exception as e:
        logger.error(f"Error occurred while fetching user details for user_id {user_id}: {str(e)}", exc_info=True)
        return JsonResponse({"status": "error", "message": "Internal server error."}, status=500)

def process_keywords(request):
    question = request.GET.get('question')


def get_nodes_by_type(request):
    """Fetch nodes of a specific type from the OrientDB database."""

    # Получаем параметр 'type' из запроса
    node_type = request.GET.get('type')

    # Проверяем, был ли предоставлен параметр 'type'
    if not node_type:
        logger.warning("Node type not provided.")
        return JsonResponse({"status": "error", "message": "Node type is required."}, status=400)

    logger.info(f"Fetching nodes of type: {node_type}")

    # Декодируем параметр 'type' из URL формата
    node_type = urllib.parse.unquote(node_type)

    # Формируем URL для запроса
    url = f"http://localhost:2480/query/chat-bot-db/sql/SELECT FROM {node_type}"

    try:
        response = requests.get(url, auth=('root', 'guregure'))

        if response.status_code == 200:
            logger.info(f"Successfully fetched data for type: {node_type}")

            try:
                # Логируем текст ответа для отладки
                logger.debug(f"Response text: {response.text}")

                # Пытаемся распарсить JSON ответ
                data = response.json()

                # Проверяем, есть ли в ответе поле 'result'
                if 'result' in data:
                    nodes_data = []
                    for node in data['result']:
                        # Убедимся, что в узле есть поля 'content' и '@rid'
                        if 'content' in node and '@rid' in node:
                            nodes_data.append({'id': node['@rid'], 'name': node['content']})


                    custom_order = [
                        "Организационно-кадровая работа",
                        "Оказание материальной помощи и оплата труда",
                        "Обучение, тестирование, практика",
                        "Вопросы для психологов",
                        "Образцы заявлений"
                    ]
                    nodes_data.sort(
                        key=lambda x: custom_order.index(x['name']) if x['name'] in custom_order else float('inf'))

                    logger.info(f"Found {len(nodes_data)} nodes.")
                    return JsonResponse({'result': nodes_data})

                else:
                    logger.error(f"Unexpected response format: 'result' field missing.")
                    return JsonResponse({"status": "error", "message": "Unexpected response format."}, status=500)

            except ValueError as e:
                logger.error(f"Error parsing JSON response: {e}")
                return JsonResponse({"status": "error", "message": "Error parsing response data."}, status=500)

        else:
            logger.error(f"Error fetching data: HTTP {response.status_code} - {response.text}")
            return JsonResponse({"status": "error", "message": "Error fetching data from the database."}, status=500)

    except requests.exceptions.RequestException as e:
        logger.error(f"Request error: {e}")
        return JsonResponse({"status": "error", "message": "Error executing the request to the database."}, status=500)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return JsonResponse({"status": "error", "message": "Internal server error."}, status=500)


def get_nodes_by_type_with_relation(request):
    """Fetch nodes of a specific type related to another node type based on a relationship."""
    if request.method == 'GET':
        # Получаем параметры startNodeType, startNodeName и finishNodeType из запроса
        start_node_type = urllib.parse.unquote(request.GET.get('startNodeType'))
        start_node_name = urllib.parse.unquote(request.GET.get('startNodeName'))
        finish_node_type = urllib.parse.unquote(request.GET.get('finishNodeType'))

        # Проверяем, что все параметры переданы
        if start_node_type and start_node_name and finish_node_type:
            logger.info(f"Fetching nodes with type of start node: {start_node_type}")

            # Формируем запрос с учётом кавычек вокруг start_node_name
            url = (f"http://localhost:2480/query/chat-bot-db/sql/SELECT FROM {finish_node_type} "
                   f"WHERE @rid IN (SELECT OUT('Includes') "
                   f"FROM (SELECT FROM {start_node_type} WHERE content = '{start_node_name}'))")

            try:
                response = requests.get(url, auth=('root', 'guregure'))

                # Проверка на успешность ответа
                if not response.ok:
                    logger.warning("Base node not found.")
                    return JsonResponse([], safe=False, status=200)

                # Пытаемся распарсить JSON ответ
                data = response.json()
                if 'result' in data:
                    nodes_data = []
                    for node in data['result']:
                        # Проверяем, есть ли в узле необходимые поля
                        if 'content' in node and '@rid' in node:
                            nodes_data.append({'id': node['@rid'], 'name': node['content']})

                    logger.info(f"Found {len(nodes_data)} nodes.")
                    logger.info(nodes_data)
                    return JsonResponse({'result': nodes_data})
                else:
                    logger.error(f"Unexpected response format.")

            except Exception as e:
                logger.error(f"Error fetching data: {e}")
                return JsonResponse({"error": "Failed to fetch data"}, status=500)

def get_answer(request):
    """Fetch answer for a specific question ID."""
    if request.method == 'GET':
        # Получаем параметр questionId из запроса
        question_id = urllib.parse.unquote(request.GET.get('questionId'))

        # Проверяем, что параметр questionId передан
        if question_id:
            logger.info(f"Received questionId: {question_id}")
            url = (f"http://localhost:2480/command/chat-bot-db/sql/")
            query = f"SELECT FROM Answer WHERE @rid IN (SELECT OUT('Includes') FROM Question WHERE @rid = '{question_id}')"
            logger.info(f"Sending query: {url}")  # Логируем сформированный запрос

            try:
                # Отправляем запрос к базе данных для получения ответа на вопрос
                response = requests.get(
                    url,
                    auth=('root', 'guregure'),
                    headers={"Content-Type": "application/json"},
                    json={"command": query}
                )

                logger.info(f"Response status: {response.status_code}.")

                # Если ответ неудачен, возвращаем ошибку
                if not response.ok:
                    logger.warning("Answer not found for the given answer ID.")
                    return JsonResponse({"error": "Answer not found"}, status=404)
                else:
                    # Пытаемся распарсить JSON ответ
                    data = response.json()
                    logger.info(f"Data = {data}")

                    if 'result' in data:
                        nodes_data = []
                        for node in data['result']:
                            # Проверяем, есть ли в узле необходимые поля
                            if 'content' in node and '@rid' in node:
                                nodes_data.append({'id': node['@rid'], 'content': node['content']})

                        logger.info(f"Found {len(nodes_data)} nodes.")
                        logger.info(nodes_data)
                        return JsonResponse({'result': nodes_data})
                    else:
                        logger.error(f"Unexpected response format")

            except Exception as e:
                logger.error(f"Error fetching answer: {e}")
                return JsonResponse({"error": "Failed to fetch answer"}, status=500)
        else:
            logger.error("No questionId provided.")
            return JsonResponse({"error": "No questionId provided"}, status=400)


def get_documents(request):
    """Получение документов и ссылок, связанных с ответом по заданному ID."""
    if request.method == 'GET':
        # Извлекаем answerID из GET-запроса
        answer_id = urllib.parse.unquote(request.GET.get('answerID'))

        if answer_id:
            nodes_data = []
            logger.info(f"Received answerId: {answer_id}")

            # Формируем запрос для получения документов
            url = "http://localhost:2480/command/chat-bot-db/sql/"
            documents_query = f"SELECT FROM document WHERE @rid IN (SELECT OUT('Includes') FROM Answer WHERE @rid = '{answer_id}')"
            logger.info(f"Sending documents query: {documents_query}")

            # Формируем запрос для получения ссылок
            links_query = f"SELECT FROM link WHERE @rid IN (SELECT OUT('Includes') FROM Answer WHERE @rid = '{answer_id}')"
            logger.info(f"Sending links query: {links_query}")

            try:
                # Получаем данные документов
                response = requests.get(
                    url,
                    auth=('root', 'guregure'),
                    headers={"Content-Type": "application/json"},
                    json={"command": documents_query}
                )

                documents_data = response.json()
                logger.info(f"Documents data = {documents_data}")

                if 'result' in documents_data:
                    for node in documents_data['result']:
                        if 'content' in node and '@rid' in node:
                            nodes_data.append({'id': node['@rid'], 'name': node['name'], 'content': node['content']})
                    logger.info(f"Found {len(nodes_data)} documents.")
                    logger.info(nodes_data)
                else:
                    logger.error(f"Unexpected response format")

            except Exception as e:
                logger.error(f"Error fetching documents: {e}")
                return JsonResponse({"error": "Failed to fetch documents"}, status=500)

            try:
                # Получаем данные ссылок
                response = requests.get(
                    url,
                    auth=('root', 'guregure'),
                    headers={"Content-Type": "application/json"},
                    json={"command": links_query}
                )

                links_data = response.json()
                logger.info(f"Links data = {links_data}")

                if 'result' in links_data:
                    for node in links_data['result']:
                        if 'content' in node and '@rid' in node:
                            nodes_data.append({'id': node['@rid'], 'name': node['name'], 'content': node['content']})
                    logger.info(f"Found {len(nodes_data)} links.")
                    logger.info(nodes_data)
                else:
                    logger.error(f"Unexpected response format: {links_data}")

            except Exception as e:
                logger.error(f"Error fetching links: {e}")
                return JsonResponse({"error": "Failed to fetch links"}, status=500)

            # Возвращаем найденные документы и ссылки
            return JsonResponse({'result': nodes_data})
        else:
            logger.error("No answerID provided.")
            return JsonResponse({"error": "No answerID provided"}, status=400)


@require_http_methods(["GET"])
def get_latest_dialog(request, user_id):
    """Получение последнего диалога для заданного user_id."""
    try:
        # Получаем последний диалог для пользователя
        latest_dialog = Dialog.objects.filter(user_id=user_id).order_by('-started_at').first()

        if not latest_dialog:
            # Если диалогов нет, возвращаем ошибку
            return JsonResponse({
                "status": "error",
                "message": "No dialogs found for the given user."
            }, status=404)

        # Возвращаем информацию о последнем диалоге
        return JsonResponse({
            "status": "success",
            "dialog_id": latest_dialog.id,
            "started_at": latest_dialog.started_at
        }, status=200)

    except Exception as e:
        logger.error(f"Error while fetching latest dialog: {str(e)}")
        return JsonResponse({
            "status": "error",
            "message": "Internal server error."
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def create_dialog(request, user_id):
    """Создание нового диалога для пользователя."""
    try:
        user = ChatUser.objects.filter(id=user_id).first()
        if not user:
            return JsonResponse({
                "status": "error",
                "message": "User not found."
            }, status=404)

        dialog = Dialog.objects.create(user=user)

        return JsonResponse({
            "status": "success",
            "dialog_id": dialog.id,
            "started_at": dialog.started_at
        }, status=201)

    except Exception as e:
        logger.error(f"Error while creating dialog: {str(e)}")
        return JsonResponse({
            "status": "error",
            "message": "Internal server error."
        }, status=500)


def escape_sql_string(value):
    """Экранирование кавычек и специальных символов для OrientDB."""
    return value.replace("'", "\\'").replace('"', '\\"')


@csrf_exempt
def update_answer(request):
    """Обновление контента ответа в базе данных."""
    if request.method == 'POST':
        try:
            # Считываем и декодируем тело запроса
            raw_body = request.body
            logger.info(f"Raw request body: {raw_body}")

            # Декодируем JSON
            body = json.loads(raw_body.decode('utf-8'))
            logger.info(f"Parsed body: {body}")

            answer_id = body.get('answerID')
            content = body.get('content')
            logger.info(f"Answer ID: {answer_id}, Raw content: {content}")

            # Экранирование кавычек и других символов
            escaped_content = content.replace("\u200b", "").replace("\n", "\\n").replace("'", "''").strip()
            # Формируем запрос
            url = "http://localhost:2480/command/chat-bot-db/sql/"
            query = f"UPDATE answer SET content = '{escaped_content}' WHERE @rid = '{answer_id}'"
            logger.info(f"Sending query: {query}")

            # Отправка запроса
            response = requests.get(
                url,
                auth=('root', 'guregure'),
                headers={"Content-Type": "application/json; charset=utf-8"},
                json={"command": query},
            )

            logger.info(f"Response status: {response.status_code}.")

            # Обработка ответа
            if not response.ok:
                logger.warning(f"Answer not found for answerID: {answer_id}")
                return JsonResponse({"error": "Answer not found"}, status=404)
            else:
                return JsonResponse({"message": "Successfully updated"}, status=200)

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            return JsonResponse({'error': 'Invalid JSON format'}, status=400)
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return JsonResponse({'error': 'Internal server error'}, status=500)

    return JsonResponse({'error': 'Invalid request method'}, status=400)


@csrf_exempt
def update_question(request):
    if request.method == 'POST':
        try:
            # Считываем тело запроса
            raw_body = request.body
            logger.info(f"Raw request body: {raw_body}")

            # Декодируем JSON
            body = json.loads(raw_body.decode('utf-8'))
            logger.info(f"Parsed body: {body}")

            # Получаем параметры
            question_id = body.get('questionID')
            content = body.get('content')

            if not question_id or not content:
                logger.error("Missing required fields: 'questionID' or 'content'.")
                return JsonResponse({"error": "Missing required fields"}, status=400)

            logger.info(f"Question ID: {question_id}, Raw content: {content}")

            # Экранируем специальные символы
            escaped_content = content.replace("\u200b", "").replace("\n", "\\n").replace("'", "''").strip()

            # Формируем запрос
            url = "http://localhost:2480/command/chat-bot-db/sql/"
            query = f"UPDATE Question SET content = '{escaped_content}' WHERE @rid = '{question_id}'"
            logger.info(f"Sending query: {query}")

            # Отправляем запрос
            response = requests.get(
                url,
                auth=('root', 'guregure'),
                headers={"Content-Type": "application/json; charset=utf-8"},
                json={"command": query},
            )

            logger.info(f"Response status: {response.status_code}.")

            # Проверка успешности запроса
            if not response.ok:
                logger.warning(f"Question with ID {question_id} not found.")
                return JsonResponse({"error": "Question not found"}, status=404)
            else:
                return JsonResponse({"message": "Successfully updated question"}, status=200)

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            return JsonResponse({'error': 'Invalid JSON format'}, status=400)
        except requests.RequestException as e:
            logger.error(f"Request error: {e}")
            return JsonResponse({'error': 'Error sending request to database'}, status=500)
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return JsonResponse({'error': 'Internal server error'}, status=500)

    return JsonResponse({'error': 'Invalid request method'}, status=400)

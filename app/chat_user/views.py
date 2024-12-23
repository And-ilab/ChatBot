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
from chat_dashboard.models import Dialog, Message, ChatUser
from .models import ChatUser, Session
from urllib.parse import unquote


logger = logging.getLogger(__name__)


def user_chat(request):
    return render(request, 'user_chat/user_chat.html')

logger = logging.getLogger(__name__)

def chat_login(request):
    if request.method == "POST":
        try:
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

            # Создание JWT
            payload = {
                "user_id": user.id,
                "email": user.email,
                "exp": datetime.utcnow() + timedelta(minutes=30),  # Время истечения токена
            }
            session_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

            # Создание записи сессии в базе данных
            expires_at = datetime.utcnow() + timedelta(minutes=30)
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

    logger.warning("Attempted to access check_session with a non-GET request.")
    return JsonResponse({"status": "error", "message": "Метод не поддерживается"}, status=405)


@csrf_exempt
def extend_session(request):
    if request.method == "POST":
        session_token = request.headers.get("Authorization")

        if not session_token:
            logger.warning("Session token not provided.")
            return JsonResponse({"status": "error", "message": "Session token is required."}, status=400)

        try:
            session = Session.objects.get(session_token=session_token)
            logger.info(f"Session found for user: {session.user.email} with token: {session_token}")

            new_expires_at = now() + timedelta(minutes=30)
            session.expires_at = new_expires_at
            session.save()

            logger.info(f"Session for user {session.user.email} extended. New expiration: {new_expires_at}")

            return JsonResponse({
                "status": "success",
                "message": "Session extended successfully.",
                "new_expires_at": new_expires_at,
            })

        except Session.DoesNotExist:
            logger.error("Session not found with provided token.")
            return JsonResponse({
                "status": "error",
                "message": "Session not found. Please log in again."
            }, status=404)

    logger.warning("Attempted to access extend_session with a non-POST request.")
    return JsonResponse({"status": "error", "message": "Only POST method allowed."}, status=405)


def get_user_details(request, user_id):
    """Retrieve first_name and last_name of a user by their ID."""
    logger.info(f"Received request to fetch user details for user_id: {user_id}")

    try:
        user = ChatUser.objects.filter(id=user_id).first()

        if not user:
            logger.warning(f"User with ID {user_id} not found.")
            return JsonResponse({"status": "error", "message": "User not found."}, status=404)

        user_data = {
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
        logger.info(f"User details fetched successfully for user_id: {user_id}: {user_data}")
        return JsonResponse({"status": "success", "user": user_data}, status=200)

    except Exception as e:
        logger.error(f"Error occurred while fetching user details for user_id {user_id}: {str(e)}", exc_info=True)
        return JsonResponse({"status": "error", "message": "Internal server error."}, status=500)


def process_keywords(request):
    question = request.GET.get('question')

    # if not question:
    #     return JsonResponse({'error': 'No keywords provided'}, status=400)
    #
    # keywords = extract_keywords(question)
    #
    # query = """
    #     WITH $keywords AS keywords
    #     MATCH (p:Paragraph)-[:HAS_TERM]->(t:Term)
    #     WHERE t.name IN keywords
    #     WITH p, COUNT(t) AS relevance
    #     ORDER BY relevance DESC
    #     RETURN p.content, relevance
    #     LIMIT 1
    # """
    # logger.info("PRE-ENDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD")
    # try:
    #     # result, _ = db.cypher_query(query, {'keywords': keywords})
    #
    #     if result:
    #
    #         return JsonResponse({'content': result[0][0]})
    #     else:
    #
    #         return JsonResponse({'error': 'No relevant paragraph found'}, status=404)
    # except Exception as e:
    #
    #     logger.error(f"Error during query execution: {e}", exc_info=True)
    #     return JsonResponse({'error': 'Internal Server Error'}, status=500)


def get_dialog_and_username(request, user_id):
    """Fetches dialog and username for a given user ID. Creates a dialog if none exists."""
    if request.method != 'GET':
        logger.warning("Invalid HTTP method used. Only GET is allowed.")
        return JsonResponse({'error': 'Invalid HTTP method. Use GET instead.'}, status=405)

    logger.info(f"Fetching dialog and username for user ID: {user_id}")

    try:
        # Проверка существования пользователя
        user = User.objects.filter(id=user_id).first()
        if not user:
            logger.warning(f"User with ID {user_id} not found.")
            return JsonResponse({'error': 'User not found.'}, status=404)

        # Поиск или создание диалога
        dialog, created = Dialog.objects.get_or_create(user=user)
        if created:
            logger.info(f"Created new dialog for user ID: {user_id}")

        # Формирование данных ответа
        dialog_data = {
            'dialog_id': dialog.id,
            'username': user.username,
            'started_at': dialog.started_at,
        }

        logger.info(f"Successfully fetched dialog and username for user ID: {user_id}")
        return JsonResponse(dialog_data, status=200)

    except Exception as e:
        logger.exception("An unexpected error occurred while fetching or creating dialog and username.")
        return JsonResponse({'error': 'Internal server error. Please try again later.'}, status=500)


def get_nodes_by_type(request):
    """Fetch nodes of a specific type from the OrientDB database."""
    node_type = request.GET.get('type')
    logger.info(f"Fetching nodes of type: {node_type}")
    type = urllib.parse.unquote(node_type)
    url = f"http://localhost:2480/query/chat-bot-db/sql/SELECT FROM {type}"

    try:
        response = requests.get(url, auth=('root', 'gure'))

        if response.status_code == 200:
            logger.info(f"Successfully fetched data for type: {node_type}")

            try:
                logger.info(f"Response text: {response.text}")
                data = response.json()

                if 'result' in data:
                    nodes_data = []
                    for node in data['result']:
                        if 'content' in node and '@rid' in node:
                            nodes_data.append({'id': node['@rid'], 'name': node['content']})
                    logger.info(f"Found {len(nodes_data)} nodes.")
                    logger.info(nodes_data)
                    return JsonResponse({'result': nodes_data})
                else:
                    logger.error(f"Unexpected response format: {data}")

            except ValueError as e:
                logger.error(f"Error parsing JSON response: {e}")
        else:
            logger.error(f"Error fetching data: HTTP {response.status_code} - {response.text}")

    except requests.exceptions.RequestException as e:
        logger.error(f"Error with the request: {e}")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")


def get_nodes_by_type_with_relation(request):
    if request.method == 'GET':
        start_node_type = urllib.parse.unquote(request.GET.get('startNodeType'))
        start_node_name = urllib.parse.unquote(request.GET.get('startNodeName'))
        finish_node_type = urllib.parse.unquote(request.GET.get('finishNodeType'))

        if start_node_type and start_node_name and finish_node_type:
            logger.info(f"Fetching nodes with type of start node: {start_node_type}")

            # Формируем запрос с учётом кавычек вокруг start_node_name
            url = (f"http://localhost:2480/query/chat-bot-db/sql/SELECT FROM {finish_node_type} "
                   f"WHERE @rid IN (SELECT OUT('Includes') "
                   f"FROM (SELECT FROM {start_node_type} WHERE content = '{start_node_name}'))")

            try:
                response = requests.get(url, auth=('root', 'gure'))

                if not response.ok:
                    logger.warning("Base node not found.")
                    return JsonResponse([], safe=False, status=200)

                data = response.json()
                if 'result' in data:
                    nodes_data = []
                    for node in data['result']:
                        if 'content' in node and '@rid' in node:
                            nodes_data.append({'id': node['@rid'], 'name': node['content']})
                    logger.info(f"Found {len(nodes_data)} nodes.")
                    logger.info(nodes_data)
                    return JsonResponse({'result': nodes_data})
                else:
                    logger.error(f"Unexpected response format: {data}")

            except Exception as e:
                logger.error(f"Error fetching data: {e}")
                return JsonResponse({"error": "Failed to fetch data"}, status=500)


def get_answer(request):
    if request.method == 'GET':
        question_id = urllib.parse.unquote(request.GET.get('questionId'))

        if question_id:
            logger.info(f"Received questionId: {question_id}")
            url = (f"http://localhost:2480/command/chat-bot-db/sql/")
            query = f"SELECT FROM Answer WHERE @rid IN (SELECT OUT('Includes') FROM Question WHERE @rid = '{question_id}')"
            logger.info(f"Sending query: {url}")  # Логируем сформированный запрос

            try:
                response = requests.get(
                    url,
                    auth=('root', 'gure'),
                    headers={"Content-Type": "application/json"},
                    json={"command": query}
                )

                logger.info(f"Response status: {response.status_code}, Response text: {response.text}")

                if not response.ok:
                    logger.warning("Answer not found for the given answer ID.")
                    return JsonResponse({"error": "Answer not found"}, status=404)
                else:
                    data = response.json()
                    logger.info(f"Data = {data}")

                    if 'result' in data:
                        nodes_data = []
                        for node in data['result']:
                            if 'content' in node and '@rid' in node:
                                nodes_data.append({'id': node['@rid'], 'content': node['content']})
                        logger.info(f"Found {len(nodes_data)} nodes.")
                        logger.info(nodes_data)
                        return JsonResponse({'result': nodes_data})
                    else:
                        logger.error(f"Unexpected response format: {data}")

            except Exception as e:
                logger.error(f"Error fetching answer: {e}")
                return JsonResponse({"error": "Failed to fetch answer"}, status=500)
        else:
            logger.error("No questionId provided.")
            return JsonResponse({"error": "No questionId provided"}, status=400)


def get_documents(request):
    if request.method == 'GET':
        answer_id = urllib.parse.unquote(request.GET.get('answerID'))

        if answer_id:
            nodes_data = []
            logger.info(f"Received questionId: {answer_id}")
            url = (f"http://localhost:2480/command/chat-bot-db/sql/")
            documents_query = f"SELECT FROM document WHERE @rid IN (SELECT OUT('Includes') FROM Answer WHERE @rid = '{answer_id}')"
            logger.info(f"Sending documents query: {documents_query}")
            links_query = f"SELECT FROM link WHERE @rid IN (SELECT OUT('Includes') FROM Answer WHERE @rid = '{answer_id}')"
            logger.info(f"Sending links query: {links_query}")

            try:
                response = requests.get(
                    url,
                    auth=('root', 'gure'),
                    headers={"Content-Type": "application/json"},
                    json={"command": documents_query}
                )

                documents_data = response.json()
                logger.info(f"Documents data = {documents_data}")

                if 'result' in documents_data:
                    for node in documents_data['result']:
                        if 'content' in node and '@rid' in node:
                            nodes_data.append({'id': node['@rid'], 'name': node['name'], 'content': node['content']})
                    logger.info(f"Found {len(nodes_data)} nodes.")
                    logger.info(nodes_data)
                else:
                    logger.error(f"Unexpected response format: {documents_data}")

            except Exception as e:
                logger.error(f"Error fetching answer: {e}")
                return JsonResponse({"error": "Failed to fetch answer"}, status=500)

            try:
                response = requests.get(
                    url,
                    auth=('root', 'gure'),
                    headers={"Content-Type": "application/json"},
                    json={"command": links_query}
                )

                links_data = response.json()
                logger.info(f"Links data = {links_data}")

                if 'result' in links_data:
                    for node in links_data['result']:
                        if 'content' in node and '@rid' in node:
                            nodes_data.append({'id': node['@rid'], 'name': node['name'], 'content': node['content']})
                    logger.info(f"Found {len(nodes_data)} nodes.")
                    logger.info(nodes_data)
                else:
                    logger.error(f"Unexpected response format: {links_data}")

            except Exception as e:
                logger.error(f"Error fetching answer: {e}")
                return JsonResponse({"error": "Failed to fetch answer"}, status=500)

            return JsonResponse({'result': nodes_data})
        else:
            logger.error("No questionId provided.")
            return JsonResponse({"error": "No questionId provided"}, status=400)


@require_http_methods(["GET"])
def get_latest_dialog(request, user_id):
    try:
        latest_dialog = Dialog.objects.filter(user_id=user_id).order_by('-started_at').first()

        if not latest_dialog:
            return JsonResponse({
                "status": "error",
                "message": "No dialogs found for the given user."
            }, status=404)

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
    """Экранировать кавычки и специальные символы для OrientDB."""
    return value.replace("'", "\\'").replace('"', '\\"')



@csrf_exempt
def update_answer(request):
    if request.method == 'POST':
        try:
            # Считываем тело запроса и явно декодируем
            raw_body = request.body
            logger.info(f"Raw request body: {raw_body}")

            # Явное указание кодировки
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

            response = requests.get(
                url,
                auth=('root', 'gure'),
                headers={"Content-Type": "application/json; charset=utf-8"},
                json={"command": query},
            )

            logger.info(f"Response status: {response.status_code}, Response text: {response.text}")

            if not response.ok:
                logger.warning("Answer not found for the given answer ID.")
                return JsonResponse({"error": "Answer not found"}, status=404)
            else:
                return JsonResponse({"message": "Successful"}, status=200)

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            return JsonResponse({'error': 'Invalid JSON format'}, status=400)
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'Invalid request method'}, status=400)


@csrf_exempt
def update_question(request):
    if request.method == 'POST':
        try:
            raw_body = request.body
            logger.info(f"Raw request body: {raw_body}")

            # Явное указание кодировки
            body = json.loads(raw_body.decode('utf-8'))
            logger.info(f"Parsed body: {body}")

            question_id = body.get('questionID')
            content = body.get('content')
            logger.info(f"Question ID: {question_id}, Raw content: {content}")

            escaped_content = content.replace("\u200b", "").replace("\n", "\\n").replace("'", "''").strip()
            url = "http://localhost:2480/command/chat-bot-db/sql/"
            query = f"UPDATE Question SET content = '{escaped_content}' WHERE @rid = '{question_id}'"
            logger.info(f"Sending query: {query}")

            response = requests.get(
                url,
                auth=('root', 'gure'),
                headers={"Content-Type": "application/json; charset=utf-8"},
                json={"command": query},
            )

            logger.info(f"Response status: {response.status_code}, Response text: {response.text}")

            if not response.ok:
                logger.warning("Answer not found for the given answer ID.")
                return JsonResponse({"error": "Answer not found"}, status=404)
            else:
                return JsonResponse({"message": "Successful"}, status=200)

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            return JsonResponse({'error': 'Invalid JSON format'}, status=400)
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'Invalid request method'}, status=400)
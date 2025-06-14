import urllib
import jwt
import logging
import requests
import json
import re
from datetime import datetime, timedelta, timezone
from django.shortcuts import render, get_object_or_404
from django.utils.timezone import make_aware, now
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.clickjacking import xframe_options_exempt
from django.http import JsonResponse
from django.conf import settings
from chat_dashboard.models import Dialog, Message, Settings, TrainingMessage, PopularRequests
from chat_dashboard.views import log_action
from .models import ChatUser, Session, Feedbacks
from .serializers import FeedbackSerializer
from urllib.parse import unquote
from config import config_settings
from rest_framework import status, generics
from rest_framework.decorators import api_view
from rest_framework.response import Response
# import re
# from pymorphy3 import MorphAnalyzer
# import spacy
# from .nn_model_loader import nn_model_instance

# nlp = spacy.load("ru_core_news_sm")
# morph = MorphAnalyzer()
# custom_stop_words = {"может", "могут", "какой", "какая", "какое", "какие", "что", "кто", "где", "когда", "зачем",
#                      "почему"}


logger = logging.getLogger('chat_user')

@xframe_options_exempt
def embed_script(request):
    return render(request, 'user_chat/embed.js', {
        'static_url': settings.PROD_SITE_URL + settings.STATIC_URL, 
        'chat_server_url': settings.PROD_SITE_URL  
    }, content_type='application/javascript')
    return render(request, 'user_chat/embed.js', context, content_type='application/javascript')


@csrf_exempt
def user_chat(request):
    logger.info("Rendering user chat page.")
    return render(request, 'user_chat/user_chat.html')

@csrf_exempt
def user_chat_widget(request):
    logger.info("Rendering user chat widget.")
    return render(request, 'user_chat/widget.html')


@csrf_exempt
def chat_login(request):
    if request.method != "POST":
        logger.warning("Attempted to access chat_login with a non-POST request.")
        return JsonResponse({"status": "error", "message": "Only POST method allowed."}, status=405)

    try:
        try:
            data = json.loads(request.body.decode('utf-8'))
            first_name = data.get("first_name", "").strip()
            last_name = data.get("last_name", "").strip()
            email = data.get("email", "").strip().lower()

            if not all([first_name, last_name, email]):
                raise ValueError("Missing required fields")

            logger.info(f"Received login request for email: {email}")

        except (KeyError, ValueError, json.JSONDecodeError) as e:
            logger.error(f"Invalid request data: {str(e)}")
            return JsonResponse({
                "status": "error",
                "message": "Invalid data. Please provide first_name, last_name and email."
            }, status=400)

        try:
            user, created = ChatUser.objects.get_or_create(
                email=email,
                defaults={"first_name": first_name, "last_name": last_name}
            )

            settings_obj = Settings.objects.first()
            if not settings_obj:
                raise ValueError("Settings not configured")

            session_duration = settings_obj.session_duration

            payload = {
                "user_id": user.id,
                "email": user.email,
                "exp": datetime.now(timezone.utc) + timedelta(minutes=session_duration),
            }


            session_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
            if isinstance(session_token, bytes):
                session_token = session_token.decode('utf-8')

            expires_at = datetime.now(timezone.utc) + timedelta(minutes=session_duration)
            Session.objects.create(
                user=user,
                session_token=session_token,
                expires_at=expires_at
            )

            response_data = {
                "status": "success",
                "message": "User logged in successfully.",
                "session_token": session_token
            }

            response = JsonResponse(response_data)
            return response

        except Exception as e:
            logger.error(f"Server error during login: {str(e)}", exc_info=True)
            return JsonResponse({
                "status": "error",
                "message": "Internal server error"
            }, status=500)

    except Exception as e:
        logger.critical(f"Unexpected error in chat_login: {str(e)}", exc_info=True)
        return JsonResponse({
            "status": "error",
            "message": "Critical server error"
        }, status=500)

@csrf_exempt
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
                logger.warning(f"Session for user {session.user.email} need be expired or create a new one.")
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


def get_neural_status(request):
    try:
        # Получаем первый (и обычно единственный) объект настроек
        settings = Settings.objects.first()

        if settings:
            # Возвращаем статус нейросетевой модели
            return JsonResponse({
                'status': 'success',
                'neural_active': settings.neural_active
            })
        else:
            return JsonResponse({
                'status': 'error',
                'message': 'Настройки не найдены'
            }, status=404)

    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

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

@csrf_exempt
def close_session(request):
    """
    Устанавливает expires_at на текущее время для закрытия сессии.
    """
    if request.method != "POST":
        logger.warning("Attempted to access close_session with a non-POST request.")
        return JsonResponse({"status": "error", "message": "Only POST method allowed."}, status=405)

    session_token = request.headers.get("Authorization")
    if not session_token:
        logger.info("Session token not provided.")
        return JsonResponse({"status": "error", "message": "Session token is required."}, status=400)

    try:
        session = Session.objects.get(session_token=session_token)
        logger.info(f"Session found for user: {session.user.email} with token: {session_token}")

        session.expires_at = now()
        session.save()

        logger.info(f"Session for user {session.user.email} marked as closed.")

        return JsonResponse({
            "status": "success",
            "message": "Session closed successfully.",
        })

    except Session.DoesNotExist:
        logger.error("Session not found with provided token.")
        return JsonResponse({
            "status": "error",
            "message": "Session not found."
        }, status=404)

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return JsonResponse({
            "status": "error",
            "message": "An unexpected error occurred."
        }, status=500)

@csrf_exempt
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
    """Fetch nodes of a specific type from the OrientDB database with validation and safety."""

    if request.method != 'GET':
        logger.warning(f"Invalid request method: {request.method}")
        return JsonResponse({
            "status": "error",
            "message": "Only GET method is supported"
        }, status=405)

    node_type = request.GET.get('type', '').strip()
    if not node_type:
        logger.warning("Node type parameter missing")
        return JsonResponse({
            "status": "error",
            "message": "Node type parameter is required"
        }, status=400)

    try:
        # Validate and sanitize node_type (must be a valid class name in OrientDB)
        node_type = urllib.parse.unquote(node_type)
        if not re.fullmatch(r'^[a-zA-Z_][a-zA-Z0-9_]*$', node_type):
            logger.error(f"Invalid node type format: {node_type}")
            return JsonResponse({
                "status": "error",
                "message": "Invalid node type format"
            }, status=400)

        query = f"SELECT FROM {node_type} LIMIT 1000"

        response = requests.post(
            config_settings.ORIENT_COMMAND_URL,
            auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
            headers={'Content-Type': 'application/json'},
            json={"command": query},
            proxies={"http": None, "https": None}
        )

        if response.status_code != 200:
            logger.error(f"Database error: {response.status_code} - {response.text}")
            return JsonResponse({
                "status": "error",
                "message": "Error fetching data from database"
            }, status=500)

        try:
            data = response.json()
        except ValueError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return JsonResponse({
                "status": "error",
                "message": "Error decoding database response"
            }, status=500)

        results = data.get('result')
        if not isinstance(results, list):
            logger.error("Invalid response format: expected 'result' as list")
            return JsonResponse({
                "status": "error",
                "message": "Invalid database response format"
            }, status=500)

        # Process nodes
        nodes_data = []
        for node in results:
            try:
                if isinstance(node, dict) and '@rid' in node:
                    node_data = {
                        'id': node['@rid'],
                        'name': node.get('content', '')
                    }
                    nodes_data.append(node_data)
            except Exception as e:
                logger.warning(f"Error processing node: {str(e)}")
                continue

        # Optional custom sorting by predefined names
        custom_order = [
            "Организационно-кадровая работа",
            "Оказание материальной помощи и оплата труда",
            "Обучение, тестирование, практика",
            "Вопросы для психологов",
            "Образцы заявлений"
        ]

        nodes_data.sort(
            key=lambda x: custom_order.index(x['name']) if x.get('name') in custom_order else len(custom_order)
        )

        logger.info(f"Returning {len(nodes_data)} nodes of type {node_type}")
        return JsonResponse({
            'status': 'success',
            'count': len(nodes_data),
            'result': nodes_data
        }, status=200)

    except requests.RequestException as e:
        logger.error(f"Database connection error: {str(e)}")
        return JsonResponse({
            "status": "error",
            "message": "Database connection error"
        }, status=500)

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return JsonResponse({
            "status": "error",
            "message": "Internal server error"
        }, status=500)


def get_nodes_by_type_with_relation(request):
    """Fetch nodes of a specific type related to another node type with security protections."""
    if request.method != 'GET':
        logger.warning(f"Invalid request method: {request.method}")
        return JsonResponse({
            "status": "error",
            "message": "Only GET method is supported"
        }, status=405)

    try:
        # Validate and decode parameters
        start_node_type = urllib.parse.unquote(request.GET.get('startNodeType', ''))
        start_node_name = urllib.parse.unquote(request.GET.get('startNodeName', ''))
        finish_node_type = urllib.parse.unquote(request.GET.get('finishNodeType', ''))

        # Validate required parameters
        if not all([start_node_type, start_node_name, finish_node_type]):
            logger.warning("Missing required parameters")
            return JsonResponse({
                "status": "error",
                "message": "startNodeType, startNodeName and finishNodeType are required"
            }, status=400)

        # Validate node type formats
        if not all(re.fullmatch(r'^[a-zA-Z_][a-zA-Z0-9_]*$', t) for t in [start_node_type, finish_node_type]):
            logger.error(f"Invalid node type format: {start_node_type} or {finish_node_type}")
            return JsonResponse({
                "status": "error",
                "message": "Invalid node type format"
            }, status=400)

        # Use parameterized query
        query = """
            SELECT FROM :finish_node_type 
            WHERE @rid IN (
                SELECT OUT('Includes') 
                FROM (
                    SELECT FROM :start_node_type 
                    WHERE content = :start_node_name
                )
            )
        """

        response = requests.post(
            config_settings.ORIENT_COMMAND_URL,
            auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
            headers={'Content-Type': 'application/json'},
            json={
                "command": query,
                "parameters": {
                    "start_node_type": start_node_type,
                    "finish_node_type": finish_node_type,
                    "start_node_name": start_node_name
                },
                "limit": 1000  # Prevent excessive results
            }
        )

        if not response.ok:
            logger.error(f"Database error: {response.status_code} - {response.text}")
            return JsonResponse({
                "status": "error",
                "message": "Database operation failed"
            }, status=500)

        try:
            data = response.json()
            nodes_data = []

            if isinstance(data.get('result'), list):
                for node in data['result']:
                    if isinstance(node, dict) and '@rid' in node:
                        nodes_data.append({
                            'id': node['@rid'],
                            'name': node.get('content', '')
                        })

                logger.info(f"Found {len(nodes_data)} related nodes")
                return JsonResponse({
                    "status": "success",
                    "count": len(nodes_data),
                    "result": nodes_data
                })

            return JsonResponse({
                "status": "success",
                "count": 0,
                "result": []
            })

        except ValueError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return JsonResponse({
                "status": "error",
                "message": "Error processing database response"
            }, status=500)

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return JsonResponse({
            "status": "error",
            "message": "Internal server error"
        }, status=500)

def get_all_questions(request):
    """Fetch all nodes of type 'question' from OrientDB."""
    if request.method == 'GET':
        logger.info("Fetching all nodes of type 'question'.")
        url = f"{config_settings.ORIENT_QUERY_URL}/SELECT * FROM question LIMIT -1"

        try:
            response = requests.get(
                url,
                auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
                headers={"Accept": "application/json"})
            if not response.ok:
                logger.warning("Failed to fetch data from OrientDB.")
                return JsonResponse([], safe=False, status=200)

            data = response.json()
            if 'result' in data:
                questions_data = []
                for question in data['result']:
                    if 'content' in question and '@rid' in question:
                        questions_data.append({
                            'id': question['@rid'],
                            'content': question['content']
                        })

                logger.info(f"Found {len(questions_data)} questions.")
                return JsonResponse({'result': questions_data}, safe=False)
            else:
                logger.error("Unexpected response format.")
                return JsonResponse({"error": "Unexpected response format"}, status=500)

        except Exception as e:
            logger.error(f"Error fetching data: {e}")
            return JsonResponse({"error": "Failed to fetch data"}, status=500)


def get_all_topics(request):
    """Fetch all nodes of type 'question' from OrientDB."""
    if request.method == 'GET':
        logger.info("Fetching all nodes of type 'question'.")
        url = f"{config_settings.ORIENT_QUERY_URL}/SELECT * FROM Topic LIMIT -1"

        try:
            response = requests.get(
                url,
                auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
                headers={"Accept": "application/json"})
            if not response.ok:
                logger.warning("Failed to fetch data from OrientDB.")
                return JsonResponse([], safe=False, status=200)

            data = response.json()
            if 'result' in data:
                questions_data = []
                for question in data['result']:
                    if 'content' in question and '@rid' in question:
                        questions_data.append({
                            'id': question['@rid'],
                            'content': question['content']
                        })

                logger.info(f"Found {len(questions_data)} questions.")
                return JsonResponse({'result': questions_data}, safe=False)
            else:
                logger.error("Unexpected response format.")
                return JsonResponse({"error": "Unexpected response format"}, status=500)

        except Exception as e:
            logger.error(f"Error fetching data: {e}")
            return JsonResponse({"error": "Failed to fetch data"}, status=500)


def get_question_id_by_content(request):
    """Fetch question ID for a specific question content with security protections."""
    if request.method != 'GET':
        logger.warning(f"Invalid request method: {request.method}")
        return JsonResponse({
            "status": "error",
            "message": "Only GET method is supported"
        }, status=405)

    try:
        question_content = urllib.parse.unquote(request.GET.get('questionContent', ''))

        if not question_content:
            logger.error("No questionContent provided")
            return JsonResponse({
                "status": "error",
                "message": "questionContent parameter is required"
            }, status=400)

        logger.info(f"Searching question ID for content: [REDACTED]")  # Don't log full content

        # Use parameterized query
        response = requests.post(
            config_settings.ORIENT_COMMAND_URL,
            auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
            headers={"Content-Type": "application/json"},
            json={
                "command": "SELECT @rid FROM Question WHERE content = :content LIMIT 1",
                "parameters": {
                    "content": question_content
                }
            }
        )

        if not response.ok:
            logger.error(f"Database error: {response.status_code}")
            return JsonResponse({
                "status": "error",
                "message": "Database operation failed"
            }, status=500)

        try:
            data = response.json()
            if not isinstance(data.get('result'), list):
                logger.error("Invalid response format from database")
                return JsonResponse({
                    "status": "error",
                    "message": "Invalid database response format"
                }, status=500)

            if not data['result']:
                logger.info("Question not found")
                return JsonResponse({
                    "status": "success",
                    "result": None,
                    "message": "Question not found"
                }, status=200)

            question_id = data['result'][0].get('@rid')
            if not question_id:
                logger.error("Question ID not found in response")
                return JsonResponse({
                    "status": "error",
                    "message": "Invalid question data format"
                }, status=500)

            logger.info("Question ID found successfully")
            return JsonResponse({
                "status": "success",
                "result": question_id
            })

        except ValueError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return JsonResponse({
                "status": "error",
                "message": "Error processing database response"
            }, status=500)

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return JsonResponse({
            "status": "error",
            "message": "Internal server error"
        }, status=500)


def get_answer(request):
    """Fetch answer for a specific question ID with protection against SQL injection."""
    if request.method != 'GET':
        logger.warning(f"Invalid request method: {request.method}")
        return JsonResponse({
            "status": "error",
            "message": "Only GET method is supported"
        }, status=405)

    try:
        question_id = urllib.parse.unquote(request.GET.get('questionId', ''))

        if not question_id:
            logger.error("No questionId provided.")
            return JsonResponse({
                "status": "error",
                "message": "questionId parameter is required"
            }, status=400)

        logger.info("Received questionId [REDACTED]")  # Не логируем ID напрямую

        # Используем параметризованный запрос
        query = """
            SELECT FROM Answer 
            WHERE @rid IN (
                SELECT OUT('Includes') 
                FROM Question 
                WHERE @rid = :question_id
            )
        """

        response = requests.post(
            config_settings.ORIENT_COMMAND_URL,
            auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
            headers={"Content-Type": "application/json"},
            json={
                "command": query,
                "parameters": {
                    "question_id": question_id
                }
            }
        )

        logger.info(f"Response status: {response.status_code}")

        if not response.ok:
            logger.warning("Answer not found for the given question ID.")
            return JsonResponse({"error": "Answer not found"}, status=404)

        data = response.json()
        logger.info("Data received from DB")

        if 'result' not in data or not isinstance(data['result'], list):
            logger.error("Invalid response format from database")
            return JsonResponse({"error": "Invalid database response"}, status=500)

        nodes_data = []
        for node in data['result']:
            if 'content' in node and '@rid' in node:
                nodes_data.append({'id': node['@rid'], 'content': node['content']})

        logger.info(f"Found {len(nodes_data)} answer(s)")
        return JsonResponse({'result': nodes_data})

    except Exception as e:
        logger.error(f"Error fetching answer: {str(e)}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)



def get_artifacts(request):
    """Получение документов и ссылок, связанных с ответом по заданному ID (безопасно)."""
    if request.method != 'GET':
        logger.warning(f"Invalid request method: {request.method}")
        return JsonResponse({"error": "Only GET method is supported"}, status=405)

    answer_id = urllib.parse.unquote(request.GET.get('answerID', ''))
    if not answer_id:
        logger.error("No answerID provided.")
        return JsonResponse({"error": "No answerID provided"}, status=400)

    nodes_data = []
    logger.info("Fetching artifacts for answerID: [REDACTED]")  # answer_id не логируем

    try:
        # Получаем документы
        response_docs = requests.post(
            config_settings.ORIENT_COMMAND_URL,
            auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
            headers={"Content-Type": "application/json"},
            json={
                "command": "SELECT FROM document WHERE @rid IN (SELECT OUT('Includes') FROM Answer WHERE @rid = :answer_id)",
                "parameters": {"answer_id": answer_id}
            }
        )

        if response_docs.ok:
            documents_data = response_docs.json()
            logger.info("Documents fetched successfully")

            if 'result' in documents_data:
                for node in documents_data['result']:
                    if '@rid' in node:
                        entry = {
                            'id': node['@rid'],
                            'name': node.get('name', ''),
                            'content': node.get('content', ''),
                            'type': 'document'
                        }
                        if 'uuid' in node:
                            entry['uuid'] = node['uuid']
                        nodes_data.append(entry)
                logger.info(f"Found {len(nodes_data)} documents.")
        else:
            logger.error("Failed to fetch documents")
            return JsonResponse({"error": "Failed to fetch documents"}, status=500)

    except Exception as e:
        logger.error(f"Error fetching documents: {e}", exc_info=True)
        return JsonResponse({"error": "Failed to fetch documents"}, status=500)

    try:
        # Получаем ссылки
        response_links = requests.post(
            config_settings.ORIENT_COMMAND_URL,
            auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
            headers={"Content-Type": "application/json"},
            json={
                "command": "SELECT FROM link WHERE @rid IN (SELECT OUT('Includes') FROM Answer WHERE @rid = :answer_id)",
                "parameters": {"answer_id": answer_id}
            }
        )

        if response_links.ok:
            links_data = response_links.json()
            logger.info("Links fetched successfully")

            if 'result' in links_data:
                for node in links_data['result']:
                    if '@rid' in node:
                        nodes_data.append({
                            'id': node['@rid'],
                            'name': node.get('name', ''),
                            'content': node.get('content', ''),
                            'type': 'link'
                        })
                logger.info(f"Found {len(nodes_data)} links.")
        else:
            logger.error("Failed to fetch links")
            return JsonResponse({"error": "Failed to fetch links"}, status=500)

    except Exception as e:
        logger.error(f"Error fetching links: {e}", exc_info=True)
        return JsonResponse({"error": "Failed to fetch links"}, status=500)

    return JsonResponse({'result': nodes_data})

def get_artifact_by_id(request):
    """Безопасное получение одного артефакта (документа или ссылки) по ID."""
    if request.method != 'GET':
        logger.warning(f"Invalid request method: {request.method}")
        return JsonResponse({"error": "Only GET method is supported"}, status=405)

    artifact_type = urllib.parse.unquote(request.GET.get('artifactType', ''))
    artifact_id = urllib.parse.unquote(request.GET.get('artifactID', ''))

    if not artifact_type or not artifact_id:
        logger.error("Missing artifactType or artifactID.")
        return JsonResponse({"error": "Missing artifactType or artifactID"}, status=400)

    if artifact_type == 'link':
        query = "SELECT FROM link WHERE @rid = :artifact_id"
    else:
        query = "SELECT FROM document WHERE @rid = :artifact_id"

    try:
        response = requests.post(
            config_settings.ORIENT_COMMAND_URL,
            auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
            headers={"Content-Type": "application/json"},
            json={
                "command": query,
                "parameters": {"artifact_id": artifact_id}
            }
        )

        if not response.ok:
            logger.error(f"OrientDB returned HTTP error: {response.status_code}")
            return JsonResponse({"error": "Failed to fetch artifact"}, status=500)

        data = response.json()

        if 'result' in data and data['result']:
            node = data['result'][0]
            return JsonResponse({
                'status': 200,
                'result': {
                    'id': node.get('@rid'),
                    'name': node.get('name', ''),
                    'content': node.get('content', ''),
                    'type': artifact_type
                }
            })
        else:
            logger.warning(f"No artifact found with ID: {artifact_id}")
            return JsonResponse({"error": "Artifact not found"}, status=404)

    except Exception as e:
        logger.error(f"Error fetching artifact: {e}", exc_info=True)
        return JsonResponse({"error": "Failed to fetch artifact"}, status=500)



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
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request method'}, status=405)

    try:
        body = json.loads(request.body.decode('utf-8'))
        question_id = body.get('questionID')
        content = body.get('content')

        if not question_id:
            return JsonResponse({"error": "questionID is required"}, status=400)
        if not content or not content.strip():
            return JsonResponse({"error": "Content cannot be empty"}, status=400)

        clean_content = content.replace("\u200b", "").strip()

        # 1. Проверка: существует ли уже ответ на этот вопрос
        check_query = """
        SELECT FROM answer WHERE IN('Includes').@rid = :question_id LIMIT 1
        """
        check_response = requests.post(
            config_settings.ORIENT_COMMAND_URL,
            auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
            headers={"Content-Type": "application/json; charset=utf-8"},
            json={
                "command": check_query,
                "parameters": {"question_id": question_id}
            },
        )

        if not check_response.ok:
            logger.error(f"Check answer failed: {check_response.text}")
            return JsonResponse({"error": "Failed to check existing answer"}, status=500)

        result = check_response.json().get('result', [])

        # 2. Если ответ существует — обновляем
        if result:
            answer_id = result[0]['@rid']
            update_query = """
            UPDATE answer SET content = :content WHERE @rid = :answer_id
            """
            update_response = requests.post(
                config_settings.ORIENT_COMMAND_URL,
                auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
                headers={"Content-Type": "application/json; charset=utf-8"},
                json={
                    "command": update_query,
                    "parameters": {"content": clean_content, "answer_id": answer_id}
                },
            )

            if update_response.ok:
                log_action(f"Редактирование ответа: {clean_content}")
                return JsonResponse({
                    "message": "Answer updated successfully",
                    "answerID": answer_id
                }, status=200)
            else:
                logger.error(f"Update failed: {update_response.text}")
                return JsonResponse({"error": "Failed to update answer"}, status=500)

        # 3. Ответа нет — создаем новый
        create_node_query = """
        INSERT INTO answer SET content = :content RETURN @rid
        """
        create_node_response = requests.post(
            config_settings.ORIENT_COMMAND_URL,
            auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
            headers={"Content-Type": "application/json; charset=utf-8"},
            json={
                "command": create_node_query,
                "parameters": {"content": clean_content}
            },
        )

        if not create_node_response.ok:
            logger.error(f"Create answer node failed: {create_node_response.text}")
            return JsonResponse({"error": "Failed to create answer node"}, status=500)

        new_answer_id = create_node_response.json().get('result', [{}])[0].get('@rid')
        if not new_answer_id:
            return JsonResponse({"error": "Failed to retrieve new answer ID"}, status=500)

        # 4. Создаем связь с вопросом
        create_relation_query = """
        CREATE EDGE Includes FROM :question_id TO :answer_id
        """
        create_relation_response = requests.post(
            config_settings.ORIENT_COMMAND_URL,
            auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
            headers={"Content-Type": "application/json; charset=utf-8"},
            json={
                "command": create_relation_query,
                "parameters": {"question_id": question_id, "answer_id": new_answer_id}
            },
        )

        if create_relation_response.ok:
            return JsonResponse({
                "message": "New answer created successfully",
                "answerID": new_answer_id
            }, status=201)
        else:
            logger.error(f"Create relation failed: {create_relation_response.text}")
            return JsonResponse({"error": "Failed to create relation"}, status=500)

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return JsonResponse({'error': 'Invalid JSON format'}, status=400)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return JsonResponse({'error': 'Internal server error'}, status=500)



@csrf_exempt
def update_section(request):
    if request.method == 'POST':
        try:
            raw_body = request.body
            logger.info(f"Raw request body: {raw_body}")
            body = json.loads(raw_body.decode('utf-8'))
            logger.info(f"Parsed body: {body}")
            section_id = body.get('sectionID')
            content = body.get('content')
            logger.info(f"Section ID: {section_id}, Raw content: {content}")

            escaped_content = content.replace("\u200b", "").replace("\n", "\\n").replace("'", "''").strip()
            query = f"UPDATE Section SET content = '{escaped_content}' WHERE @rid = '{section_id}'"

            response = requests.get(
                config_settings.ORIENT_COMMAND_URL,
                auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
                headers={"Content-Type": "application/json; charset=utf-8"},
                json={"command": query},
            )

            logger.info(f"Response status: {response.status_code}.")

            if not response.ok:
                log_action(f"Ошибка изменения навания секции {section_id}.")
                logger.warning(f"Section not found for sectionID: {answer_id}")
                return JsonResponse({"error": "Section not found"}, status=404)
            else:
                log_action(f"Изменение навания секции {section_id} на {content}.")
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
            query = f"UPDATE Question SET content = '{escaped_content}' WHERE @rid = '{question_id}'"

            # Отправляем запрос
            response = requests.get(
                config_settings.ORIENT_COMMAND_URL,
                auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
                headers={"Content-Type": "application/json; charset=utf-8"},
                json={"command": query},
            )

            logger.info(f"Response status: {response.status_code}.")

            # Проверка успешности запроса
            if not response.ok:
                log_action(f"Ошибка изменения навания вопроса {question_id}.")
                logger.warning(f"Question with ID {question_id} not found.")
                return JsonResponse({"error": "Question not found"}, status=404)
            else:
                log_action(f"Изменение навания вопроса {question_id} на {content}.")
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

@csrf_exempt
def update_topic(request):
    if request.method == 'POST':
        try:
            raw_body = request.body
            logger.info(f"Raw request body: {raw_body}")
            body = json.loads(raw_body.decode('utf-8'))
            logger.info(f"Parsed body: {body}")
            topic_id = body.get('topicID')
            content = body.get('content')

            if not topic_id or not content:
                logger.error("Missing required fields: 'questionID' or 'content'.")
                return JsonResponse({"error": "Missing required fields"}, status=400)

            logger.info(f"Topic ID: {topic_id}, Raw content: {content}")
            escaped_content = content.replace("\u200b", "").replace("\n", "\\n").replace("'", "''").strip()

            query = f"UPDATE Topic SET content = '{escaped_content}' WHERE @rid = '{topic_id}'"

            response = requests.get(
                config_settings.ORIENT_COMMAND_URL,
                auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
                headers={"Content-Type": "application/json; charset=utf-8"},
                json={"command": query},
            )

            logger.info(f"Response status: {response.status_code}.")

            if not response.ok:
                log_action(f"Ошибка изменения навания темы {topic_id}.")
                logger.warning(f"Topic with ID {topic_id} not found.")
                return JsonResponse({"error": "Topic not found"}, status=404)
            else:
                log_action(f"Изменение навания темы {topic_id} на {content}.")
                return JsonResponse({"message": "Successfully updated topic"}, status=200)

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

@csrf_exempt
def recognize_question(request):
    if request.method == 'POST':
        try:
            raw_body = request.body
            logger.info(f"Raw request body: {raw_body}")
            body = json.loads(raw_body.decode('utf-8'))
            logger.info(f"Parsed body: {body}")

            if 'message' not in body:
                logger.error("Missing 'message' key in request body")
                return JsonResponse({'error': "Missing 'message' key in request body"}, status=400)

            message = body['message']
            logger.info(f"Message to process: {message}")

            # recognized_question = settings.QUESTION_MATCHER.match_question(message)
            # return JsonResponse({'recognized_question': recognized_question})
            return JsonResponse({'recognized_question': ''})

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            return JsonResponse({'error': 'Invalid JSON format'}, status=400)

        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return JsonResponse({'error': 'Internal server error'}, status=500)

    logger.warning("Invalid request method")
    return JsonResponse({'error': 'Invalid request method'}, status=400)

@csrf_exempt
@api_view(["POST"])
def add_feedback(request):
    serializer = FeedbackSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class FeedbacksList(generics.ListAPIView):
    queryset = Feedbacks.objects.all()
    serializer_class = FeedbackSerializer


@api_view(["GET"])
def session_data(request):
    logger.info("Fetching session data.")

    sessions = Session.objects.values('user', 'expires_at')

    response_data = [
        {'user': session['user'], 'created_at': session['expires_at']}
        for session in sessions
    ]

    logger.debug(f"Formatted session data: {response_data}")
    return JsonResponse(response_data, safe=False)


@api_view(["GET"])
def refused_data(request):
    logger.info("Fetching refused messages data.")

    refused_messages = TrainingMessage.objects.values('sender', 'created_at')

    response_data = [
        {'user': message['sender'], 'created_at': message['created_at']}
        for message in refused_messages
    ]

    logger.debug(f"Formatted refused messages data: {response_data}")
    return JsonResponse(response_data, safe=False)


@api_view(["GET"])
def popular_requests_data(request):
    logger.info("Fetching popular requests data.")

    popular_requests = PopularRequests.objects.values('sender', 'type', 'created_at')

    response_data = [
        {'user': req['sender'], 'type': req['type'], 'created_at': req['created_at']}
        for req in popular_requests
    ]

    logger.debug(f"Formatted popular requests data: {response_data}")
    return JsonResponse(response_data, safe=False)


@csrf_exempt
def add_popular_request(request):
    if request.method == 'POST':
        try:
            raw_body = request.body
            logger.info(f"Raw request body: {raw_body}")

            body = json.loads(raw_body.decode('utf-8'))
            logger.info(f"Parsed body: {body}")

            sender_id = body.get('sender_id')
            request_type = body.get('type')

            if not request_type:
                return JsonResponse({'error': 'Field "type" is required'}, status=400)

            sender = None
            if sender_id:
                sender = ChatUser.objects.filter(id=sender_id).first()

            popular_request = PopularRequests.objects.create(
                sender=sender,
                type=request_type
            )

            return JsonResponse({
                'id': popular_request.id,
                'sender_id': sender.id if sender else None,
                'type': popular_request.type,
                'created_at': popular_request.created_at.isoformat()
            }, status=201)

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            return JsonResponse({'error': 'Invalid JSON format'}, status=400)

        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return JsonResponse({'error': 'Internal server error'}, status=500)

    logger.warning("Invalid request method")
    return JsonResponse({'error': 'Invalid request method'}, status=400)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_last_chat_message(request, dialog_id):
    try:
        last_message = Message.objects.filter(dialog_id=dialog_id).latest('created_at')
        last_message.delete()
        return JsonResponse({"status": "success", "message": "Last message deleted successfully."})
    except Message.DoesNotExist:
        return JsonResponse({"status": "error", "message": "No messages found."}, status=404)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

@csrf_exempt
def get_section_by_question(request):
    if request.method != 'GET':
        logger.warning("Invalid request method for section lookup")
        return JsonResponse({"error": "Method not allowed"}, status=405)

    question_id = urllib.parse.unquote(request.GET.get('questionID', '')).strip()
    logger.info(f"Received questionID: {question_id}")

    if not question_id:
        logger.warning("Missing questionID parameter")
        return JsonResponse({"error": "questionID parameter is required"}, status=400)

    try:
        # Валидация формата question_id (#12:0 и т.д.)
        if not re.fullmatch(r'^#\d+:\d+$', question_id):
            logger.warning(f"Invalid questionID format: {question_id}")
            return JsonResponse({"error": "Invalid questionID format. Expected format: #cluster:position"}, status=400)

        # Корректный запрос: получаем Section, в которую входит Topic, содержащий указанный Question
        query = """
        SELECT @rid, content FROM Section 
        WHERE @rid IN (
            SELECT expand(out('Includes')) FROM Topic 
            WHERE :question_id IN out('Includes').@rid
        )
        """

        response = requests.post(
            config_settings.ORIENT_COMMAND_URL,
            auth=(config_settings.ORIENT_LOGIN, config_settings.ORIENT_PASS),
            headers={'Content-Type': 'application/json'},
            json={
                "command": query,
                "parameters": {"question_id": question_id}
            },
            proxies={"http": None, "https": None}
        )

        if not response.ok:
            logger.error(f'OrientDB error: {response.status_code} - {response.text}')
            return JsonResponse({"error": "Database operation failed"}, status=500)

        data = response.json()
        logger.debug(f'OrientDB response: {json.dumps(data, ensure_ascii=False)}')

        sections = data.get('result', [])
        if sections:
            section = sections[0]
            return JsonResponse({
                "id": section.get('@rid'),
                "name": section.get('content', '')
            }, status=200)

        logger.info(f"No section found for questionID {question_id}")
        return JsonResponse({"error": "Section not found"}, status=404)

    except json.JSONDecodeError:
        logger.error("Invalid JSON response from database")
        return JsonResponse({"error": "Database response format error"}, status=500)

    except requests.RequestException as e:
        logger.error(f"Database connection error: {str(e)}")
        return JsonResponse({"error": "Database connection failed"}, status=500)

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)

def get_session_duration(request):
    if request.method == 'GET':
        try:
            session_duration_minutes = Settings.objects.first().session_duration
        except Settings.DoesNotExist:
            logger.error("Настройки не найдены, используем значение по умолчанию в 30 минут.")
            session_duration_minutes = 30
    return JsonResponse({"status": "success", "duration": session_duration_minutes}, status=200)
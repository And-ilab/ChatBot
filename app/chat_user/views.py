import urllib

from django.shortcuts import render
from chat_dashboard.models import Dialog, Message, User
import jwt
from neomodel import db
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from .utils import extract_keywords
import logging
from .neo_models import Node
from .orientdb import connect_to_orientdb
import requests

logger = logging.getLogger(__name__)


def user_chat(request):
    return render(request, 'user_chat/user_chat.html')


def process_keywords(request):
    question = request.GET.get('question')

    if not question:
        return JsonResponse({'error': 'No keywords provided'}, status=400)

    keywords = extract_keywords(question)

    query = """
        WITH $keywords AS keywords
        MATCH (p:Paragraph)-[:HAS_TERM]->(t:Term)
        WHERE t.name IN keywords
        WITH p, COUNT(t) AS relevance
        ORDER BY relevance DESC
        RETURN p.content, relevance
        LIMIT 1
    """
    logger.info("PRE-ENDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD")
    try:
        result, _ = db.cypher_query(query, {'keywords': keywords})

        if result:

            return JsonResponse({'content': result[0][0]})
        else:

            return JsonResponse({'error': 'No relevant paragraph found'}, status=404)
    except Exception as e:

        logger.error(f"Error during query execution: {e}", exc_info=True)
        return JsonResponse({'error': 'Internal Server Error'}, status=500)


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
    url = f"http://localhost:2480/query/chat-bot-db/sql/SELECT * FROM Section WHERE type = '{type}'"

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
                        if 'name' in node and '@rid' in node:
                            nodes_data.append({'id': node['@rid'], 'name': node['name']})
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
    """Retrieves nodes of a specified type related to a specific entity."""
    if request.method == 'GET':
        start_node_type = request.GET.get('startNodeType')
        start_node_name = request.GET.get('startNodeName')
        finish_node_type = request.GET.get('finishNodeType')
        if start_node_type:
            logger.info(f"Fetching nodes with type: {start_node_type}, name: {start_node_name}")
            try:
                base_node = Node.nodes.filter(type=start_node_type, name=start_node_name).first()
                if not base_node:
                    logger.warning("Base node not found.")
                    return JsonResponse([], safe=False, status=200)

                related_nodes = base_node.include.filter(type=finish_node_type)
                if not related_nodes:
                    logger.info(f"No nodes found for type: {finish_node_type} related to base node.")
                    return JsonResponse([], safe=False, status=200)

                nodes_data = [{'id': node.element_id, 'name': node.name} for node in related_nodes]
                logger.debug(f"Nodes retrieved: {nodes_data}")
                return JsonResponse(nodes_data, safe=False, status=200)
            except Exception as e:
                logger.exception("An error occurred while fetching nodes.")
                return JsonResponse({'error': 'Internal server error. Please try again later.'}, status=500)
        else:
            logger.warning("Type parameter is required but not provided.")
            return JsonResponse({'error': 'Type parameter is required.'}, status=400)
    else:
        logger.warning("Invalid HTTP method used. Only GET is allowed.")
        return JsonResponse({'error': 'Invalid HTTP method. Use GET instead.'}, status=405)

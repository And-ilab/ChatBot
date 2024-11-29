from django.shortcuts import render
from chat_dashboard.models import Dialog, Message
import jwt
from django.conf import settings
from neomodel import db
from django.http import JsonResponse
from .utils import extract_keywords
import logging

logger = logging.getLogger(__name__)

def user_chat(request):
    token = request.session.get('token')
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user_id = payload.get('user_id')

            dialog, created = Dialog.objects.get_or_create(user_id=user_id)

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

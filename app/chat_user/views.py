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


#def process_keywords(request):
#    question = request.GET.get('question')
#
#    if not question:
#        return JsonResponse({'error': 'No keywords provided'}, status=400)
#
#    print(f"Received question: {question}")  # Логирование полученного вопроса

#    keywords = extract_keywords(question)
#    print(f"Extracted keywords: {keywords}")  # Логирование извлеченных ключевых слов

#    query = """
#        WITH $keywords AS keywords
#        MATCH (p:Paragraph)-[:HAS_TERM]->(t:Term)
#        WHERE t.name IN keywords
#        WITH p, COUNT(t) AS relevance
#        ORDER BY relevance DESC
#        RETURN p.content, relevance
#        LIMIT 1
#    """

#    try:
#        result, _ = db.cypher_query(query, {'keywords': keywords})
#        if result:
#            return JsonResponse({'content': result[0][0]})
#        else:
#            return JsonResponse({'error': 'No relevant paragraph found'}, status=404)
#    except Exception as e:
#        print(f"Error during query execution: {e}")  # Логирование ошибки выполнения запроса
#        return JsonResponse({'error': 'Internal Server Errorr'}, status=500)

def process_keywords(request):
    question = request.GET.get('question')

    if not question:
        return JsonResponse({'error': 'No keywords provided'}, status=400)

    logger.info(f"Received question: {question}")
    logger.info("STAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAART")
    keywords = extract_keywords(question)
    logger.info(f"Extractedd keywords: {keywords}")

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
        #logger.info(f"Received question2: {result}")

        if result:
	#logger.info(f"if result:  {result}")
	#logger.error(f"Received question2: {result}")
            return JsonResponse({'content': result[0][0]})
        else:
	 #   logger.info(f"no result")
            return JsonResponse({'error': 'No relevant paragraph found'}, status=404)
    except Exception as e:
	#logger.info(f"Error: {e}")
        logger.error(f"Error during query execution: {e}", exc_info=True)
        return JsonResponse({'error': 'Internal Server Error'}, status=500)
	#logger.info('ENDDDDDDDDDDDDD')

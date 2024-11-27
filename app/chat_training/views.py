from django.shortcuts import render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from .models import TrainingMessage
from chat_user.neo_models import Node
from chat_dashboard.models import User
import spacy
import pymorphy3
import json
import re
from neomodel import db


# Create your views here.
def training_dashboard(request):
    unread_messages = TrainingMessage.objects.filter(is_unread=True, is_ignored=False).values(
        'id', 'content', 'created_at'
    )

    ignored_messages = TrainingMessage.objects.filter(is_ignored=True).values(
        'id', 'content', 'created_at'
    )

    context = {
        'unread_messages': list(unread_messages),
        'ignored_messages': list(ignored_messages),
    }
    return render(request, 'chat_training/training.html', context)


def train_message(request, message_id):
    message = get_object_or_404(TrainingMessage, id=message_id)
    return render(request, 'chat_training/train_message.html', {'message': message})


def toggle_ignore_message(request, message_id):
    try:
        message = TrainingMessage.objects.get(id=message_id)
        message.is_unread = not message.is_unread
        message.is_ignored = not message.is_ignored
        message.save()

        unread_count = TrainingMessage.objects.filter(is_unread=True, is_ignored=False).count()
        ignored_count = TrainingMessage.objects.filter(is_ignored=True).count()

        return JsonResponse({
            'unread_count': unread_count,
            'ignored_count': ignored_count,
            'message_id': message.id,
            'is_unread': message.is_unread,
            'is_ignored': message.is_ignored,
        })
    except TrainingMessage.DoesNotExist:
        return JsonResponse({'error': 'Message not found'}, status=404)


def delete_message(request, message_id):
    try:
        message = TrainingMessage.objects.get(id=message_id)
        message.delete()

        unread_count = TrainingMessage.objects.filter(is_ignored=False).count()
        ignored_count = TrainingMessage.objects.filter(is_ignored=True).count()

        return JsonResponse({
            'unread_count': unread_count,
            'ignored_count': ignored_count
        })

    except TrainingMessage.DoesNotExist:
        return JsonResponse({'error': 'Message not found'}, status=404)


nlp = spacy.load("ru_core_news_sm")
morph = pymorphy3.MorphAnalyzer()
custom_stop_words = {"может", "могут", "какой", "какая", "какое", "какие", "что", "кто", "где", "когда", "зачем", "почему"}

def extract_keywords(question):
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

    return list(set(keywords))


@csrf_exempt
def extract_keywords_view(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            question = data.get('question', '')

            if not question:
                return JsonResponse({'error': 'Вопрос не предоставлен'}, status=400)

            keywords = extract_keywords(question)
            return JsonResponse({'keywords': keywords})
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Неверный формат JSON'}, status=400)
    return JsonResponse({'error': 'Неверный метод запроса'}, status=405)


@csrf_exempt
def create_node(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            print("Received data:", data)  # Логируем полученные данные

            node_type = data.get('type')
            node_content = data.get('content')

            if not node_type or not node_content:
                return JsonResponse({'error': 'Отсутствуют обязательные данные: type или content'}, status=400)

            # Создаем узел
            node = Node(type=node_type, content=node_content).save()

            # Возвращаем ответ
            return JsonResponse({'id': node.element_id, 'type': node_type, 'content': node_content}, status=201)
        except Exception as e:
            print("Error:", str(e))  # Логируем ошибку
            return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def create_relation(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            print("Received data:", data)  # Логируем данные

            relation_type = data.get('type')
            start_node_id = data.get('start_node_id')
            end_node_id = data.get('end_node_id')

            if not relation_type or not start_node_id or not end_node_id:
                return JsonResponse({'error': 'Отсутствуют обязательные данные'}, status=400)

            # Получаем узлы через Cypher с использованием elementId()
            query = f"""
            MATCH (startNode), (endNode)
            WHERE elementId(startNode) = '{start_node_id}' AND elementId(endNode) = '{end_node_id}'
            CREATE (startNode)-[r:{relation_type}]->(endNode)
            RETURN startNode, endNode
            """
            results, meta = db.cypher_query(query)

            return JsonResponse({'message': 'Связь успешно создана'}, status=201)
        except Exception as e:
            print("Error:", str(e))  # Логируем ошибку
            return JsonResponse({'error': str(e)}, status=400)



@csrf_exempt
def get_nodes(request):
    if request.method == 'GET':
        try:
            nodes = Node.nodes.all()
            nodes_data = [{'id': node.element_id, 'type': node.type, 'content': node.content[:20]} for node in nodes]
            return JsonResponse(nodes_data, safe=False, status=200)
        except Exception as e:
            print("Error:", str(e))
            return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def create_training_message(request):
    if request.method == 'POST':
        try:
            # Парсинг данных из тела запроса
            data = json.loads(request.body)
            sender_id = data.get('sender_id')  # ID отправителя
            content = data.get('content')     # Текст сообщения

            # Проверка обязательных полей
            if not content:
                return JsonResponse({'error': 'Поле "content" является обязательным.'}, status=400)

            # Получение объекта User, если sender_id передан
            sender = None
            if sender_id:
                try:
                    sender = User.objects.get(id=sender_id)
                except User.DoesNotExist:
                    return JsonResponse({'error': 'Пользователь с указанным ID не найден.'}, status=404)

            # Создание нового сообщения
            training_message = TrainingMessage.objects.create(
                sender=sender,
                content=content
            )

            # Возврат успешного ответа
            return JsonResponse({
                'id': training_message.id,
                'sender': sender_id,
                'content': training_message.content,
                'created_at': training_message.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'is_ignored': training_message.is_ignored,
                'is_unread': training_message.is_unread
            }, status=201)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Некорректный формат JSON.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'Метод не поддерживается. Используйте POST.'}, status=405)
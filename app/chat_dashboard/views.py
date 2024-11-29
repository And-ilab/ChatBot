from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Exists, OuterRef, Subquery, Value, Case, When, F, Count
from django.db.models.functions import TruncDate
from authentication.decorators import role_required
from .models import Dialog, Message, User, TrainingMessage
from chat_user.neo_models import Node
from .forms import UserForm, UserFormUpdate
import json
import re
import spacy
import pymorphy3


# === Основная страница url-адреса ===

def empty_page(request):
    """Отображает пустую страницу"""
    return render(request, 'chat_dashboard/index.html')


# === Аналитика ===

def analytics(request):
    """ Отображает страницу с аналитикой """
    return render(request, 'chat_dashboard/analytics.html')


def user_activity_data(request):
    """ Возвращает данные о количестве пользователей, которые входили в систему,
            сгруппированные по дате последнего входа. """
    data = (
        User.objects.filter(last_login__isnull=False)  # Исключаем пользователей без логинов
        .annotate(login_date=TruncDate('last_login'))  # Обрезаем время до даты
        .values('login_date')  # Группируем по дате
        .annotate(count=Count('id'))  # Считаем количество пользователей
        .order_by('login_date')  # Сортируем по дате
    )
    return JsonResponse(list(data), safe=False)


def messages_count_data(request):
    """ Возвращает количество сообщений, сгруппированных по дате и типу отправителя (user/bot) """
    data = (
        Message.objects.annotate(message_date=TruncDate('created_at'))  # Обрезаем время до даты
        .values('message_date', 'sender_type')  # Группируем по дате и типу отправителя
        .annotate(count=Count('id'))  # Считаем количество сообщений
        .order_by('message_date', 'sender_type')  # Сортируем по дате и типу отправителя
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
    return JsonResponse(response_data, safe=False)


def daily_messages_data(request):
    """ Возвращает количество тренировочных сообщений, сгруппированных по дате создания """
    data = (
        TrainingMessage.objects
        .annotate(date=TruncDate('created_at'))  # Обрезаем время до даты
        .values('date')  # Группируем по дате
        .annotate(count=Count('id'))  # Считаем количество сообщений
        .order_by('date')  # Упорядочиваем по дате
    )
    return JsonResponse(list(data), safe=False)


# === Обучение ===

# Инициализация NLP инструментов
nlp = spacy.load("ru_core_news_sm")
morph = pymorphy3.MorphAnalyzer()
custom_stop_words = {"может", "могут", "какой", "какая", "какое", "какие", "что", "кто", "где", "когда", "зачем", "почему"}


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
    return render(request, 'chat_dashboard/training.html', context)


def train_message(request, message_id):
    message = get_object_or_404(TrainingMessage, id=message_id)
    return render(request, 'chat_dashboard/train_message.html', {'message': message})


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


# === Управление пользователями ===

@role_required('admin')
def user_list(request):
    """ Список пользователей """
    users = User.objects.all()
    return render(request, 'chat_dashboard/users.html', {'users': users})


@role_required('admin')
def user_create(request):
    """ Создание пользователя """
    if request.method == 'POST':
        form = UserForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.save()
            return redirect('chat_dashboard:user_list')
    else:
        form = UserForm()
    return render(request, 'chat_dashboard/user_create_form.html', {'form': form})


@role_required('admin')
def user_update(request, pk):
    """ Изменение данных пользователя """
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        form = UserFormUpdate(request.POST, instance=user)
        if form.is_valid():
            form.save()
            return redirect('chat_dashboard:user_list')
    else:
        form = UserFormUpdate(instance=user)
    return render(request, 'chat_dashboard/user_update_form.html', {'form': form})


@role_required('admin')
def user_delete(request, pk):
    """ Удаление пользователя """
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        user.delete()
        return redirect('chat_dashboard:user_list')
    return render(request, 'chat_dashboard/user_delete_form.html', {'user': user})


# === Архив чатов ===

def get_last_message_subquery(field):
    """ Создает подзапрос для получения последнего сообщения по указанному полю """
    return Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values(field)[:1]


@role_required(['admin', 'operator'])
def archive(request):
    """ Архив диалогов с последними сообщениями """
    user = request.user
    dialogs = Dialog.objects.annotate(
        has_messages=Exists(Message.objects.filter(dialog=OuterRef('pk'))),
        username=F('user__username'),
        last_message=Subquery(get_last_message_subquery('content')),
        last_message_timestamp=Subquery(get_last_message_subquery('created_at')),
        last_message_sender_id=Subquery(
            Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender_id')[:1]
        ),
        last_message_username=Case(
            When(last_message_sender_id=None, then=Value('Bot')),
            default=Subquery(
                Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values('sender__username')[:1]
            )
        )
    ).filter(has_messages=True).order_by('-last_message_timestamp')

    return render(request, 'chat_dashboard/archive.html', {'dialogs': dialogs, 'user': user})


# === Сообщения ===

def get_messages(request, dialog_id):
    """ Получение всех сообщений диалога """
    messages = Message.objects.filter(dialog_id=dialog_id).order_by('created_at')
    messages_data = [
        {
            'sender': message.sender.username if message.sender and message.sender_type == 'user' else 'Bot',
            'content': message.content,
            'timestamp': message.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }
        for message in messages
    ]
    return JsonResponse({'messages': messages_data})


@csrf_exempt
def send_message(request, dialog_id):
    """ Отправка сообщения в указанный диалог """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            content = data.get('content')
            sender_type = data.get('sender_type')
            sender_id = data.get('sender_id')

            if content and sender_type:
                dialog = Dialog.objects.get(id=dialog_id)
                Message.objects.create(
                    dialog=dialog,
                    sender_type=sender_type,
                    sender_id=sender_id if sender_type == 'user' else None,
                    content=content
                )
                return JsonResponse({'status': 'success', 'message': 'Message sent'})
            return JsonResponse({'status': 'error', 'message': 'Invalid data'}, status=400)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    return JsonResponse({'status': 'error', 'message': 'Invalid method'}, status=405)
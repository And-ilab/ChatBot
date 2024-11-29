import logging
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

logger = logging.getLogger(__name__)


def empty_page(request):
    """Displays an empty page."""
    logger.info("Accessing empty page.")
    return render(request, 'chat_dashboard/index.html')


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
    """Creates a new node in the graph."""
    if request.method == 'POST':
        logger.info("Creating a new node.")
        try:
            data = json.loads(request.body)

            node_type = data.get('type')
            node_content = data.get('content')

            if not node_type or not node_content:
                logger.warning("Missing mandatory fields: type or content.")
                return JsonResponse({'error': 'Missing mandatory fields: type or content'}, status=400)

            node = Node(type=node_type, content=node_content).save()
            logger.info(f"Node created with ID: {node.element_id}")
            return JsonResponse({'id': node.element_id, 'type': node_type, 'content': node_content}, status=201)
        except Exception as e:
            logger.exception("An error occurred while creating a node.")
            return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def create_relation(request):
    """Creates a relation between two nodes."""
    if request.method == 'POST':
        logger.info("Creating a new relation between nodes.")
        try:
            data = json.loads(request.body)

            relation_type = data.get('type')
            start_node_id = data.get('start_node_id')
            end_node_id = data.get('end_node_id')

            if not relation_type or not start_node_id or not end_node_id:
                logger.warning("Missing mandatory fields for relation creation.")
                return JsonResponse({'error': 'Missing mandatory fields'}, status=400)

            query = f"""
            MATCH (startNode), (endNode)
            WHERE elementId(startNode) = '{start_node_id}' AND elementId(endNode) = '{end_node_id}'
            CREATE (startNode)-[r:{relation_type}]->(endNode)
            RETURN startNode, endNode
            """
            results, meta = db.cypher_query(query)

            logger.info(f"Relation of type {relation_type} created between nodes {start_node_id} and {end_node_id}.")
            return JsonResponse({'message': 'Relation successfully created'}, status=201)
        except Exception as e:
            logger.exception("An error occurred while creating a relation.")
            return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def get_nodes(request):
    """Retrieves all nodes."""
    if request.method == 'GET':
        logger.info("Fetching all nodes.")
        try:
            nodes = Node.nodes.all()
            nodes_data = [{'id': node.element_id, 'type': node.type, 'content': node.content[:20]} for node in nodes]
            logger.debug(f"Nodes retrieved: {nodes_data}")
            return JsonResponse(nodes_data, safe=False, status=200)
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
                    sender = User.objects.get(id=sender_id)
                except User.DoesNotExist:
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


@role_required('admin')
def user_list(request):
    """Displays a list of users."""
    logger.info("Accessing user list.")
    users = User.objects.all()
    logger.debug(f"Users retrieved: {list(users)}")
    return render(request, 'chat_dashboard/users.html', {'users': users})


@role_required('admin')
def user_create(request):
    """Creates a new user."""
    logger.info("Creating a new user.")
    if request.method == 'POST':
        form = UserForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.save()
            logger.info(f"User created: ID={user.id}, Username={user.username}, Email={user.email}")
            return redirect('chat_dashboard:user_list')
    else:
        form = UserForm()
    return render(request, 'chat_dashboard/user_create_form.html', {'form': form})

@role_required('admin')
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


@role_required('admin')
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
    """Creates a subquery to get the last message by a specified field."""
    logger.debug("Creating a subquery for the last message.")
    return Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values(field)[:1]


@role_required(['admin', 'operator'])
def archive(request):
    """Displays the archive of dialogs with the last messages."""
    logger.info("Accessing archive page.")
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

    logger.debug(f"Dialogs retrieved: {list(dialogs)}")
    return render(request, 'chat_dashboard/archive.html', {'dialogs': dialogs, 'user': user})


def get_messages(request, dialog_id):
    """Retrieves all messages in a dialog."""
    logger.info(f"Fetching messages for dialog ID: {dialog_id}")
    messages = Message.objects.filter(dialog_id=dialog_id).order_by('created_at')
    messages_data = [
        {
            'sender': message.sender.username if message.sender and message.sender_type == 'user' else 'Bot',
            'content': message.content,
            'timestamp': message.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }
        for message in messages
    ]
    logger.debug(f"Messages retrieved: {messages_data}")
    return JsonResponse({'messages': messages_data})


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

            if content and sender_type:
                dialog = Dialog.objects.get(id=dialog_id)
                Message.objects.create(
                    dialog=dialog,
                    sender_type=sender_type,
                    sender_id=sender_id if sender_type == 'user' else None,
                    content=content
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
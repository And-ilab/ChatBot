from django.shortcuts import render, redirect, get_object_or_404
from .models import User
from .forms import UserForm, UserFormUpdate
from django.db.models import Exists, OuterRef, Subquery, Value, Case, When, CharField, F
from .models import Dialog, Message
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from authentication.decorators import role_required


@role_required('admin')
def user_list(request):
    users = User.objects.all()
    return render(request, 'chat_dashboard/index.html', {'users': users})


@role_required('admin')
def user_create(request):
    if request.method == 'POST':
        form = UserForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            email = user.email
            # send(email)
            user.save()
            return redirect('chat_dashboard:user_list')
    else:
        form = UserForm()
    return render(request, 'chat_dashboard/user_form.html', {'form': form})


@role_required('admin')
def user_update(request, pk):
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        form = UserFormUpdate(request.POST, instance=user)
        if form.is_valid():
            form.save()
            return redirect('chat_dashboard:user_list')
    else:
        form = UserFormUpdate(instance=user)
    return render(request, 'chat_dashboard/user_form_update.html', {'form': form})


@role_required('admin')
def user_delete(request, pk):
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        user.delete()
        return redirect('chat_dashboard:user_list')
    return render(request, 'chat_dashboard/user_confirm_delete.html', {'user': user})


def get_last_message_subquery(field):
    return Message.objects.filter(dialog=OuterRef('pk')).order_by('-created_at').values(field)[:1]


def admin_dashboard(request):
    has_messages = Message.objects.filter(dialog=OuterRef('pk'))
    user = request.user
    dialogs = Dialog.objects.annotate(
        has_messages=Exists(has_messages)
    ).filter(has_messages=True).annotate(
        username=F('user__username'),
        last_message=Subquery(get_last_message_subquery('content')),
        last_message_timestamp=Subquery(get_last_message_subquery('created_at')),
        last_message_sender_id=Subquery(
            Message.objects.filter(dialog=OuterRef('pk'))
            .order_by('-created_at')
            .values('sender_id')[:1]
        ),
        last_message_username=Case(
            When(
                last_message_sender_id=None,
                then=Value('Bot')
            ),
            default=Subquery(
                Message.objects.filter(dialog=OuterRef('pk'))
                .order_by('-created_at')
                .values('sender__username')[:1]
            )
        )
    ).order_by('-last_message_timestamp')
    return render(request, 'dashboard/archive.html', {'dialogs': dialogs, 'user':user})


def get_messages(request, dialog_id):
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
    if request.method == 'POST':
        data = json.loads(request.body)
        content = data.get('content')
        sender_type = data.get('sender_type')
        sender_id = data.get('sender_id')

        if content and sender_type:
            dialog = Dialog.objects.get(id=dialog_id)
            if sender_type == 'bot':
                message = Message.objects.create(
                    dialog=dialog,
                    sender_type=sender_type,
                    content=content
                )
            else:
                message = Message.objects.create(
                    dialog=dialog,
                    sender_type=sender_type,
                    sender_id=sender_id,
                    content=content
                )
            return JsonResponse({'status': 'success', 'message': 'Message sent'})
        return JsonResponse({'status': 'error', 'message': 'Invalid data'}, status=400)
    return JsonResponse({'status': 'error', 'message': 'Invalid method'}, status=405)

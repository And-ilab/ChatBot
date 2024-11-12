from django.shortcuts import render
from chat_dashboard.models import Dialog, Message
from chat_dashboard.views import get_messages


# Create your views here.
def user_chat(request, dialog_id=9):
    return render(request, 'user_chat/user_chat.html')
from django.urls import path
from . import views

app_name = 'chat_user'

urlpatterns = [
    path('', views.user_chat, name='chat'),
]
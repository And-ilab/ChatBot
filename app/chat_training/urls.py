from django.urls import path
from . import views

app_name = 'chat_training'

urlpatterns = [
    path('', views.training_dashboard, name='chat_training'),
    path('train/<int:message_id>/', views.train_message, name='train'),
]
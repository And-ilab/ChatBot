from django.urls import path
from . import views

app_name = 'chat_dashboard'

urlpatterns = [
    path('user/', views.user_list, name='user_list'),
    path('user/create/', views.user_create, name='user_create'),
    path('user/update/<int:pk>/', views.user_update, name='user_update'),
    path('user/delete/<int:pk>/', views.user_delete, name='user_delete'),
    path('', views.admin_dashboard, name='chat_dashboard'),
]

from django.urls import path
from . import views

app_name = 'chat_dashboard'

urlpatterns = [
    path('archive/', views.archive, name='archive'),
    path('edit-content/', views.create_or_edit_content, name='create_or_edit_content'),
    path('archive/filter/', views.archive_filter_view, name='archive_filter'),
    path('analytics/', views.analytics, name='analytics'),
    path('users/', views.user_list, name='user_list'),
    path('training/', views.training_dashboard, name='training'),
    path('training/train/<int:message_id>/', views.train_message, name='train'),
    path('user/create/', views.user_create, name='user_create'),
    path('user/update/<int:pk>/', views.user_update, name='user_update'),
    path('user/delete/<int:pk>/', views.user_delete, name='user_delete'),
    path('settings/', views.settings_view, name='settings'),

]

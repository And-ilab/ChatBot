"""
URL configuration for app project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
import chat_dashboard.views as dashboard_views
import chat_training.views as training_views
import chat_user.views as chat_views
import analytics.views as analytics_views


urlpatterns = [
    path('admin/', admin.site.urls),
    path('chat_user/', include('chat_user.urls', namespace='chat_user')),
    path('chat_dashboard/', include('chat_dashboard.urls', namespace='chat_dashboard')),
    path('analytics/', include('analytics.urls', namespace='analytics')),
    path('chat_training/', include('chat_training.urls', namespace='chat_training')),
    path('authentication/', include('authentication.urls', namespace='authentication')),
    path('api/messages/<int:dialog_id>/', dashboard_views.get_messages, name='get_messages'),
    path('api/send-message/<int:dialog_id>/', dashboard_views.send_message, name='send_message'),
    path('api/toggle_ignore/<int:message_id>/', training_views.toggle_ignore_message, name='toggle_ignore'),
    path('api/delete_message/<int:message_id>/', training_views.delete_message, name='delete_message'),
    path('api/process-keywords/', chat_views.process_keywords, name='process_keywords'),
    path('api/extract-keywords/', training_views.extract_keywords_view, name='extract_keywords'),
    path('api/create-node/', training_views.create_node, name='create_node'),
    path('api/create-relation/', training_views.create_relation, name='create_relation'),
    path('api/get-nodes/', training_views.get_nodes, name='get_nodes'),
    path('api/create-training-message/', training_views.create_training_message, name='create_training_message'),
    path("api/user-activity/", analytics_views.user_activity_data, name="user_activity_data"),
    path("api/messages-count-data/", analytics_views.messages_count_data, name="messages_count_data"),
    path("api/daily-messages/", analytics_views.daily_messages_data, name="daily_messages_data"),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

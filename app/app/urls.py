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
from imghdr import test_pbm

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
import chat_dashboard.views as dashboard_views
import chat_user.views as chat_views
import authentication.views as authentication_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('chat_user/', include('chat_user.urls', namespace='chat_user')),
    path('chat_dashboard/', include('chat_dashboard.urls', namespace='chat_dashboard')),
    path('authentication/', include('authentication.urls', namespace='authentication')),
    path('api/messages/<int:dialog_id>/', dashboard_views.get_messages, name='get_messages'),
    path('api/filter_dialogs/<int:period>/', dashboard_views.filter_dialogs, name='filter_dialogs'),
    path('api/filter_dialogs_by_id/<int:user_id>/', dashboard_views.filter_dialogs_by_id, name='filter_dialogs_by_id'),
    path('api/filter_dialogs_by_date_range/', dashboard_views.filter_dialogs_by_date_range, name='filter_dialogs_by_date_range'),
    path('api/get_info/<int:user_id>/', dashboard_views.get_info, name='get_info'),
    path('api/send-message/<int:dialog_id>/', dashboard_views.send_message, name='send_message'),
    path('api/toggle_ignore/<int:message_id>/', dashboard_views.toggle_ignore_message, name='toggle_ignore'),
    path('api/delete_message/<int:message_id>/', dashboard_views.delete_message, name='delete_message'),
    path('api/process-keywords/', chat_views.process_keywords, name='process_keywords'),
    path('api/extract-keywords/', dashboard_views.extract_keywords_view, name='extract_keywords'),
    path('api/create-node/', dashboard_views.create_node, name='create_node'),
    path('api/create-relation/', dashboard_views.create_relation, name='create_relation'),
    path('api/get-nodes/', dashboard_views.get_nodes, name='get_nodes'),
    path('api/login/', authentication_views.api_login_view, name='api_login_view'),
    path('api/chat-login/', chat_views.chat_login, name='chat_login'),
    path('api/check-session/', chat_views.check_session, name='check_session'),
    path("api/extend-session/", chat_views.extend_session, name="extend_session"),
    path("api/close-session/", chat_views.close_session, name="close_session"),
    path('api/update-answer/', chat_views.update_answer, name='update_answer'),
    path('api/update-question/', chat_views.update_question, name='update_question'),
    path('api/user/<int:user_id>/', chat_views.get_user_details, name='get_user_details'),
    path('api/register/', authentication_views.api_register_view, name='api_register_view'),
    path('api/get-nodes-by-type/', chat_views.get_nodes_by_type, name='get_nodes_by_type'),
    path('api/dialogs/latest/<int:user_id>/', chat_views.get_latest_dialog, name='get_latest_dialog'),
    path('api/update-session/', dashboard_views.update_session_duration, name='update_session_duration'),
    path('api/dialogs/create/<int:user_id>/', chat_views.create_dialog, name='create_dialog'),
    path('api/get-nodes-by-type-with-relation/', chat_views.get_nodes_by_type_with_relation, name='get_nodes_by_type_with_relation'),
    path('api/get-answer/', chat_views.get_answer, name='get_answer'),
    path('api/get-question-id-by-content/', chat_views.get_question_id_by_content, name='get_question_id_by_content'),
    path('api/get-documents/', chat_views.get_documents, name='get_documents'),
    path('api/delete-node/', dashboard_views.delete_node, name='delete_node'),
    path('api/get-artifact-by-id/', chat_views.get_artifact_by_id, name='get_artifact_by_id'),
    path('api/create-training-message/', dashboard_views.create_training_message, name='create_training_message'),
    path("api/user-activity/", dashboard_views.user_activity_data, name="user_activity_data"),
    path("api/messages-count-data/", dashboard_views.messages_count_data, name="messages_count_data"),
    path("api/daily-messages/", dashboard_views.daily_messages_data, name="daily_messages_data"),
    path("api/recognize-question/", chat_views.recognize_question, name="recognize_question"),
    path('api/upload-document/', dashboard_views.upload_document, name='upload_document'),
    path('api/mark-trained/', dashboard_views.mark_question_trained, name='mark_question_trained'),
    path('api/get-document-link-by-name/<str:file_name>/', dashboard_views.get_document_link_by_name, name='get_document_link_by_name'),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
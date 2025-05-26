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
    path('api/filter_dialogs/', dashboard_views.filter_dialogs, name='filter_dialogs'),
    path('api/get_info/<int:user_id>/', dashboard_views.get_info, name='get_info'),
    path('api/send-message/<int:dialog_id>/', dashboard_views.send_message, name='send_message'),
    path('api/ignore_message/<int:message_id>/', dashboard_views.ignore_message, name='ignore_message'),
    path('api/delete_training_message/<int:message_id>/', dashboard_views.delete_training_message, name='delete_training_message'),
    path('api/delete_last_chat_message/<int:dialog_id>/', chat_views.delete_last_chat_message, name='delete_last_chat_message'),
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
    path('api/update-topic/', chat_views.update_topic, name='update_topic'),
    path('api/update-section/', chat_views.update_section, name='update_section'),
    path('api/user/<int:user_id>/', chat_views.get_user_details, name='get_user_details'),
    path('api/register/', authentication_views.api_register_view, name='api_register_view'),
    path('api/export_to_excel/', dashboard_views.export_to_excel, name='export_to_excel'),
    path('api/get-nodes-by-type/', chat_views.get_nodes_by_type, name='get_nodes_by_type'),
    path('api/dialogs/latest/<int:user_id>/', chat_views.get_latest_dialog, name='get_latest_dialog'),
    path('api/update-settings/', dashboard_views.update_settings, name='update_settings'),
    path('api/dialogs/create/<int:user_id>/', chat_views.create_dialog, name='create_dialog'),
    path('api/get-nodes-by-type-with-relation/', chat_views.get_nodes_by_type_with_relation, name='get_nodes_by_type_with_relation'),
    path('api/get-section-by-question/', chat_views.get_section_by_question, name='get_section_by_question'),
    path('api/get-answer/', chat_views.get_answer, name='get_answer'),
    path('api/get-question-id-by-content/', chat_views.get_question_id_by_content, name='get_question_id_by_content'),
    path('api/get-artifacts/', chat_views.get_artifacts, name='get_artifacts'),
    path('api/delete-node/', dashboard_views.delete_node, name='delete_node'),
    path('api/update-node/', dashboard_views.update_node, name='update_node'),
    path('api/delete-relation/',dashboard_views.delete_relation, name='delete_relation'),
    path('api/delete-topic-relation/',dashboard_views.delete_topic_relation, name='delete_topic_relation'),
    path('api/get-artifact-by-id/', chat_views.get_artifact_by_id, name='get_artifact_by_id'),
    path('api/create-training-message/', dashboard_views.create_training_message, name='create_training_message'),
    path("api/messages-count-data/", dashboard_views.messages_count_data, name="messages_count_data"),
    path("api/daily-messages/", dashboard_views.daily_messages_data, name="daily_messages_data"),
    path("api/recognize-question/", chat_views.recognize_question, name="recognize_question"),
    path('api/upload-document/', dashboard_views.upload_document, name='upload_document'),
    path('api/mark-trained/', dashboard_views.mark_question_trained, name='mark_question_trained'),
    path('api/get-document-link-by-uuid/<str:uuid>/', dashboard_views.get_document_link_by_uuid, name='get_document_link_by_uuid'),
    path("api/add-feedback/", chat_views.add_feedback, name="add_feedback"),
    path("api/feedbacks/", chat_views.FeedbacksList.as_view(), name="feedbacks-list"),
    path("api/session-data/", chat_views.session_data, name="session-data"),
    path("api/refused-data/", chat_views.refused_data, name="refused_data"),
    path("api/popular-requests/", chat_views.popular_requests_data, name="popular_requests_data"),
    path("api/add-popular-request/", chat_views.add_popular_request, name="add_popular_request"),
    path("api/get-documents/", dashboard_views.get_documents, name="get_documents"),
    path('api/neural-status/', chat_views.get_neural_status, name='neural_status'),
    path("api/get-links/", dashboard_views.get_links, name="get_links"),
    path("api/get-session-duration/", chat_views.get_session_duration, name="get_session_duration"),
    path('api/get-all-questions/', chat_views.get_all_questions, name='get_all_questions'),
    path('api/add-question-to-existing/', dashboard_views.add_question_to_existing, name='add_question_to_existing'),
    path('api/get-all-topics/', chat_views.get_all_topics, name='get_all_topics'),
    path('api/add-new-question-from-teaching/', dashboard_views.add_new_question_from_teaching, name='add_new_question_from_teaching')
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
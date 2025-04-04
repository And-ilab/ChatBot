from django.urls import path
from . import views

app_name = 'chat_user'


urlpatterns = [
    path('embed.js', views.embed_script, name='embed_script'),  # New embed route
    path('', views.user_chat, name='chat'),
    path('widget', views.user_chat_widget, name='widget'),

]
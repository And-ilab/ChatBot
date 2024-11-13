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
import chat_user.views as chat_views


urlpatterns = [
    path('admin/', admin.site.urls),
    path('chat_user/', include('chat_user.urls', namespace='chat_user')),
    path('chat_dashboard/', include('chat_dashboard.urls', namespace='chat_dashboard')),
    path('authentication/', include('authentication.urls', namespace='authentication')),  # Подключение приложения
    path('api/messages/<int:dialog_id>/', dashboard_views.get_messages, name='get_messages'),
    path('api/send-message/<int:dialog_id>/', dashboard_views.send_message, name='send_message'),
    path('api/process-keywords/', chat_views.process_keywords, name='process_keywords'),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

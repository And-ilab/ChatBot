from django.urls import path
from .views import register_view, login_view, logout_view, activate_account
from django.contrib.auth import views as auth_views

app_name = 'authentication'

urlpatterns = [
    path('register/', register_view, name='register'),
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('activate/<str:token>/', activate_account, name='activate_account'),
]

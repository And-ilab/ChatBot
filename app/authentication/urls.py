from django.urls import path
from .views import register_view, login_view, logout_view, activate_account, CustomPasswordResetView, \
    CustomPasswordResetConfirmView, CustomPasswordResetCompleteView
from django.contrib.auth import views as auth_views

app_name = 'authentication'

urlpatterns = [
    path('register/', register_view, name='register'),
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('activate/<str:token>/', activate_account, name='activate_account'),
    path('password_reset/', CustomPasswordResetView.as_view(), name='password_reset'),
    path('reset/<uidb64>/<token>/', CustomPasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('reset/done/', CustomPasswordResetCompleteView.as_view(), name='password_reset_complete'),
]

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
    # path('password_reset/',
    #      auth_views.PasswordResetView.as_view(template_name="authentication/password_reset_form.html"),
    #      name='password_reset'),
    # path('password_reset/done/',
    #      auth_views.PasswordResetDoneView.as_view(template_name="authentication/password_reset_done.html"),
    #      name='password_reset_done'),
    # path('reset/<uidb64>/<token>/',
    #      auth_views.PasswordResetConfirmView.as_view(template_name="authentication/password_reset_form.html"),
    #      name='password_reset_confirm'),
    # path('reset/done/', auth_views.PasswordResetCompleteView.as_view(), name='password_reset_complete'),
    path('password_reset/', CustomPasswordResetView.as_view(), name='password_reset'),
    path('reset/<uidb64>/<token>/', CustomPasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('reset/done/', CustomPasswordResetCompleteView.as_view(), name='password_reset_complete'),
]

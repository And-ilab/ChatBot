from django.urls import path
from .views import register_view, login_view, logout_view, login_view2

app_name = 'authentication'

urlpatterns = [
    path('register/', register_view, name='register'),
    path('login/', login_view, name='login'),
    path('login2/', login_view2, name='login2'),
    path('logout/', logout_view, name='logout'),
]

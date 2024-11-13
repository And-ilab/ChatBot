from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from .forms import UserRegistrationForm, CustomUserLoginForm
from django.contrib import messages
from .auth_with_AD import validate_user_credentials
from .decorators import role_required
import jwt
from django.http import JsonResponse
from django.conf import settings
from .utils import generate_jwt, get_role_by_token
from django.contrib.auth.decorators import login_required
from .decorators import role_required


def register_view(request):
    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.save()
            return redirect('authentication:login')
    else:
        form = UserRegistrationForm()
        print(form.errors)
    return render(request, 'authentication/register.html', {'form': form})


def login_view(request):
    if request.method == 'POST':
        form = CustomUserLoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            print(username, password)

            if '@' in username:
                user = authenticate(request, username=username, password=password)
                if user is not None:
                    token = generate_jwt(user)
                    request.session['token'] = token
                    login(request, user)
                    # return redirect('chat_dashboard:user_list')
                    try:
                        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                        role = payload.get('role')

                        if role == 'admin' or role == 'operator':
                            login(request, user)
                            return redirect('chat_dashboard:chat_dashboard')
                        else:
                            login(request, user)
                            return redirect('chat_user:chat')
                    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                        messages.error(request, 'Ошибка при обработке токена.')
                        return redirect('login')  # Перенаправление на страницу входа

                else:
                    messages.error(request, 'Неправильный логин или пароль.')
            else:

                user_entry = validate_user_credentials(username, password)
                if user_entry:
                    return redirect('chat_dashboard:user_list')
                else:
                    messages.error(request, 'Неправильный логин или пароль.')

    else:
        form = CustomUserLoginForm()

    return render(request, 'authentication/login.html', {'form': form})


@login_required
def logout_view(request):
    logout(request)
    return redirect('authentication:login')

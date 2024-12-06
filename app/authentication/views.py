import logging
from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from .forms import UserRegistrationForm, CustomUserLoginForm
from django.contrib import messages
from .auth_with_AD import validate_user_credentials
from .decorators import role_required
import jwt
from django.http import JsonResponse
from django.conf import settings
from .utils import generate_jwt
from django.contrib.auth.decorators import login_required
from chat_dashboard.models import Settings

logger = logging.getLogger(__name__)


def register_view(request):
    """Handles user registration."""
    logger.info("User registration attempt.")
    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.save()
            logger.info(f"User registered: Username={user.username}, Email={user.email}")
            return redirect('authentication:login')
        else:
            logger.warning(f"Registration form errors: {form.errors}")
    else:
        form = UserRegistrationForm()

    return render(request, 'authentication/register.html', {'form': form})


# def login_view(request):
#     """Handles user login."""
#     logger.info("User login attempt.")
#     if request.method == 'POST':
#         form = CustomUserLoginForm(request.POST)
#         if form.is_valid():
#             username = form.cleaned_data.get('username')
#             password = form.cleaned_data.get('password')
#             logger.debug(f"Login attempt: Username={username}")
#
#             if '@' in username:
#                 user = authenticate(request, username=username, password=password)
#                 if user is not None:
#                     token = generate_jwt(user)
#                     request.session['token'] = token
#                     login(request, user)
#                     logger.info(f"User logged in: Username={username}")
#                     try:
#                         payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
#                         role = payload.get('role')
#
#                         if role in ['admin', 'operator']:
#                             logger.info(f"User {username} with role {role} redirected to admin dashboard.")
#                             return redirect('chat_dashboard:archive')
#                         else:
#                             logger.info(f"User {username} redirected to chat.")
#                             return redirect('chat_user:chat')
#                     except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
#                         messages.error(request, 'Ошибка при обработке токена.')
#                         logger.error("Token error during login.")
#                         return redirect('login')
#                 else:
#                     messages.error(request, 'Неправильный логин или пароль.')
#                     logger.warning(f"Failed login attempt for Username={username}.")
#             else:
#                 user_entry = validate_user_credentials(username, password)
#                 if user_entry:
#                     logger.info(f"User {username} validated via AD.")
#                     return redirect('chat_dashboard:user_list')
#                 else:
#                     messages.error(request, 'Неправильный логин или пароль.')
#                     logger.warning(f"Failed AD login attempt for Username={username}.")
#
#     else:
#         form = CustomUserLoginForm()
#
#     return render(request, 'authentication/login.html', {'form': form})


def get_ad_authentication_enabled():
    settings_obj, created = Settings.objects.get_or_create(ad_enabled=False)
    return settings_obj.ad_enabled

def login_view(request):
    """Handles user login."""
    logger.info("User login attempt.")
    if request.method == 'POST':
        form = CustomUserLoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            logger.debug(f"Login attempt: Username={username}")

            # Получаем состояние авторизации через AD
            ad_enabled = get_ad_authentication_enabled()

            if not ad_enabled and '@' in username:
                user = authenticate(request, username=username, password=password)
                if user is not None:
                    token = generate_jwt(user)
                    request.session['token'] = token
                    login(request, user)
                    logger.info(f"User logged in: Username={username}")

                    try:
                        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                        role = payload.get('role')

                        if role in ['admin', 'operator']:
                            logger.info(f"User {username} with role {role} redirected to admin dashboard.")
                            return redirect('chat_dashboard:archive')
                        else:
                            logger.info(f"User {username} redirected to chat.")
                            return redirect('chat_user:chat')
                    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                        messages.error(request, 'Ошибка при обработке токена.')
                        logger.error("Token error during login.")
                        return redirect('login')
                else:
                    messages.error(request, 'Неправильный логин или пароль.')
                    logger.warning(f"Failed login attempt for Username={username}.")
            elif ad_enabled:
                # Если авторизация через AD отключена, используем стандартную аутентификацию
                user_entry = validate_user_credentials(username, password)
                if user_entry:
                    logger.info(f"User {username} validated via AD.")
                    return redirect('chat_dashboard:user_list')
                else:
                    messages.error(request, 'Неправильный логин или пароль.')
                    logger.warning(f"Failed AD login attempt for Username={username}.")
            else:
                messages.error(request, 'Неправильный логин или пароль.')
                logger.warning(f"Failed login attempt for Username={username}.")

    else:
        form = CustomUserLoginForm()

    return render(request, 'authentication/login.html', {'form': form})


@login_required
def logout_view(request):
    """Handles user logout."""
    logger.info(f"User logged out: Username={request.user.username}")
    user = request.user
    user.is_online = False
    user.save()
    logout(request)
    return redirect('authentication:login')

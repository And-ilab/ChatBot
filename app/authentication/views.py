import logging

from click import pause
from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from .forms import UserRegistrationForm, CustomUserLoginForm
from django.contrib import messages
from .auth_with_AD import validate_user_credentials
from django.views.decorators.csrf import csrf_exempt
import jwt

from django.contrib.auth import views as auth_views

import json
from django.http import JsonResponse


from .utils import generate_jwt
from django.contrib.auth.decorators import login_required
from chat_dashboard.models import Settings, User
from django.utils import timezone
from django.urls import reverse
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sites.shortcuts import get_current_site
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.views.generic import View
from django.http import JsonResponse
from django.core.mail import send_mail
from django.contrib.auth.views import PasswordResetConfirmView, PasswordResetCompleteView
from config import settings


logger = logging.getLogger(__name__)


def register_view(request):
    """Handles user registration."""
    logger.info("User registration attempt.")
    if request.method == 'POST':
        logger.info("POST")
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.save()
            logger.info(f"User registered: Username={user.username}, Email={user.email}")
            messages.success(request, 'Поздравляем, вы успешно зарегистрированы!')
            return render(request, 'authentication/login_after_register.html')
        else:
            logger.warning(f"Registration form errors: {form.errors}")
    else:
        form = UserRegistrationForm()

    return render(request, 'authentication/register.html', {'form': form})


def get_ad_authentication_enabled():
    settings_obj, created = Settings.objects.get_or_create(ad_enabled=False)
    return settings_obj.ad_enabled


def login_view(request):
    """Handles user login."""
    logger.info("User login attempt.")
    if request.method == 'POST':
        form = CustomUserLoginForm(request.POST)
        if form.is_valid():
            logger.info("VALID")
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            logger.debug(f"Login attempt: Username={username}")

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
                        logger.info(f"payload:{payload}")


                        if role in ['admin', 'operator']:
                            logger.info(f"User {username} with role {role} redirected to admin dashboard.")
                            return JsonResponse(
                                {"message": "Вход успешен!", "redirect": reverse('chat_dashboard:archive')}, status=200)
                    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                        messages.error(request, 'Ошибка при обработке токена.')
                        logger.error("Token error during login.")
                        return JsonResponse({'error': 'Ошибка при обработке токена.'}, status=400)
                else:
                    logger.warning(f"Failed login attempt for Username={username}.")
                    return JsonResponse({'error': 'Введён неверный логин или пароль.'}, status=400)

            elif ad_enabled:
                user_entry = validate_user_credentials(username, password)
                if user_entry:
                    logger.info(f"User {username} validated via AD.")
                    return JsonResponse({'message': 'Вход успешен!', 'redirect': reverse('chat_dashboard:user_list')},
                                        status=200)
                else:
                    logger.warning(f"Failed AD login attempt for Username={username}.")
                    return JsonResponse({'error': 'Неправильный логин или пароль.'}, status=400)

            else:
                logger.warning(f"Failed login attempt for Username={username}.")
                return JsonResponse({'error': 'Неправильный логин или пароль.'}, status=400)

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


@csrf_exempt
def api_register_view(request):
    """API endpoint for user registration."""
    logger.info(f"User registration attempt")
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            logger.info(f"Data = {data}")
            form = UserRegistrationForm(data)
            if form.is_valid():
                user = form.save(commit=False)
                user.set_password(form.cleaned_data['password'])
                user.save()
                return JsonResponse({'status': 'success', 'username': user.username, 'id': user.id}, status=201)
            else:
                return JsonResponse({'status': 'error', 'errors': form.errors}, status=400)
        except json.JSONDecodeError:
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)


@csrf_exempt
def api_login_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            email = data.get('email')
            password = data.get('password')

            logger.debug(f"Received email: {email}")

            if not email or not password:
                return JsonResponse({'status': 'error', 'message': 'Email and password are required'}, status=400)

            user = authenticate(request, username=email, password=password)
            if user:
                login(request, user)
                return JsonResponse({'status': 'success', 'email': user.email, 'id': user.id}, status=200)
            else:
                return JsonResponse({'status': 'error', 'message': 'Invalid credentials'}, status=401)
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)


def activate_account(request, token):
    try:
        user = User.objects.get(activation_token=token)

        # Проверка времени действия токена
        if user.activation_token_created and (timezone.now() - user.activation_token_created).total_seconds() < 86400:
            user.is_active = True
            user.activation_token = None
            user.activation_token_created = None
            user.save()
            messages.success(request, 'Ваш аккаунт активирован! Вы можете войти.')
            return redirect('authentication:login')  # Перенаправление на страницу входа
        else:
            messages.error(request, 'Токен активации истек или неверен.')
            return redirect('authentication:registration')  # Перенаправление на страницу регистрации
    except User.DoesNotExist:
        messages.error(request, 'Пользователь не найден.')
        return redirect('authentication:registration')


class CustomPasswordResetView(View):
    def post(self, request, *args, **kwargs):
        email = request.POST.get('email')
        user = User.objects.filter(email=email).first()
        address = Settings.objects.get(id=1)
        address = address.ip_address
        if user:
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            reset_link = f"http://{address}/authentication/reset/{uid}/{token}/"  # Замените на ваш домен

            subject = "Сброс пароля"
            message = render_to_string('authentication/password_reset_email.html', {
                'user': user,
                'reset_link': reset_link,
            })
            send_mail(subject, message, None, [email])
            return JsonResponse(
                {'success': True, 'message': f'Ссылка для восстановления пароля отправлена на {email}. Если письма нет во входящих, проверьте папку "Спам".'})

        return JsonResponse({'success': False, 'message': 'Пользователь с таким e-mail не найден.'})


class CustomPasswordResetConfirmView(PasswordResetConfirmView):
    template_name = 'authentication/password_reset_confirm.html'

    def form_valid(self, form):
        # Успешный сброс пароля
        messages.success(self.request, "Ваш пароль успешно сброшен!")
        return super().form_valid(form)

    def form_invalid(self, form):
        messages.error(self.request, "Ошибка при сбросе пароля. Пожалуйста, проверьте введенные данные.")
        return super().form_invalid(form)

    def get_success_url(self):
        # Перенаправление на страницу логина после успешного сброса пароля
        return reverse('authentication:login')  # Замените 'login' на имя вашего URL для логина


class CustomPasswordResetCompleteView(auth_views.PasswordResetCompleteView):
    template_name = 'authentication/password_reset_complete.html'

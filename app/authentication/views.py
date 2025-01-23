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
from config import config_settings


logger = logging.getLogger('authentication')


def register_view(request):
    logger.info("User registration page accessed.")
    if request.method == 'POST':
        logger.debug("POST request received for registration.")
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.save()
            logger.info(f"User registered successfully: Username={user.username}, Email={user.email}")
            messages.success(request, 'Поздравляем, вы успешно зарегистрированы!')
            return render(request, 'authentication/login_after_register.html')
        else:
            logger.warning(f"Registration failed. Errors: {form.errors}")
    else:
        logger.debug("GET request received for registration page.")
        form = UserRegistrationForm()

    return render(request, 'authentication/register.html', {'form': form})


def get_ad_authentication_enabled():
    settings_obj, created = Settings.objects.get_or_create(ad_enabled=False)
    return settings_obj.ad_enabled


def login_view(request):
    logger.info("User login page accessed.")
    if request.method == 'POST':
        logger.debug("POST request received for login.")
        form = CustomUserLoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            logger.debug(f"Login attempt: Username={username}")

            ad_enabled = get_ad_authentication_enabled()
            logger.debug(f"AD authentication enabled: {ad_enabled}")

            if not ad_enabled and '@' in username:
                user = authenticate(request, username=username, password=password)
                if user:
                    logger.info(f"User authenticated: Username={username}")
                    login(request, user)
                    token = generate_jwt(user)
                    request.session['token'] = token
                    logger.debug(f"JWT generated for user {username}: {token}")

                    try:
                        payload = jwt.decode(token, config_settings.SECRET_KEY, algorithms=['HS256'])

                        logger.info(f"JWT payload for user {username}: {payload}")

                        role = payload.get('role')

                        if role in ['admin', 'operator']:
                            logger.info(f"Redirecting user {username} with role {role} to dashboard.")
                            return JsonResponse(
                                {"message": "Вход успешен!", "redirect": reverse('chat_dashboard:archive')}, status=200)
                    except jwt.ExpiredSignatureError:
                        logger.error(f"Expired JWT token for user {username}.")
                        return JsonResponse({'error': 'Токен истёк.'}, status=400)
                    except jwt.InvalidTokenError:
                        logger.error(f"Invalid JWT token for user {username}.")
                        return JsonResponse({'error': 'Недействительный токен.'}, status=400)
                else:
                    logger.warning(f"Invalid credentials for Username={username}.")
                    return JsonResponse({'error': 'Неправильный логин или пароль.'}, status=400)
            elif ad_enabled:
                user_entry = validate_user_credentials(username, password)
                if user_entry:
                    logger.info(f"User {username} authenticated via AD.")
                    return JsonResponse({'message': 'Вход успешен!', 'redirect': reverse('chat_dashboard:user_list')},
                                        status=200)
                else:
                    logger.warning(f"AD authentication failed for Username={username}.")
                    return JsonResponse({'error': 'Неправильный логин или пароль.'}, status=400)
            else:
                logger.warning(f"Login failed for Username={username}. Unknown error.")
                return JsonResponse({'error': 'Ошибка входа.'}, status=400)
        else:
            logger.warning("Login form invalid.")
    else:
        logger.debug("GET request received for login page.")
        form = CustomUserLoginForm()

    return render(request, 'authentication/login.html', {'form': form})

@login_required
def logout_view(request):
    user = request.user
    logger.info(f"User logout: Username={user.username}")
    user.is_online = False
    user.save()
    logout(request)
    logger.debug(f"User {user.username} logged out successfully.")
    return redirect('authentication:login')



@csrf_exempt
def api_register_view(request):
    logger.info("API registration endpoint accessed.")
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            logger.debug(f"Registration data received: {data}")
            form = UserRegistrationForm(data)
            if form.is_valid():
                user = form.save(commit=False)
                user.set_password(form.cleaned_data['password'])
                user.save()
                logger.info(f"User registered via API: Username={user.username}, Email={user.email}")
                return JsonResponse({'status': 'success', 'username': user.username, 'id': user.id}, status=201)
            else:
                logger.warning(f"API registration failed. Errors: {form.errors}")
                return JsonResponse({'status': 'error', 'errors': form.errors}, status=400)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON received: {e}")
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    logger.warning("Invalid request method for API registration.")
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)



@csrf_exempt
def api_login_view(request):
    """API endpoint for user login."""
    logger.info("API login endpoint accessed.")
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            email = data.get('email')
            password = data.get('password')

            logger.debug(f"Received login attempt. Email: {email}")

            if not email or not password:
                logger.warning("Missing email or password in login attempt.")
                return JsonResponse({'status': 'error', 'message': 'Email and password are required'}, status=400)

            user = authenticate(request, username=email, password=password)
            if user:
                login(request, user)
                logger.info(f"User successfully logged in: Email={email}, UserID={user.id}")
                return JsonResponse({'status': 'success', 'email': user.email, 'id': user.id}, status=200)
            else:
                logger.warning(f"Invalid credentials provided for email: {email}")
                return JsonResponse({'status': 'error', 'message': 'Invalid credentials'}, status=401)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON received during login. Error: {e}")
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    logger.warning("Invalid request method for API login endpoint.")
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)



def activate_account(request, token):
    """Handles user account activation via token."""
    logger.info(f"Account activation attempt with token: {token}")
    try:
        user = User.objects.get(activation_token=token)
        if user.activation_token_created and (timezone.now() - user.activation_token_created).total_seconds() < 86400:
            user.is_active = True
            user.activation_token = None
            user.activation_token_created = None
            user.save()
            logger.info(f"Account successfully activated for user: {user.username} (ID={user.id})")
            messages.success(request, 'Ваш аккаунт активирован! Вы можете войти.')
            return redirect('authentication:login')
        else:
            logger.warning(f"Expired or invalid activation token for user: {user.username} (ID={user.id})")
            messages.error(request, 'Токен активации истек или неверен.')
            return redirect('authentication:registration')
    except User.DoesNotExist:
        logger.error(f"Activation failed: User with token {token} does not exist.")
        messages.error(request, 'Пользователь не найден.')
        return redirect('authentication:registration')


class CustomPasswordResetView(View):
    """Handles password reset via email."""
    def post(self, request, *args, **kwargs):
        email = request.POST.get('email')
        logger.info(f"Password reset requested for email: {email}")
        user = User.objects.filter(email=email).first()
        address = Settings.objects.get(id=1).ip_address
        if user:
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            reset_link = f"http://{address}/authentication/reset/{uid}/{token}/"

            logger.info(f"Generated password reset link for user: {email}, ResetLink: {reset_link}")

            subject = "Сброс пароля"
            message = render_to_string('authentication/password_reset_email.html', {
                'user': user,
                'reset_link': reset_link,
            })
            send_mail(subject, message, None, [email])
            logger.info(f"Password reset email sent to: {email}")
            return JsonResponse(
                {'success': True, 'message': f'Ссылка для восстановления пароля отправлена на {email}. Если письма нет во входящих, проверьте папку "Спам".'}
            )
        logger.warning(f"Password reset requested for non-existent email: {email}")
        return JsonResponse({'success': False, 'message': 'Пользователь с таким e-mail не найден.'})


class CustomPasswordResetConfirmView(PasswordResetConfirmView):
    """Handles password reset confirmation."""
    template_name = 'authentication/password_reset_confirm.html'

    def form_valid(self, form):
        user = form.user
        logger.info(f"Password reset confirmed for user: {user.username} (ID={user.id})")
        messages.success(self.request, "Ваш пароль успешно сброшен!")
        return super().form_valid(form)

    def form_invalid(self, form):
        logger.warning("Invalid password reset confirmation form submission.")
        messages.error(self.request, "Ошибка при сбросе пароля. Пожалуйста, проверьте введенные данные.")
        return super().form_invalid(form)

    def get_success_url(self):
        logger.debug("Redirecting to login page after successful password reset.")
        return reverse('authentication:login')


class CustomPasswordResetCompleteView(auth_views.PasswordResetCompleteView):
    """Handles the final stage of password reset."""
    template_name = 'authentication/password_reset_complete.html'

    def dispatch(self, *args, **kwargs):
        logger.info("Password reset complete page accessed.")
        return super().dispatch(*args, **kwargs)

from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from .forms import UserRegistrationForm, UserLoginForm
from django.contrib import messages
from .auth_with_AD import ldap_authenticate


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


def login_view2(request):
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']

        if ldap_authenticate(username, password):
            # Если аутентификация успешна, вы можете создать сессию пользователя
            # Здесь вы можете настроить сессию пользователя в Django
            return redirect('home')  # Перенаправление на домашнюю страницу
        else:
            return render(request, 'registration/login.html', {'error': 'Неверное имя пользователя или пароль.'})

    return render(request, 'registration/login.html')


def login_view(request):
    if request.method == 'POST':
        form = UserLoginForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                return redirect('chat_dashboard:user_list')
            else:
                messages.error(request, 'Неправильный логин или пароль.')
    else:
        form = UserLoginForm()
    return render(request, 'authentication/login.html', {'form': form})


def logout_view(request):
    logout(request)
    return redirect('chat_dashboard:user_list')

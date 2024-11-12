from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from .forms import UserRegistrationForm, CustomUserLoginForm
from django.contrib import messages
from .auth_with_AD import validate_user_credentials


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

            if '@' in username:
                user = authenticate(request, username=username, password=password)
                if user is not None:
                    login(request, user)
                    return redirect('chat_dashboard:user_list')
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


def logout_view(request):
    logout(request)
    return redirect('authentication:login')
from django.shortcuts import render, redirect, get_object_or_404
from .models import User
from .forms import UserForm


def user_list(request):
    users = User.objects.all()
    return render(request, 'chat_dashboard/index.html', {'users': users})


def user_create(request):
    if request.method == 'POST':
        form = UserForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.save()
            return redirect('chat_dashboard:user_list')
    else:
        form = UserForm()
    return render(request, 'chat_dashboard/user_form.html', {'form': form})


def user_update(request, pk):
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        form = UserForm(request.POST, instance=user)
        if form.is_valid():
            form.save()
            return redirect('chat_dashboard:user_list')
    else:
        form = UserForm(instance=user)
    return render(request, 'chat_dashboard/user_form.html', {'form': form})


def user_delete(request, pk):
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        user.delete()
        return redirect('chat_dashboard:user_list')
    return render(request, 'chat_dashboard/user_confirm_delete.html', {'user': user})


def home(request):
    return render(request, 'home.html')

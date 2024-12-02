from django.db import models
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, Group, Permission


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

    def get_by_natural_key(self, email):
        return self.get(email=email)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('user', 'Пользователь'),
        ('admin', 'Администратор'),
        ('operator', 'Оператор'),
    ]

    id = models.AutoField(primary_key=True)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=50, unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    is_staff = models.BooleanField(default=False)

    groups = models.ManyToManyField(
        Group,
        related_name="custom_user_set",
        blank=True,
        help_text="Группы, к которым принадлежит пользователь."
    )

    user_permissions = models.ManyToManyField(
        Permission,
        related_name="custom_user_permissions",
        blank=True,
        help_text="Разрешения, которые назначены пользователю."
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'role']

    objects = UserManager()

    def __str__(self):
        return f"{self.username} ({self.role})"


class Dialog(models.Model):
    user = models.ForeignKey('chat_dashboard.User', on_delete=models.CASCADE)
    started_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Диалог {self.id} с {self.user.username} начат {self.started_at}"


class Message(models.Model):
    SENDER_CHOICES = [
        ('user', 'User'),
        ('bot', 'Bot'),
    ]

    dialog = models.ForeignKey(Dialog, on_delete=models.CASCADE, related_name="messages")
    sender_type = models.CharField(max_length=4, choices=SENDER_CHOICES, default="bot")
    sender = models.ForeignKey('chat_dashboard.User', null=True, blank=True, on_delete=models.SET_NULL)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_sender_type_display()} - {self.content[:20]}"


class TrainingMessage(models.Model):
    sender = models.ForeignKey(
        'chat_dashboard.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_ignored = models.BooleanField(default=False)
    is_unread = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.sender} - {self.content[:20]}"

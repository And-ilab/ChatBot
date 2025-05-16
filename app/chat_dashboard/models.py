import uuid
from django.db import models
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, Group, Permission
from django.utils import timezone


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
        ('admin', 'Администратор'),
        ('operator', 'Оператор'),
    ]

    id = models.AutoField(primary_key=True)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=50)
    first_name = models.CharField(max_length=50)  # Новое поле
    last_name = models.CharField(max_length=50, blank=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='operator')
    is_staff = models.BooleanField(default=False)
    last_active = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)
    is_active = models.BooleanField(default=False)
    activation_token = models.CharField(max_length=32, blank=True, null=True)
    activation_token_created = models.DateTimeField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = f"{self.first_name[0].upper()}.{self.last_name}"
        super().save(*args, **kwargs)

    def update_last_active(self):
        self.last_active = timezone.now()
        self.is_online = True
        self.save()

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

    def get_role_display(self):
        return dict(self.ROLE_CHOICES).get(self.role, self.role)


class Dialog(models.Model):
    user = models.ForeignKey('chat_user.ChatUser', on_delete=models.CASCADE)
    started_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Диалог {self.id} с {self.user.username} начат {self.started_at}"


class Message(models.Model):
    SENDER_CHOICES = [
        ('user', 'User'),
        ('bot', 'Bot'),
    ]

    MESSAGE_TYPE_CHOICES = [
        ('message', 'Message'),
        ('document', 'Document'),
        ('link', 'Link'),
        ('like', 'Like'),
        ('dislike', 'Dislike'),
        ('operator', 'Operator')
    ]

    dialog = models.ForeignKey(Dialog, on_delete=models.CASCADE, related_name="messages")
    sender_type = models.CharField(max_length=4, choices=SENDER_CHOICES, default="bot")
    sender = models.ForeignKey('chat_user.ChatUser', null=True, blank=True, on_delete=models.SET_NULL)
    content = models.TextField()
    message_type = models.CharField(max_length=8, choices=MESSAGE_TYPE_CHOICES, default="message")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_sender_type_display()} ({self.get_message_type_display()}) - {self.content[:20]}"


class TrainingMessage(models.Model):
    sender = models.ForeignKey(
        'chat_user.ChatUser',
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )
    content = models.TextField()
    neural_message = models.TextField(default='')
    recognized_message = models.TextField(default='')
    created_at = models.DateTimeField(auto_now_add=True)
    is_ignored = models.BooleanField(default=False)
    is_unread = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.sender} - {self.content[:20]}"

class Settings(models.Model):
    ad_enabled = models.BooleanField(default=False)
    message_retention_days = models.PositiveIntegerField(default=30)
    ldap_server = models.CharField(max_length=100, default='ldap://company.local')
    domain = models.CharField(max_length=50, default='COMPANY')
    session_duration = models.PositiveIntegerField(default=30)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    logs_backup = models.PositiveIntegerField(default=30)
    neural_active = models.BooleanField(default=False)

    def __str__(self):
        return f"Settings(ad_enabled={self.ad_enabled}, message_retention_days={self.message_retention_days}, session_duration={self.session_duration})"


class PopularRequests(models.Model):
    sender = models.ForeignKey('chat_user.ChatUser', null=True, blank=True, on_delete=models.SET_NULL)
    type = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Documents(models.Model):
    document_name = models.CharField(max_length=255)  # Укажите максимальную длину
    document_uuid = models.CharField(max_length=36, unique=True, default=uuid.uuid4)
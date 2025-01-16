from django.db import models
from django.utils.timezone import now


class ChatUser(models.Model):
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def username(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Session(models.Model):
    user = models.ForeignKey(ChatUser, on_delete=models.CASCADE)
    session_token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_active(self):
        """Проверка, активна ли сессия."""

        return now() < self.expires_at

    def __str__(self):
        return f"Session for {self.user.email}"

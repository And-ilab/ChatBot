from django.db import models
from django.utils.timezone import now


class ChatUser(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Администратор'),
        ('operator', 'Оператор'),
        ('user', 'Пользователь'),
    ]
    id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    tabel_number = models.CharField(max_length=100, default='b0000000')
    title = models.CharField(max_length=100, default='No info')
    company = models.CharField(max_length=100, default='No info')
    department = models.CharField(max_length=100, default='No info')
    email = models.EmailField(unique=True)
    is_archived = models.BooleanField(default=False, verbose_name="Архивный")
    created_at = models.DateTimeField(auto_now_add=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')

    @property
    def username(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    def get_role_display(self):
        return dict(self.ROLE_CHOICES).get(self.role, self.role)


class Session(models.Model):
    user = models.ForeignKey(ChatUser, on_delete=models.CASCADE)
    session_token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_active(self):
        return now() < self.expires_at

    def __str__(self):
        return f"Session for {self.user.email}"


class Feedbacks(models.Model):
    FEEDBACK_TYPE = [
        ("like", "Лайк"),
        ("dislike", "Дизлайк")
    ]

    user = models.ForeignKey(ChatUser, on_delete=models.CASCADE)
    message_type = models.CharField(
        max_length=10, choices=FEEDBACK_TYPE
    )
    answer_content = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.message_type}"
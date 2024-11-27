from django.db import models

# Create your models here.
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
from rest_framework import serializers
from .models import Feedbacks

class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedbacks
        fields = ["user", "message_type", "answer_content", "created_at"]

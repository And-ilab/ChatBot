from django.dispatch import receiver
import logging
from chat_dashboard.models import User
from django.db.models.signals import post_save
from django.core.mail import send_mail
from config import config_settings
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.urls import reverse
from chat_dashboard.models import Settings

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def user_postsave(sender, instance, created, **kwargs):
    if created:
        # Генерация токена
        token = get_random_string(length=32)
        instance.activation_token = token
        instance.activation_token_created = timezone.now()
        instance.save()
        s = Settings.objects.get(id=1)
        ip = s.ip_address

        activation_link =  'https://chatbot.digitranslab.com'
        activation_link = f"{activation_link}{reverse('authentication:activate_account', args=[token])}"

        subject = 'Подтверждение регистрации на платформе HelpDeskBot'
        message = f'''Уважаемый(ая) {instance.username},
Благодарим вас за регистрацию на нашей платформе "Интеллектуальная платформа взаимодействия с пользователями HelpDeskBot"!
Ваш аккаунт успешно создан. Пожалуйста, подтвердите вашу регистрацию, нажав на ссылку ниже:
{activation_link}
Если вы не регистрировались на нашей платформе, пожалуйста, проигнорируйте это письмо.
Регистрация будет сброшена в этом случае автоматически по истечении 24 часов.
Если у вас возникли вопросы или вам нужна помощь, не стесняйтесь обращаться к нашей службе поддержки по адресу: HelpDesk@digitranslab.com
С уважением,
Команда HelpDeskBot'''

        from_email = 'sapunowdany@yandex.by'
        to_email = instance.email
        logger.info(f'Sending email from {from_email} to {to_email}')
        send_mail(subject, message, from_email, [to_email], fail_silently=False)

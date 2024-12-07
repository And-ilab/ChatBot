from django.dispatch import receiver
from chat_dashboard.models import User
from django.db.models.signals import post_save
from django.core.mail import send_mail
from app.config import settings


@receiver(post_save, sender=User)
def user_postsave(sender, instance, created, **kwargs):
    if created:
        subject = 'Подтверждение регистрации на платформе HelpDeskBot'
        message = f'''Уважаемый(ая) [{instance.username}],
Благодарим вас за регистрацию на нашей платформе "Интеллектуальная платформа взаимодействия с пользователями HelpDeskBot"!
Ваш аккаунт успешно создан. Пожалуйста, подтвердите вашу регистрацию, нажав на ссылку ниже:
[Ссылка для подтверждения]???
Если вы не регистрировались на нашей платформе, пожалуйста, проигнорируйте это письмо.
Регистрация будет сброшена в этом случаи автоматически по истечении 24 часов.
Если у вас возникли вопросы или вам нужна помощь, не стесняйтесь обращаться к нашей службе поддержки по адресу: HelpDesk@digitranslab.com
С уважением,
Команда HelpDeskBot'''
        from_email = settings.EMAIL_HOST
        to_email = instance.email
        send_mail(subject, message, from_email, [to_email], fail_silently=False)

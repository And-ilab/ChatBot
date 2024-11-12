from django.core.mail import send_mail
from django.http import HttpResponse

def send(email):
        subject = 'Тестовое письмо'
        message = 'Это тестовое письмо, отправленное из Django приложения.'
        sender_email = 'Postmaster@company.local'  # Замените на ваш адрес отправителя

        send_mail(subject, message, sender_email, [email])
        return HttpResponse("Письма успешно отправлены!")
from django.core.mail import send_mail
from django.http import HttpResponse

# def send(email):
#         subject = 'Тестовое письмо'
#         message = 'Это тестовое письмо, отправленное из Django приложения.'
#         sender_email = 'Postmaster@company.local'  # Замените на ваш адрес отправителя
#
#         send_mail(subject, message, sender_email, [email])
#         return HttpResponse("Письма успешно отправлены!")

def send_email(request, email):
    subject = 'Тема письма'
    message = 'Содержимое письма'
    from_email = '99helpforyou66@gmail.com'
    recipient_list = [f'{email}']  # Замените на адрес получателя

    try:
        send_mail(subject, message, from_email, recipient_list)
        return HttpResponse('Письмо отправлено успешно!')
    except Exception as e:
        return HttpResponse(f'Ошибка при отправке письма: {e}')
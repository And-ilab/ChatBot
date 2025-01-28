from django.apps import apps

def get_backup_value():
    Settings = apps.get_model('chat_dashboard', 'Settings')
    setting = Settings.objects.first()  # Или любой другой запрос для получения нужного значения
    return setting.backup if setting else 30
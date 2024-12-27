from django import template
from datetime import timedelta

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """Возвращает элемент словаря по ключу."""
    return dictionary.get(key)

@register.filter
def add_hours(value, hours):
    """Добавляет указанное количество часов к дате."""
    if value:
        return value + timedelta(hours=hours)
    return value
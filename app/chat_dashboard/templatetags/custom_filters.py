from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """Возвращает элемент словаря по ключу."""
    return dictionary.get(key)
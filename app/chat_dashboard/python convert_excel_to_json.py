import pandas as pd
import json

# Путь к вашему Excel файлу
excel_file = '/home/daniil/Загрузки/Вопросы и ответы Чат-бот ч.1 (1).xlsx'

# Название страницы
page_title = 'Организационно-кадровая работа'

# Считываем данные из Excel
df = pd.read_excel(excel_file, sheet_name=page_title, engine='openpyxl', skiprows=0)

# Удаляем лишние пробелы из названий столбцов
df.columns = df.columns.str.strip()

# Заменяем значения NaN на пустые строки
df = df.fillna('')

# Проверка необходимых столбцов
required_columns = ['Вопросы', 'Готовый ответ', 'Ссылка', 'Название ссылки', 'Документ', 'Название документа', 'НПА', 'ЛПА']
for col in required_columns:
    if col not in df.columns:
        raise ValueError(f"Отсутствует необходимый столбец: {col}")

# Создаём итоговую структуру JSON
final_data = {page_title: []}

# Заполняем структуру данными
for index, row in df.iterrows():
    question = row.get('Вопросы', '').strip()

    # Проверяем, что вопрос не пустой и не состоит из одного символа
    if question and len(question) > 1:
        question_data = {
            'Вопрос': question,
            'Готовый ответ': row.get('Готовый ответ', ''),
            'Ссылка': row.get('Ссылка', ''),
            'Название ссылки': row.get('Название ссылки', ''),
            'Документ': row.get('Документ', ''),
            'Название документа': row.get('Название документа', ''),
            'НПА': row.get('НПА', ''),
            'ЛПА': row.get('ЛПА', '')
        }
        final_data[page_title].append(question_data)

# Проверяем, что все данные извлечены
print("Количество извлеченных записей:", len(final_data[page_title]))

# Записываем данные в JSON файл
output_file = 'Организационно-кадровая работа.json'
with open(output_file, 'w', encoding='utf-8') as json_file:
    json.dump(final_data, json_file, ensure_ascii=False, indent=4)

print(f"JSON файл успешно создан: {output_file}")
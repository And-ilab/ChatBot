// Получение CSRF-токена
export const getCSRFToken = () => {
  const csrfTokenMeta = document.querySelector("meta[name='csrf-token']");
  return csrfTokenMeta ? csrfTokenMeta.getAttribute('content') : '';
};

// Функция для выполнения запросов
export const fetchData = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Ошибка: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ошибка выполнения запроса:', error);
    throw error;
  }
};
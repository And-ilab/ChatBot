const chatToggle = document.getElementById('user-chat-toggle');
const chatWindow = document.getElementById('user-chat-window');
const closeChat = document.getElementById('user-close-chat');
const sendMessage = document.getElementById('user-send-message');
const chatMessages = document.getElementById('user-chat-messages');
const chatInput = document.getElementById('user-chat-input');
const dialogId = String(chatToggle.getAttribute('data-dialog-id'));
const userId = chatToggle.getAttribute('data-user-id');

// Закрытие чата
closeChat.addEventListener('click', () => {
  chatWindow.style.display = 'none';
});

// Получение CSRF токена
const getCSRFToken = () => {
  const csrfTokenMeta = document.querySelector("meta[name='csrf-token']");
  return csrfTokenMeta ? csrfTokenMeta.getAttribute('content') : '';
};

// Загрузка сообщений
const loadMessages = async () => {
  try {
    console.log('ID диалога:', dialogId);
    console.log('ID пользователя:', userId);

    chatWindow.style.display = 'block';
    const response = await fetch(`/api/messages/${dialogId}/`);
    const data = await response.json();

    chatMessages.innerHTML = '';
    data.messages.forEach(({ sender, content }) => {
      appendMessage(sender === 'Bot' ? 'Бот' : 'Вы', content, sender === 'Bot');
    });
    scrollToBottom();
  } catch (error) {
    console.error('Ошибка загрузки сообщений:', error);
  }
};

// Отправка сообщения
const sendUserMessage = async () => {
  const message = chatInput.value.trim();
  if (!message) return;

  console.log('Отправляемое сообщение:', message);
  appendMessage('Вы', message, false);

  chatInput.value = '';
  try {
    await sendMessageToAPI('user', message);
    if (message.endsWith('?')) {
      await handleQuestion(message);
    } else {
      const botMessage = 'Простите, я не знаю как ответить на Ваше сообщение.';
      appendMessage('Бот', botMessage, true);
      await saveBotMessage(botMessage);
    }
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
  }
};

// Обработка вопросов
const handleQuestion = async (message) => {
  try {
    const encodedQuestion = encodeURIComponent(message);
    const response = await fetch(`/api/process-keywords/?question=${encodedQuestion}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Ошибка: ${response.status}`);
    }

    const data = await response.json();
    appendMessage('Бот', data.content, true);
    await saveBotMessage(data.content);
  } catch (error) {
    console.error('Ошибка обработки вопроса:', error);
    const fallbackMessage = 'Не удалось обработать Ваше сообщение. Отправляю его на обучение.';
    appendMessage('Бот', fallbackMessage, true);
    await saveBotMessage(fallbackMessage);
    await sendTrainingMessage(message);
  }
};

// Отправка сообщения на API
const sendMessageToAPI = async (senderType, content) => {
  await fetch(`/api/send-message/${dialogId}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCSRFToken(),
    },
    body: JSON.stringify({
      sender_type: senderType,
      sender_id: senderType === 'user' ? userId : undefined,
      content,
    }),
  });
};

// Сохранение сообщения бота
const saveBotMessage = async (content) => {
  try {
    await sendMessageToAPI('bot', content);
  } catch (error) {
    console.error('Ошибка при сохранении сообщения бота:', error);
  }
};

// Отправка сообщения на обучение
const sendTrainingMessage = async (content) => {
  try {
    const response = await fetch('/api/create-training-message/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFToken(),
      },
      body: JSON.stringify({
        sender_id: userId,
        content,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Ошибка: ${response.status}`);
    }

    console.log('Сообщение успешно отправлено на обучение');
  } catch (error) {
    console.error('Ошибка при отправке сообщения на обучение:', error);
  }
};

// Добавление сообщения в интерфейс
const appendMessage = (sender, content, isBot) => {
  const messageDiv = document.createElement('div');
  messageDiv.className = isBot ? 'bot-message' : 'user-message';
  messageDiv.innerHTML = `<strong>${sender}:</strong> ${content}`;
  chatMessages.appendChild(messageDiv);

  setTimeout(scrollToBottom, 0);
};

// Прокрутка вниз
const scrollToBottom = () => {
  chatMessages.scrollTop = chatMessages.scrollHeight;
};

// Добавление обработчиков
chatToggle.addEventListener('click', loadMessages);
sendMessage.addEventListener('click', sendUserMessage);

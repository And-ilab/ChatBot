const chatToggle = document.getElementById('user-chat-toggle');
const chatWindow = document.getElementById('user-chat-window');
const closeChat = document.getElementById('user-close-chat');
const sendMessage = document.getElementById('user-send-message');
const chatMessages = document.getElementById('user-chat-messages');
const chatInput = document.getElementById('user-chat-input');
const dialogId = String(chatToggle.getAttribute('data-dialog-id'));
const userId = chatToggle.getAttribute('data-user-id');


const loadMessages = () => {
  chatWindow.style.display = 'block';
  fetch(`/api/messages/${dialogId}/`)
    .then(response => response.json())
    .then(data => {
      chatMessages.innerHTML = '';
      data.messages.forEach(({ sender, content }) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'Bot' ? 'bot-message' : 'user-message';
        messageDiv.innerHTML = `<strong>${sender === 'Bot' ? 'Бот' : 'Вы'}:</strong> ${content}`;
        chatMessages.appendChild(messageDiv);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    })
    .catch(error => console.error('Ошибка загрузки сообщений:', error));
};


closeChat.addEventListener('click', () => {
  chatWindow.style.display = 'none';
});


const getCSRFToken = () => {
  const csrfTokenMeta = document.querySelector("meta[name='csrf-token']");
  return csrfTokenMeta ? csrfTokenMeta.getAttribute('content') : '';
};


const sendUserMessage = () => {
  const message = chatInput.value.trim();
  if (!message) return;
  const userMessage = document.createElement('div');
  userMessage.className = 'user-message';
  userMessage.innerHTML = `<strong>Вы:</strong> ${message}`;
  chatMessages.appendChild(userMessage);
  chatInput.value = '';

  fetch(`/api/send-message/${dialogId}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCSRFToken()
    },
    body: JSON.stringify({
      sender_type: 'user',
      sender_id: userId,
      content: message
    })
  })
    .then(response => response.json())
    .then(data => {
      if (message.endsWith('?')) {
        handleQuestion(message);
      } else {
          const botMsg = document.createElement('div');
          const botMsgContent = 'Простите, я не знаю как ответить на Ваше сообщение.'
          botMsg.className = 'bot-message';
          botMsg.innerHTML = `<strong>Бот:</strong> ${botMsgContent}`;
          chatMessages.appendChild(botMsg);
          chatMessages.scrollTop = chatMessages.scrollHeight;
          saveBotMessage(botMsgContent);
      }
      chatMessages.scrollTop = chatMessages.scrollHeight;
    })
    .catch(error => {
      console.error('Ошибка при отправке сообщения:', error);
    });
};


const handleQuestion = message => {
  const encodedQuestion = encodeURIComponent(message);
  fetch(`/api/process-keywords/?question=${encodedQuestion}`)
    .then(response => {
        if (!response.ok) {
            // Если статус не успешный (например, 404), выбрасываем ошибку
            return response.json().then(errorData => {
                throw new Error(errorData.error || `Ошибка: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        // Если нет ошибок, обрабатываем успешный ответ
        const botMessage = document.createElement('div');
        botMessage.className = 'bot-message';
        botMessage.innerHTML = `<strong>Бот:</strong> ${data.content}`;
        chatMessages.appendChild(botMessage);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        saveBotMessage(data.content);
    })
    .catch(error => {
        const botMessage = document.createElement('div');
        const botMessageContent = "Не удалось обработать Ваше сообщение. Отправляю его на обучение.";
        botMessage.className = 'bot-message';
        botMessage.innerHTML = `<strong>Бот:</strong> ${botMessageContent}`;
        chatMessages.appendChild(botMessage);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        saveBotMessage(botMessageContent);
        fetch('/api/create-training-message/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken(),
            },
            body: JSON.stringify({
                sender_id: userId,
                content: message, // Исходное сообщение пользователя
            }),
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || `Ошибка: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Сообщение успешно отправлено на обучение:', data);
        })
        .catch(trainError => {
            console.error('Ошибка при отправке сообщения на обучение:', trainError);
        });
    });
};


const saveBotMessage = (content) => {
  fetch(`/api/send-message/${dialogId}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCSRFToken()
    },
    body: JSON.stringify({
      sender_type: 'bot',
      content
    })
  }).catch(error => {
    console.error('Ошибка при сохранении сообщения бота:', error);
  });
};


chatToggle.addEventListener('click', loadMessages);
sendMessage.addEventListener('click', sendUserMessage)
const loadMessages = () => {
  console.log('ID диалога:', dialogId);
  console.log('ID пользователя:', userId);
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

const sendUserMessage = () => {
  const message = chatInput.value.trim();
  if (!message) return;

  console.log('Отправляемое сообщение:', message);
  console.log('ID диалога:', dialogId);
  console.log('ID пользователя:', userId);

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
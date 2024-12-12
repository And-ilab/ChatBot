const chatToggle = document.getElementById('user-chat-toggle');
const chatWindow = document.getElementById('user-chat-window');
const closeChat = document.getElementById('user-close-chat');
const chatInput = document.getElementById('user-chat-input');
const sendMessageButton = document.getElementById('user-send-message');
const chatMessages = document.getElementById('user-chat-messages');
const chatLogin = document.getElementById('chat-login-wrapper');

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const switchToRegister = document.getElementById("switch-to-register");
const switchToLogin = document.getElementById("switch-to-login");
const chatLoginHeader = document.getElementById("chat-login-header");

const greetings = [
    'привет', 'здравствуй', 'добрый день', 'добрый вечер', 'приветствую',
    'здравия желаю', 'хай', 'хей', 'здарова', 'здаров', 'здорова', 'здоров',
    'салам', 'доброй ночи', 'приветик', 'хаюшки'
];


let dialogId;
let userId;
let username;
let started_at;


closeChat.addEventListener('click', () => {
    chatWindow.style.display = 'none';
});

const getCSRFToken = () => {
    const csrfTokenMeta = document.querySelector("meta[name='csrf-token']");
    return csrfTokenMeta ? csrfTokenMeta.getAttribute('content') : '';
};

const loadMessages = async () => {
    try {
        console.log('ID пользователя:', userId);

        const dialogResponse = await fetch(`/api/dialogs/${userId}/`);
        if (!dialogResponse.ok) {
            throw new Error('Ошибка загрузки диалога');
        }

        const dialogData = await dialogResponse.json();
        console.log('Данные:', dialogData);

        dialogId = dialogData.dialog_id;
        username = dialogData.username;
        started_at = dialogData.started_at;

        console.log('ID диалога:', dialogId);
        console.log('Имя пользователя:', username);
        console.log('Дата начала диалога:', started_at);

        const messagesResponse = await fetch(`/api/messages/${dialogId}/`);
        const data = await messagesResponse.json();

        chatMessages.innerHTML = '';
        data.messages.forEach(({ sender, content, timestamp }) => {
          appendMessage(sender, content, timestamp);
        });
        scrollToBottom();
    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
    }
};


const scrollToBottom = () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
};


chatToggle.addEventListener('click', () => {
    chatWindow.style.display = 'block';
});


switchToRegister.addEventListener("click", function (e) {
    e.preventDefault();
    loginForm.style.display = "none";
    registerForm.style.display = "flex";
    chatLoginHeader.textContent = "Регистрация";
});

switchToLogin.addEventListener("click", function (e) {
    e.preventDefault();
    registerForm.style.display = "none";
    loginForm.style.display = "flex";
    chatLoginHeader.textContent = "Авторизация";
});


registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const formData = new FormData(registerForm);
    const jsonData = Object.fromEntries(formData.entries());

    const response = await fetch("/api/register/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonData),
    });

    const result = await response.json();
    if (response.ok) {
        switchToLogin.click();
    } else {
        console.error(result.errors || result.message);
        alert("Ошибка регистрации");
    }
});


loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const jsonData = Object.fromEntries(formData.entries());

    const response = await fetch("/api/login/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonData),
    });

    const result = await response.json();

    if (response.ok) {
        chatLogin.style.display = 'none';
        chatMessages.style.display = 'flex';
        userId = result.id;
        loadMessages();
    } else {
        console.error(result.message);
        alert("Ошибка авторизации");
    }
});


let lastMessageDate = null;

const appendMessage = (sender, content, timestamp) => {
    // Убираем все кнопки в чате перед добавлением нового сообщения
    const buttonsContainer = document.querySelector('.chat-buttons-container');
    if (buttonsContainer) {
        buttonsContainer.remove();
    }

    // Создаем новое сообщение
    const messageDiv = document.createElement('div');
    messageDiv.className = sender === 'bot' ? 'message bot-message' : 'message user-message';
    const time = timestamp.split(' ')[1].slice(0, 5);
    const timeClass = sender === 'bot' ? 'message-time' : 'message-time user-message-time';

    const messageDate = timestamp.split(' ')[0];
    const formattedDate = formatDate(messageDate);

    const messages = chatMessages.querySelectorAll('.message');

    if (messages.length === 0 || messageDate !== messages[messages.length - 1].dataset.date) {
        const dateWrapper = document.createElement('div');
        dateWrapper.className = 'message-date-wrapper';
        const dateContent = document.createElement('div');
        dateContent.className = 'message-date-content';
        dateContent.innerHTML = formattedDate;
        dateWrapper.appendChild(dateContent);
        chatMessages.appendChild(dateWrapper);
    }

    messageDiv.innerHTML = ` 
        <strong>${sender === 'bot' ? 'Бот' : 'Вы'}:</strong> ${content}
        <div class="${timeClass}">${time}</div>
    `;
    messageDiv.dataset.date = messageDate;
    chatMessages.appendChild(messageDiv);
    setTimeout(scrollToBottom, 0);
};



const sendMessageToAPI = async (senderType, content, timestamp) => {
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
        timestamp
      }),
    });
};


const sendBotMessage = async (content) => {
    try {
        const timestamp = getTimestamp();
        await sendMessageToAPI('bot', content, timestamp);
    } catch (error) {
        console.error('Ошибка при сохранении сообщения бота:', error);
    }
};


const sendUserMessage = async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    console.log('Отправляемое сообщение:', message);
    const userMessageTimestamp = getTimestamp()
    appendMessage('Вы', message, userMessageTimestamp);

    chatInput.value = '';
    try {
        await sendMessageToAPI('user', message, userMessageTimestamp);
        if (message.endsWith('?')) {
            console.log('question');
//          await handleQuestion(message);
        } else {
            console.log('user response handler');
            userResponseHandler(message);
        }
    } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    }
};


const fetchNodes = async (type) => {
    const encodedType = encodeURIComponent(type);
    try {
        const response = await fetch(`/api/get-nodes-by-type/?type=${encodedType}`, { method: 'GET' });

        if (!response.ok) {
            // Выводим статус ошибки и текст ответа для диагностики
            const errorText = await response.text();
            throw new Error(`Error fetching nodes: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Проверка полученного JSON на наличие ожидаемой структуры
        if (data && Array.isArray(data.result)) {
            return data.result;
        } else {
            throw new Error('Unexpected response format: missing or malformed "result"');
        }

    } catch (error) {
        // Логируем более подробную информацию об ошибке
        console.error('Error fetching nodes:', error.message);
        if (error.response) {
            console.error('Response data:', error.response);
        }
        return [];
    }
};

const createButtonsFromNodes = (nodes, onClickHandler) => {
    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('chat-buttons-container');

    nodes.forEach(node => {
        const button = document.createElement('button');
        button.textContent = node.name;
        button.classList.add('chat-button');
        button.onclick = () => onClickHandler(node, buttonsContainer);
        buttonsContainer.appendChild(button);
    });

    document.querySelector('.chat-messages').appendChild(buttonsContainer);
    setTimeout(scrollToBottom, 0);
};


const userResponseHandler = async (message) => {
    console.log("User Response Handler");
    const cleanedMessage = message.trim().replace(/[^\w\sа-яА-ЯёЁ]/g, '').toLowerCase();

    const isGreeting = greetings.some(greeting => cleanedMessage.includes(greeting));

    if (isGreeting) {
        const responses = [
            `Здравствуйте, ${username}!`,
            `Привет, ${username}!`,
            `Привет, ${username}! Надеюсь у Вас всё супер😊!`
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        appendMessage('bot', randomResponse, getTimestamp());
        await sendBotMessage(randomResponse);

        const greetingOptions = [
            'Задайте свой вопрос или выберите из списка:',
            'Я всегда рад помочь! Задавайте свои вопросы или выбирайте интересующую вас тему :)'
        ];
        const randomGreetingOption = greetingOptions[Math.floor(Math.random() * greetingOptions.length)];
        appendMessage('bot', randomGreetingOption, getTimestamp());
        await sendBotMessage(randomGreetingOption);

        const nodes = await fetchNodes('Раздел');
        createButtonsFromNodes(nodes, async (selectedNode, container) => {
            appendMessage('user', selectedNode.name, getTimestamp());
            container.remove();
        });
    }
};


const formatDate = (date) => {
    const [year, month, day] = date.split('-');
    const months = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return `${day} ${months[parseInt(month) - 1]} ${year}`;
};


const getTimestamp = () => {
    const now = new Date();
    const timestamp = now.toISOString();
    const timezoneOffset = now.getTimezoneOffset() / -60;
    const timezone = timezoneOffset >= 0
        ? `+${String(timezoneOffset).padStart(2, '0')}`
        : `-${String(-timezoneOffset).padStart(2, '0')}`;
    return `${timestamp.replace('T', ' ').slice(0, -1)}${timezone}`;
};


sendMessageButton.addEventListener('click', sendUserMessage);
chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendUserMessage();
    }
});
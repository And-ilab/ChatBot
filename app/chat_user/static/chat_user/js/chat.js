const chatToggle = document.getElementById('user-chat-toggle');
const chatWindow = document.getElementById('user-chat-window');
const closeChat = document.getElementById('user-close-chat');
const chatInput = document.getElementById('user-chat-input');
const sendMessageButton = document.getElementById('user-send-message');
const chatMessages = document.getElementById('user-chat-messages');
const extendButton = document.getElementById('extend-btn');
const newSessionButton = document.getElementById('new-session-btn');
const extendSessionWindow = document.getElementById('extend-session-wrapper');
const chatLogin = document.getElementById('chat-login-wrapper');
const loginForm = document.getElementById("user-info-form");
const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

const greetings = [
    'привет', 'здравствуй', 'добрый день', 'добрый вечер', 'приветствую',
    'здравия желаю', 'хай', 'хей', 'здарова', 'здаров', 'здорова', 'здоров',
    'салам', 'доброй ночи', 'приветик', 'хаюшки'
];

let dialogID;
let userID;
let username;
let started_at;
let navigationStack = [];
let sessionExpiryTimeout;

closeChat.addEventListener('click', () => {
    chatWindow.style.display = 'none';
});

const loadMessages = async () => {
    try {
        const messagesResponse = await fetch(`/api/messages/${dialogID}/`);
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

async function checkUserSession() {
    const sessionToken = localStorage.getItem("sessionToken");

    if (!sessionToken) {
        return { status: "login", message: "Сессия отсутствует" };
    }

    try {
        const response = await fetch("/api/check-session/", {
            method: "GET",
            headers: {
                "Authorization": sessionToken,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Ошибка сессии:", errorData.message);
            return { status: "error", message: errorData.message || "Неизвестная ошибка" };
        }

        const data = await response.json();

        if (data.status === "success") {
            userID = data["user_id"];
            setSessionExpiryTimer(new Date(data.expires_at));  // Установка таймера для закрытия чата
            return { status: "success", data };
        } else if (data.status === "expired") {
            return { status: "expired", message: data.message };
        } else if (data.status === "login") {
            return { status: "login", message: data.message };
        } else {
            console.warn("Неизвестный статус ответа:", data);
            return { status: "unknown", message: "Неизвестный ответ от сервера" };
        }
    } catch (error) {
        console.error("Ошибка при запросе:", error);
        return { status: "error", message: "Ошибка при проверке сессии" };
    }
}

function setSessionExpiryTimer(expiryDate) {
    if (sessionExpiryTimeout) {
        clearTimeout(sessionExpiryTimeout);
    }

    const now = new Date();
    const timeDifference = expiryDate - now;

    if (timeDifference > 0) {
        sessionExpiryTimeout = setTimeout(() => {
            closeChatWindow();
        }, timeDifference);
    } else {
        closeChatWindow();
    }
}

function closeChatWindow() {
    chatWindow.style.display = 'none';
}

chatToggle.addEventListener('click', async () => {
    // Проверяем текущее состояние окна чата
    const isChatVisible = chatWindow.style.display === 'block';

    if (isChatVisible) {
        // Если чат уже открыт, закрываем его
        chatWindow.style.display = 'none';
    } else {
        // Если чат закрыт, открываем его и выполняем проверку сессии
        chatWindow.style.display = 'block';
        extendSessionWindow.style.display = 'none';
        chatLogin.style.display = 'none';
        chatMessages.style.display = 'none';

        startSessionCheckInterval();

        const result = await checkUserSession();
        console.log(result);

        switch (result.status) {
            case "login":
                console.log("Сессия отсутствует. Пожалуйста, войдите.");
                chatLogin.style.display = 'flex';
                break;
            case "success":
                console.log("Добро пожаловать! Продолжайте работу.");
                chatMessages.style.display = 'flex';
                await loadDialogMessages();
                break;
            case "expired":
                console.log("Сессия истекла.");
                extendSessionWindow.style.display = 'flex';
                break;
            case "error":
                alert(`Ошибка: ${result.message}`);
                break;
            default:
                console.error("Неизвестный статус:", result.status);
        }
    }
});

async function loadDialogMessages() {
    userID = jwt_decode(localStorage.getItem("sessionToken"))["user_id"];
    dialogID = await getLatestDialog(userID);
    const userData = await getUserDetails(userID);
    username = `${userData["first_name"]} ${userData["last_name"]}`;
    await loadMessages();
}

extendButton.addEventListener('click', async () => {
    await extendSession();
    extendSessionWindow.style.display = 'none';
    chatMessages.style.display = 'flex';
    await loadDialogMessages();
});

newSessionButton.addEventListener('click', async () => {
    extendSessionWindow.style.display = 'none';
    chatLogin.style.display = 'flex';
});

loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const jsonData = Object.fromEntries(formData.entries());

    userID = jsonData["user_id"];
    const response = await fetch("/api/chat-login/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken
        },
        body: JSON.stringify(jsonData),
    });

    const result = await response.json();

    if (response.ok) {
        localStorage.setItem("sessionToken", result.session_token);
        userID = jwt_decode(result["session_token"])["user_id"];
        dialogID = await createNewDialog(userID);
        const userData = await getUserDetails(userID);
        username = `${userData["first_name"]} ${userData["last_name"]}`;
        chatLogin.style.display = 'none';
        chatMessages.style.display = 'flex';
        await showGreetingMessages();
        await showSectionButtons();
    } else {
        console.error(result.message);
        alert("Ошибка авторизации");
    }
});


let lastMessageDate = null;

const appendMessage = (sender, content, timestamp) => {
    const buttonsContainer = document.querySelector('.chat-buttons-container');
    if (buttonsContainer) {
        buttonsContainer.remove();
    }

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

const sendMessageToAPI = async (dialog_id, senderType, content, timestamp) => {
    await fetch(`/api/send-message/${dialog_id}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      body: JSON.stringify({
        sender_type: senderType,
        sender_id: senderType === 'user' ? userID : undefined,
        content,
        timestamp
      }),
    });
};


const sendBotMessage = async (content) => {
    try {
        const timestamp = getTimestamp();
        await sendMessageToAPI(dialogID, 'bot', content, timestamp);
    } catch (error) {
        console.error('Ошибка при сохранении сообщения бота:', error);
    }
};


const sendUserMessage = async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    const userMessageTimestamp = getTimestamp();
    appendMessage('Вы', message, userMessageTimestamp);
    chatInput.value = '';

    // Проверка сессии перед отправкой сообщения
    const sessionCheck = await checkUserSession();
    if (sessionCheck.status === "expired") {
        closeChatWindow();
        return;
    }

    try {
        await sendMessageToAPI(dialogID, 'user', message, userMessageTimestamp);
        await extendSession();  // Обновляем сессию при отправке сообщения
        if (message.endsWith('?')) {
            // Обработка вопросов
        } else {
            userResponseHandler(message);
        }const sendUserMessage = async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    console.log('Отправляемое сообщение:', message);
    const userMessageTimestamp = getTimestamp();
    appendMessage('Вы', message, userMessageTimestamp);

    chatInput.value = '';
    try {
        await sendMessageToAPI(dialogID, 'user', message, userMessageTimestamp);
        await extendSession();  // Обновляем сессию при отправке сообщения
        if (message.endsWith('?')) {
            console.log('question');
//          await handleQuestion(message);
        } else {
            userResponseHandler(message);
        }
    } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    }
};

    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
    }
};
sendMessageButton.addEventListener('click', sendUserMessage);
chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendUserMessage();
    }
});


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

const fetchNodesWithRelation = async (startNodeType, startNodeName, finishNodeType) => {
    const encodeStartNodeType = encodeURIComponent(startNodeType);
    const encodeStartNodeName = encodeURIComponent(startNodeName);
    const encodeFinishNodeType = encodeURIComponent(finishNodeType);
    try {
        const response = await fetch(`/api/get-nodes-by-type-with-relation/?startNodeType=${encodeStartNodeType}&startNodeName=${encodeStartNodeName}&finishNodeType=${encodeFinishNodeType}`, { method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error fetching nodes: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data["result"];

    } catch (error) {
        console.error('Error fetching nodes with relation:', error.message);
        return [];
    }
};


const fetchAnswer = async (questionId) => {
    const encodedQuestionId = encodeURIComponent(questionId);
    try {
        const response = await fetch(`/api/get-answer/?questionId=${encodedQuestionId}`, { method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error fetching answer: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data['result'][0];
    } catch (error) {
        console.error('Error fetching answer:', error.message);
        return '';
    }
};


const fetchDocuments = async (answerID) => {
    const encodedAnswerID = encodeURIComponent(answerID);
    try {
        const response = await fetch(`/api/get-documents/?answerID=${encodedAnswerID}`, { method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error fetching answer: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data['result'];
    } catch (error) {
        console.error('Error fetching answer:', error.message);
        return '';
    }
};


const createButtonsFromNodes = (nodes, onClickHandler) => {
    let buttonsContainer = document.querySelector('.chat-buttons-container');
    if (buttonsContainer) {
        buttonsContainer.innerHTML = '';
    } else {
        buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('chat-buttons-container');
    }

    nodes.forEach((node) => {
        const button = document.createElement('button');
        button.textContent = node.name;
        button.classList.add('chat-button');
        button.onclick = () => onClickHandler(node, buttonsContainer);
        buttonsContainer.appendChild(button);
    });

    if (navigationStack.length > 0)
    {
        const backButton = document.createElement('button');
        backButton.textContent = 'Назад';
        backButton.classList.add('chat-button');
        backButton.onclick = () => goBack();
        buttonsContainer.appendChild(backButton);
    }

    document.querySelector('.chat-messages').appendChild(buttonsContainer);
    setTimeout(scrollToBottom, 0);
};

const createDocumentBlock = (documents) => {
    const chatMessages = document.querySelector('.chat-messages');

    if (!chatMessages) {
        console.error('Элемент .chat-messages не найден');
        return;
    }

    documents.forEach((doc) => {
        const documentBlock = document.createElement('div');
        documentBlock.classList.add('document-block');

        const icon = document.createElement('i');
        icon.classList.add('fa', 'fa-file-alt', 'document-icon');
        documentBlock.appendChild(icon);

        const link = document.createElement('a');
        link.textContent = doc.name;
        link.href = doc.content;
        link.target = '_blank';
        link.classList.add('document-link');
        documentBlock.appendChild(link);
        chatMessages.appendChild(documentBlock);
    });

    setTimeout(scrollToBottom, 0);
};

const userResponseHandler = async (message) => {
    console.log("User Response Handler");
    const cleanedMessage = message.trim().replace(/[^\w\sа-яА-ЯёЁ]/g, '').toLowerCase();

    const isGreeting = greetings.some(greeting => cleanedMessage.includes(greeting));

    if (isGreeting) {
        showGreetingMessages();
    }
};


const showGreetingMessages = async () => {
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

    showSectionButtons();
};


const goBack = async () => {
    if (navigationStack.length === 0) {
        return;
    }
    let time = getTimestamp();
    appendMessage('user', 'Назад', time);
    await sendMessageToAPI(dialogID, 'user', 'Назад', time);

    const { type, name } = navigationStack[navigationStack.length - 1];

    if (type === 'Section'){
        navigationStack.pop();
        await showSectionButtons();
    } else if (type === 'Topic') {
        const sectionName = navigationStack[navigationStack.length - 2]["name"];
        navigationStack.pop();
        await showTopicButtons(sectionName);
    }
};


const showSectionButtons = async () => {
    const nodes = await fetchNodes('Section');
    createButtonsFromNodes(nodes, async (selectedNode) => {
        appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(dialogID, 'user', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Section', name: selectedNode.name, fetchFunction: fetchNodes });
        await showTopicButtons(selectedNode.name);
    });
};

const showTopicButtons = async (sectionName) => {
    const nodes = await fetchNodesWithRelation('Section', sectionName, 'Topic');
    createButtonsFromNodes(nodes, async (selectedNode) => {
        appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(dialogID, 'user', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Topic', name: selectedNode.name, fetchFunction: fetchNodesWithRelation });
        await showQuestionsButtons(selectedNode.name);
    });
};

const showQuestionsButtons = async (topicName) => {
    const nodes = await fetchNodesWithRelation('Topic', topicName, 'Question');
    createButtonsFromNodes(nodes, async (selectedNode) => {
        appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(dialogID, 'user', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Question', name: selectedNode.name, fetchFunction: fetchNodesWithRelation });
        await showAnswer(selectedNode.id);
    });
};

const showAnswer = async (questionID) => {
    // Удаляем существующую анимацию, если она есть
    let existingTypingAnimation = document.querySelector('.typing-animation');
    if (existingTypingAnimation) {
        existingTypingAnimation.remove();
    }

    // Создаём новую анимацию
    const typingAnimation = document.createElement('div');
    typingAnimation.classList.add('typing-animation');
    chatMessages.appendChild(typingAnimation);

    const randomDelay = Math.floor(Math.random() * 2000) + 2000; // 2000-4000 миллисекунд
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    const answer = await fetchAnswer(questionID);

    // Делим ответ по абзацам
    const answerParts = answer.content.split('\n\n'); // Разделение по двойным переводам строки

    for (const part of answerParts) {
        if (part.trim()) { // Проверяем, что часть не пустая
            chatMessages.appendChild(typingAnimation); // Перемещаем "Печатает..." в конец
            await new Promise(resolve => setTimeout(resolve, 3000)); // Задержка между абзацами, 3-4 секунды
            appendMessage('bot', part, getTimestamp());
            await sendBotMessage(part);
        }
    }

    typingAnimation.remove(); // Убираем элемент "Печатает..." после завершения ответа

    await showDocuments(answer.id);

};



const showDocuments = async (answerID) => {
    const documentsData = await fetchDocuments(answerID);
    createDocumentBlock(documentsData);
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


async function getLatestDialog(userId) {
    try {
        const response = await fetch(`/api/dialogs/latest/${userId}/`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();

        if (response.ok) {
            console.log("Самый новый диалог:", data);
            return data.dialog_id;
        } else {
            console.warn("Ошибка при получении диалога:", data.message);
            return null;
        }
    } catch (error) {
        console.error("Ошибка при запросе:", error);
        return null;
    }
}


async function createNewDialog(userId) {
    try {

        const response = await fetch(`/api/dialogs/create/${userId}/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
        });

        const data = await response.json();

        if (response.ok) {
            console.log("Новый диалог создан:", data);
            userID = userId;
            return data.dialog_id;
        } else {
            console.warn("Ошибка при создании диалога:", data.message);
            return null;
        }
    } catch (error) {
        console.error("Ошибка при запросе:", error);
        return null;
    }
}

function decodeToken(token) {
    const payload = token.split('.')[1];
    const decodedPayload = atob(payload);
    return JSON.parse(decodedPayload);
}

async function extendSession() {
    const sessionToken = localStorage.getItem("sessionToken");
    if (!sessionToken) {
        console.log("No session token found.");
        return;
    }

    try {
        const response = await fetch("/api/extend-session/", {
            method: "POST",
            headers: {
                "Authorization": sessionToken,
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
        });

        const data = await response.json();
        if (response.ok) {
            console.log("Session extended:", data);
            localStorage.setItem("sessionToken", sessionToken);
        } else {
            console.log("Failed to extend session:", data.message);
        }
    } catch (error) {
        console.error("Error extending session:", error);
    }
}

const getUserDetails = async (userId) => {
    try {
        const response = await fetch(`/api/user/${userId}/`);
        if (!response.ok) throw new Error("User not found");

        const data = await response.json();
        return data.user;
    } catch (error) {
        console.error("Error fetching user details:", error);
    }
};

function startSessionCheckInterval() {
    setInterval(async () => {
        const sessionCheck = await checkUserSession();
        if (sessionCheck.status === "expired") {
            closeChatWindow(); // Закрываем чат, если сессия истекла
        }
    }, 60000); // Проверка сессии каждые 60 секунд
}
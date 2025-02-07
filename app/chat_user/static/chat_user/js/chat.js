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
const menuButton = document.getElementById("user-menu-button");
const buttonsContainer = document.querySelector('.menu-buttons');
const typingBlock = document.querySelector('.typing-animation');
const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;


const greetings = [
    'привет', 'здравствуй', 'добрый день', 'добрый вечер', 'приветствую',
    'здравия желаю', 'хай', 'хей', 'здарова', 'здаров', 'здорова', 'здоров',
    'салам', 'доброй ночи', 'приветик', 'хаюшки'
];

const menu = ['меню', 'Меню'];


let dialogID;
let userID;
let username;
let started_at;
let navigationStack = [];


window.addEventListener("beforeunload", async (event) => {
    const sessionToken = localStorage.getItem("sessionToken");
    const eventData = JSON.stringify(event);

    const response = await fetch("/api/close-session/", {
        method: "POST",
        headers: {
            "Authorization": sessionToken,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ event: eventData }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Ошибка сессии:", errorData.message);
        return { status: "error", message: errorData.message || "Неизвестная ошибка" };
    }
});


closeChat.addEventListener('click', () => {
    chatWindow.style.display = 'none';
});


menuButton.addEventListener('click', () => {
    const menuButtons = document.querySelector('.menu-buttons');

    if (menuButtons.style.display === 'none' || menuButtons.style.display === '') {
        menuButtons.style.display = 'flex';
        chatMessages.style.height = '370px';
        setTimeout(scrollToBottom, 0);
    } else {
        menuButtons.style.display = 'none';
        chatMessages.style.height = '550px';
    }
});


const loadMessages = async () => {
    try {
        chatMessages.style.height = '550px';
        const messagesResponse = await fetch(`/api/messages/${dialogID}/`);
        const data = await messagesResponse.json();
        chatMessages.innerHTML = '';

        for (const { sender, content, message_type, timestamp } of data.messages) {
            if (message_type === 'message') {
                appendMessage(sender, content, timestamp);
            } else {
                console.log(content);
                const artifact = await loadArtifact(message_type, content);
                console.log(artifact);
                await createDocumentBlock([artifact]);
            }
        }

        const lastMessage = data.messages[data.messages.length - 1];
        console.log(lastMessage);
        if (
            (lastMessage.sender === 'bot' &&
                (
                    lastMessage.content === 'Задайте свой вопрос или выберите из меню' ||
                    lastMessage.content === 'Я всегда рад помочь! Задавайте свои вопросы или выбирайте интересующую вас тему в меню'
                )
            ) || (lastMessage.content === 'Меню' || lastMessage.content === 'меню')
        ) {
            await showSectionButtons();
        }

        setTimeout(scrollToBottom, 0);

    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
    }
};



const loadArtifact = async (artifactType, artifactID) => {
    const encodedArtifactType = encodeURIComponent(artifactType);
    const encodedArtifactID = encodeURIComponent(artifactID);
    try {
        const response = await fetch(`/api/get-artifact-by-id/?artifactID=${encodedArtifactID}&artifactType=${encodedArtifactType}`, { method: 'GET' });
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


const scrollToBottom = () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
};


async function checkUserSession() {
    const sessionToken = localStorage.getItem("sessionToken");
    console.log(`session token ${sessionToken}`)

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
            console.log(`success`)
            return { status: "success", data };
        } else if (data.status === "expired") {
            console.log(`expired`)
            return { status: "expired", message: data.message };
        } else if (data.status === "login") {
            console.log(`login`)
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

chatToggle.addEventListener('click', async () => {
    const isChatVisible = chatWindow.style.display === 'block';

    if (isChatVisible) {
        chatWindow.style.display = 'none';
    } else {
        chatWindow.style.display = 'block';
        extendSessionWindow.style.display = 'none';
        chatLogin.style.display = 'none';
        chatMessages.style.display = 'none';

        const result = await checkUserSession();
        console.log(result);

        switch (result.status) {
            case "login":
                console.log("Сессия отсутствует. Пожалуйста, войдите.");
                chatLogin.style.display = 'flex';
                chatInput.disabled = true;
                break;
            case "success":
                console.log("Добро пожаловать! Продолжайте работу.");
                chatInput.disabled = false;
                await loadDialogMessages();
                chatMessages.style.display = 'flex';
                break;
            case "expired":
                console.log("Сессия истекла.");
                extendSessionWindow.style.display = 'flex';
                chatInput.disabled = true;
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
    chatInput.disabled = false;
    await loadDialogMessages();
});


newSessionButton.addEventListener('click', async () => {
    const sessionToken = localStorage.getItem("sessionToken");
    userID = jwt_decode(sessionToken)["user_id"]
    dialogID = await createNewDialog(userID);
    const userData = await getUserDetails(userID);
    username = `${userData["first_name"]} ${userData["last_name"]}`;
    await extendSession();
    extendSessionWindow.style.display = 'none';
    chatMessages.style.display = 'flex';
    chatInput.disabled = false;
    await showGreetingMessages();
    await showSectionButtons();
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
        chatInput.disabled = false;
        chatMessages.style.display = 'flex';
        await showGreetingMessages();
        await showSectionButtons();
    } else {
        console.error(result.message);
        alert("Ошибка авторизации");
    }
});


let lastMessageDate = null;

const appendMessage = (sender, content, timestamp, showButton = false) => {
    const buttonsContainer = document.querySelector('.chat-buttons-container');
    if (buttonsContainer) {
        buttonsContainer.remove();
        chatMessages.style.height = '550px';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = sender === 'bot' ? 'message bot-message' : 'message user-message';

    const date = new Date(timestamp);
    date.setHours(date.getHours() + 3);
    const time = date.toTimeString().slice(0, 5);
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
        <div class="message-content">
            <span class="message-text">${content}</span>
            <span class="${timeClass}">${time}</span>
        </div>
    `;

    if (sender === 'bot' && showButton) {
        const buttonContainer = document.createElement('div');

        messageDiv.dataset.date = messageDate;
        chatMessages.appendChild(messageDiv);

        messageDiv.insertAdjacentElement('afterend', buttonContainer);

        scrollToBottom();
    } else {
        messageDiv.dataset.date = messageDate;
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
        }
        };


const sendMessageToAPI = async (dialog_id, senderType, messageType, content, timestamp) => {
    await fetch(`/api/send-message/${dialog_id}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      body: JSON.stringify({
        sender_type: senderType,
        sender_id: senderType === 'user' ? userID : undefined,
        message_type: messageType,
        content: content,
        timestamp: timestamp
      }),
    });
};


const sendBotMessage = async (content) => {
    try {
        const timestamp = getTimestamp();
        await sendMessageToAPI(dialogID, 'bot', 'message', content, timestamp);
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
        await sendMessageToAPI(dialogID, 'user', 'message', message, userMessageTimestamp);
        await userResponseHandler(message);
    } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    }
};


const fetchNodes = async (type) => {
    const encodedType = encodeURIComponent(type);
    try {
        const response = await fetch(`/api/get-nodes-by-type/?type=${encodedType}`, { method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error fetching nodes: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data && Array.isArray(data.result)) {
            return data.result;
        } else {
            throw new Error('Unexpected response format: missing or malformed "result"');
        }

    } catch (error) {
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
    menuButton.style.display = 'flex';
    if (buttonsContainer) {
        buttonsContainer.innerHTML = '';
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
};

const createDocumentBlock = async (documents) => {
    const chatMessages = document.querySelector('.chat-messages');

    if (!chatMessages) {
        console.error('Элемент .chat-messages не найден');
        return;
    }
    console.log(documents);
    documents.forEach(async (doc) => {
        const documentBlock = document.createElement('div');
        documentBlock.classList.add('document-block');

        const link = document.createElement('a');
        link.classList.add('document-link');
        link.textContent = doc.name;

        const icon = document.createElement('i');
        if (doc.type === 'link') {
            icon.classList.add('fa', 'fa-link', 'document-icon');
            link.href = doc.content;
            link.target = '_blank';
        } else if (doc.type === 'document') {
            icon.classList.add('fa', 'fa-file-alt', 'document-icon');

            try {
                const response = await fetch(`/api/get-document-link-by-name/${doc.name}/`);
                if (!response.ok) {
                    throw new Error('Не удалось получить ссылку на файл');
                }

                const data = await response.json();
                const filePath = data.file_url;

                link.href = filePath;
                link.download = doc.name;
            } catch (error) {
                console.error(`Ошибка при получении ссылки для файла "${doc.name}":`, error.message);
                link.textContent = `${doc.name} (недоступен)`;
                link.classList.add('error');
            }
        }

        documentBlock.appendChild(icon);
        documentBlock.appendChild(link);
        chatMessages.appendChild(documentBlock);
        setTimeout(scrollToBottom, 0);
    });
};




const userResponseHandler = async (message) => {
    const cleanedMessage = message
        .trim()
        .replace(/[^\w\sа-яА-ЯёЁ]/g, '')
        .toLowerCase();

    const operatorConfirmationMessages = [
        "Спасибо за ваш вопрос! Мы передали его оператору, и вы получите ответ в течение 8 часов. А пока можете задать ещё один вопрос — я всегда готов помочь! 😊",
    "Благодарим вас за обращение! Ваш вопрос уже у оператора, и скоро вы получите ответ. Если у вас есть ещё вопросы, не стесняйтесь задавать — я здесь, чтобы помочь! 🚀",
    "Спасибо, что направили вопрос оператору! Вы получите ответ в ближайшее время. А пока можете задать ещё один вопрос — я всегда на связи! 📩",
    "Большое спасибо за ваш вопрос! Мы уже передали его оператору, и скоро вы получите ответ. Если есть ещё что-то, чем я могу помочь, просто спросите! 😄",
    "Спасибо за обращение! Ваш вопрос уже у оператора, и ответ придёт в течение 8 часов. А пока можете задать ещё один вопрос — я готов помочь! 🛎️",
    "Благодарим вас за вопрос! Мы передали его оператору, и вы получите ответ в ближайшее время. Если у вас есть ещё вопросы, задавайте — я всегда рад помочь! 📨",
    "Спасибо, что направили вопрос оператору! Ответ придёт в течение 8 часов. А пока можете задать ещё один вопрос — я здесь, чтобы помочь! 🕒",
    "Большое спасибо за ваш вопрос! Мы уже передали его оператору, и скоро вы получите ответ. Если есть ещё что-то, чем я могу помочь, просто спросите! 😊",
    "Спасибо за обращение! Ваш вопрос уже у оператора, и ответ придёт в течение 8 часов. А пока можете задать ещё один вопрос — я готов помочь! 🚀",
    "Благодарим вас за вопрос! Мы передали его оператору, и вы получите ответ в ближайшее время. Если у вас есть ещё вопросы, задавайте — я всегда рад помочь! 📩",
        ];

    // Проверка на приветствие
    const isGreeting = greetings.some(greeting => cleanedMessage.includes(greeting));
    const isMenu = menu.some(menu => cleanedMessage.includes(menu));

    if (greetings.some(greeting => cleanedMessage.includes(greeting))) {
        showGreetingMessages();
        await showSectionButtons();
        return;
    }

    // Проверка на меню
    if (menu.some(m => cleanedMessage.includes(m))) {
        await showSectionButtons();
        return;
    }

    try {
        buttonsContainer.style.display = 'none';
        chatMessages.style.height = '550px';
        menuButton.style.display = 'none';

        const recognizeResponse = await fetch("/api/recognize-question/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
            body: JSON.stringify({ message: cleanedMessage }),
        });

        if (!recognizeResponse.ok) {
            throw new Error(`Ошибка: ${recognizeResponse.status} ${recognizeResponse.statusText}`);
        }

        const data = await recognizeResponse.json();
        let questionToSend = '';
        if (data.recognized_question) {
            questionToSend = data.recognized_question;
            const encodedQuestionContent = encodeURIComponent(data.recognized_question);
            try {
                const questionIDResponse = await fetch(`/api/get-question-id-by-content/?questionContent=${encodedQuestionContent}`, {method: 'GET'});
                const data = await questionIDResponse.json();
                const newQuestionID = data['result']['@rid'];
                await showAnswer(newQuestionID);
            } catch (error) {
                console.error('Error fetching question ID:', error.message);
            }
        } else {
            const customResponses = [
            "К сожалению, я не смог понять ваш вопрос. Пожалуйста, уточните его или задайте вопрос, связанный с банковскими процессами. Если нужно, я могу передать ваш вопрос оператору, и вы получите ответ на электронную почту в течение 8 часов. 📧",
            "Извините, я не совсем понял ваш запрос. Может быть, вы хотели бы задать вопрос о банковских процессах? Если нет, я могу передать ваш вопрос оператору, и вам ответят в течение 8 часов. 😊",
            "К сожалению, я не смог обработать ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор связался с вами по электронной почте. 📨",
            "Простите, я не смог распознать ваш вопрос. Может быть, вы хотели бы уточнить его или задать другой вопрос, связанный с банковскими процессами? Если нужно, я могу передать ваш запрос оператору. 🛎️",
            "К сожалению, я не смог понять ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор ответил вам в течение 8 часов. 📩",
            "Извините, я не смог обработать ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору. 🕒",
            "К сожалению, я не смог распознать ваш запрос. Пожалуйста, уточните его или задайте вопрос, связанный с банковскими процессами. Если нужно, я могу передать ваш вопрос оператору. 📧",
            "Простите, я не смог понять ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору, и вам ответят в течение 8 часов. 🕒",
            "К сожалению, я не смог обработать ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор связался с вами по электронной почте. 📨",
            "Извините, я не смог распознать ваш вопрос. Может быть, вы хотели бы уточнить его или задать другой вопрос, связанный с банковскими процессами? Если нужно, я могу передать ваш запрос оператору. 🛎️",
            "К сожалению, я не смог понять ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор ответил вам в течение 8 часов. 📩",
            "Простите, я не смог обработать ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору. 🕒",
            "К сожалению, я не смог распознать ваш запрос. Пожалуйста, уточните его или задайте вопрос, связанный с банковскими процессами. Если нужно, я могу передать ваш вопрос оператору. 📧",
            "Извините, я не смог понять ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору, и вам ответят в течение 8 часов. 🕒",
            "К сожалению, я не смог обработать ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор связался с вами по электронной почте. 📨",
            "Простите, я не смог распознать ваш вопрос. Может быть, вы хотели бы уточнить его или задать другой вопрос, связанный с банковскими процессами? Если нужно, я могу передать ваш запрос оператору. 🛎️",
            "К сожалению, я не смог понять ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор ответил вам в течение 8 часов. 📩",
            "Извините, я не смог обработать ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору. 🕒",
            "К сожалению, я не смог распознать ваш запрос. Пожалуйста, уточните его или задайте вопрос, связанный с банковскими процессами. Если нужно, я могу передать ваш вопрос оператору. 📧",
            "Простите, я не смог понять ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору, и вам ответят в течение 8 часов. 🕒",
             ];
            const messageId = Date.now(); // уникальный ID для сообщения
            const botAnswerMessage = customResponses[Math.floor(Math.random() * customResponses.length)];
            appendMessage('bot', botAnswerMessage, getTimestamp(), false, messageId); // showButton = false
            await sendBotMessage(botAnswerMessage);

            const operatorButtonContainer = document.createElement('div');
            operatorButtonContainer.className = 'operator-button-container';
            operatorButtonContainer.innerHTML = `
                <button class="operator-button" data-message-id="${messageId}">
                    <i class="fas fa-headset"></i>
                    Отправить оператору
                </button>
            `;
            chatMessages.appendChild(operatorButtonContainer);
                    scrollToBottom();

            // Навешиваем обработчик прямо на эту кнопку:
            const operatorButton = operatorButtonContainer.querySelector('.operator-button');
            operatorButton.addEventListener('click', async (e) => {
                const confirmMessage = operatorConfirmationMessages[
                    Math.floor(Math.random() * operatorConfirmationMessages.length)
                ];

                appendMessage('bot', confirmMessage, getTimestamp());
                await sendBotMessage(confirmMessage);

                try {
                    await fetch("/api/create-training-message/", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRFToken": csrfToken,
                        },
                        body: JSON.stringify({
                            sender_id: userID,
                            content: message, // либо извлеченный текст
                            status: 'sent_to_operator'
                        }),
                    });
                } catch (error) {
                    console.error("Ошибка при отправке оператору:", error);
                }

                // Удаляем контейнер с кнопкой, чтобы предотвратить повторную отправку
                operatorButtonContainer.remove();
            }, { once: true });

        }
    } catch (error) {
        console.error("Ошибка при распознавании вопроса:", error.message);
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
        'Задайте свой вопрос или выберите из меню',
        'Я всегда рад помочь! Задавайте свои вопросы или выбирайте интересующую вас тему в меню'
    ];
    const randomGreetingOption = greetingOptions[Math.floor(Math.random() * greetingOptions.length)];
    appendMessage('bot', randomGreetingOption, getTimestamp());
    await sendBotMessage(randomGreetingOption);

};


const goBack = async () => {
    if (navigationStack.length === 0) {
        return;
    }
    let time = getTimestamp();
    appendMessage('user', 'Назад', time);
    await sendMessageToAPI(dialogID, 'user', 'message', 'Назад', time);

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
    chatMessages.style.height = '370px';
    setTimeout(scrollToBottom, 0);
    const nodes = await fetchNodes('Section');
    buttonsContainer.style.display = 'flex';
    createButtonsFromNodes(nodes, async (selectedNode) => {
        appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(dialogID, 'user', 'message', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Section', name: selectedNode.name, fetchFunction: fetchNodes });
        await showTopicButtons(selectedNode.name);
    });
};

const showTopicButtons = async (sectionName) => {
    const nodes = await fetchNodesWithRelation('Section', sectionName, 'Topic');
    createButtonsFromNodes(nodes, async (selectedNode) => {
        appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(dialogID, 'user', 'message', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Topic', name: selectedNode.name, fetchFunction: fetchNodesWithRelation });
        await showQuestionsButtons(selectedNode.name);
    });
};

const showQuestionsButtons = async (topicName) => {
    const nodes = await fetchNodesWithRelation('Topic', topicName, 'Question');
    createButtonsFromNodes(nodes, async (selectedNode) => {
        appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(dialogID, 'user', 'message', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Question', name: selectedNode.name, fetchFunction: fetchNodesWithRelation });
        await showAnswer(selectedNode.id);
    });
};

const showAnswer = async (questionID) => {
    chatMessages.style.height = '550px';
    buttonsContainer.innerHTML = '';
    buttonsContainer.style.display = 'none';
    menuButton.style.display = 'none';

const answer = await fetchAnswer(questionID);
if (answer) {
    typingBlock.style.display = 'flex';
    const randomDelay = Math.floor(Math.random() * 2000) + 2000;
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // Разделяем ответ на основные блоки по двойному переносу строки
    const answerParts = answer.content.split(/\n{2,}/);

    for (const part of answerParts) {
        if (part.trim()) {
            setTimeout(scrollToBottom, 0);

            // Добавляем задержку между блоками
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Сохраняем оригинальные переносы строк внутри блока
            const formattedPart = part.replace(/\n/g, '<br>');
            appendMessage('bot', formattedPart, getTimestamp());
            await sendBotMessage(formattedPart);
        }
    }


        typingBlock.style.display = 'none';
        await showDocuments(answer.id);
    } else {
        let message = 'Не удалось найти ответ на выбранный вопрос, попробуйте еще раз';
        appendMessage('bot', message, getTimestamp());
        await sendBotMessage(message);
        await showSectionButtons();
    }
};


const showDocuments = async (answerID) => {
    const documentsData = await fetchDocuments(answerID);
    createDocumentBlock(documentsData);
    for (const document of documentsData) {
        await sendMessageToAPI(dialogID, 'bot', document.type, document.id, getTimestamp());
    }
    typingBlock.style.display = 'none';
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
const menuButtonsContainer = document.querySelector(".menu-buttons");
const menuButton = document.getElementById("user-menu-button");
const typingBlock = document.querySelector('.typing-animation');

let navigationStack = [];

const updateChatLayout = () => {
    chatMessagesArea.style.height = '380px';
    menuButtonsContainer.style.display = 'flex';
    setTimeout(scrollToBottom, 0);
};

menuButton.addEventListener('click', () => {
    const menuButtonsContainer = document.querySelector('.menu-buttons');

    if (menuButtonsContainer.style.display === 'none' || menuButtonsContainer.style.display === '') {
        updateChatLayout();
    } else {
        menuButtonsContainer.style.display = 'none';
        chatMessagesArea.style.height = '560px';
    }
});

const hideMenu = () => {
    chatMessagesArea.style.height = '560px';
    menuButtonsContainer.style.display = 'none';
    menuButton.style.display = 'none';
}

async function sendPopularRequest(requestType) {
    const url = "/api/add-popular-request/";
    const requestData = {
        sender_id: state['user_id'],
        type: requestType
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Ошибка запроса");
        }

        console.log("Успешно отправлено:", data);
        return data;
    } catch (error) {
        console.error("Ошибка при отправке запроса:", error.message);
    }
}

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


const fetchAnswer = async (questionID) => {
    const encodedQuestionID = encodeURIComponent(questionID);
    try {
        const response = await fetch(`/api/get-answer/?questionId=${encodedQuestionID}`, { method: 'GET' });

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

const goBack = async () => {
    if (navigationStack.length === 0) {
        return;
    }
    let time = getTimestamp();
    appendMessage('user', 'Назад', time);
    await sendMessageToAPI(state['dialog_id'], 'user', 'message', 'Назад', time);

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

const createButtonsFromNodes = (nodes, onClickHandler) => {
    if (menuButtonsContainer) {
        menuButtonsContainer.innerHTML = '';
    }

    nodes.forEach((node) => {
        const button = document.createElement('button');
        button.textContent = node.name;
        button.classList.add('chat-button');
        button.onclick = () => onClickHandler(node, menuButtonsContainer);
        menuButtonsContainer.appendChild(button);
    });

    if (navigationStack.length > 0)
    {
        const backButton = document.createElement('button');
        backButton.textContent = 'Назад';
        backButton.classList.add('chat-button');
        backButton.onclick = () => goBack();
        menuButtonsContainer.appendChild(backButton);
    }
};

const showSectionButtons = async () => {
    menuButton.style.display = 'flex';
    updateChatLayout();
    const nodes = await fetchNodes('Section');

    createButtonsFromNodes(nodes, async (selectedNode) => {
        appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(state['dialog_id'], 'user', 'message', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Section', name: selectedNode.name, fetchFunction: fetchNodes });
        await sendPopularRequest(selectedNode.name);
        await showTopicButtons(selectedNode.name);
    });
};

const showTopicButtons = async (sectionName) => {
    const nodes = await fetchNodesWithRelation('Section', sectionName, 'Topic');
    createButtonsFromNodes(nodes, async (selectedNode) => {
        appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(state['dialog_id'], 'user', 'message', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Topic', name: selectedNode.name, fetchFunction: fetchNodesWithRelation });
        await showQuestionsButtons(selectedNode.name);
    });
};

const showQuestionsButtons = async (topicName) => {
    const nodes = await fetchNodesWithRelation('Topic', topicName, 'Question');
    createButtonsFromNodes(nodes, async (selectedNode) => {
        appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(state['dialog_id'], 'user', 'message', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Question', name: selectedNode.name, fetchFunction: fetchNodesWithRelation });
        await showAnswer(selectedNode.id, 'script');
    });
};

const showAnswer = async (questionID, requestType) => {
    disableUserActions();
    chatMessagesArea.style.height = '560px';
    menuButtonsContainer.innerHTML = '';
    menuButtonsContainer.style.display = 'none';
    menuButton.style.display = 'none';

    const answer = await fetchAnswer(questionID);
    if (answer) {
        typingBlock.style.display = 'flex';
        const randomDelay = Math.floor(Math.random() * 2000) + 2000;
        await new Promise(resolve => setTimeout(resolve, randomDelay));

        const answerParts = answer.content.split(/\n{2,}/);

        for (const part of answerParts) {
            if (part.trim()) {
                setTimeout(scrollToBottom, 0);
                await new Promise(resolve => setTimeout(resolve, 3000));
                const formattedPart = part.replace(/\n/g, '<br>');
                appendMessage('bot', formattedPart, getTimestamp());
                await sendBotMessage(formattedPart);
            }
        }

        typingBlock.style.display = 'none';
        if (requestType === 'script') {
            enableUserActions();
            await showSectionButtons();
        } else if (requestType === 'recognition') {
            await createFeedbackElements();
        } else {
            return;
        }
//        await showDocuments(answer.id);
    } else {
        let message = 'Не удалось найти ответ на выбранный вопрос, попробуйте еще раз';
        appendMessage('bot', message, getTimestamp());
        await sendBotMessage(message);
        await showSectionButtons();
    }
};

const sendFeedback = async (messageType, answerContent = null) => {
    try {
        const response = await fetch('/api/add-feedback/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                user: state['user_id'],
                message_type: messageType,
                answer_content: answerContent
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Ошибка: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log('Отзыв отправлен:', data);
    } catch (error) {
        console.error('Ошибка при отправке отзыва:', error);
    }
};

const sendThanksFeedbackMessage = async () => {
    let message = 'Спасибо за Ваш отзыв!';
    appendMessage('bot', message, getTimestamp());
    await sendBotMessage(message);
    enableUserActions();
}

const sendFeedbackRequest = async () => {
    let message = 'Подскажите, что я могу улучшить в своем ответе?';
    appendMessage('bot', message, getTimestamp());
    await sendBotMessage(message);
    setTimeout(scrollToBottom, 0);
    enableUserActions();
};

const appendBotFeedbackButtons = () => {
    const messageDiv = document.createElement('div');
    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.className = 'feedback-buttons';

    const likeButton = document.createElement('button');
    likeButton.className = 'feedback-button like-button';
    likeButton.innerHTML = '👍 <span>Полезен</span>';
    likeButton.onclick = async () => {
        likeButton.disabled = true;
        dislikeButton.remove();
        await sendFeedback('like');
        sendThanksFeedbackMessage();
    };

    const dislikeButton = document.createElement('button');
    dislikeButton.className = 'feedback-button dislike-button';
    dislikeButton.innerHTML = '👎 <span>Не то, что я хотел(-а)</span>';
    dislikeButton.onclick = () => {
        dislikeButton.disabled = true;
        likeButton.remove();
        sendFeedbackRequest();
    };

    buttonsWrapper.appendChild(likeButton);
    buttonsWrapper.appendChild(dislikeButton);
    messageDiv.appendChild(buttonsWrapper);

    chatMessagesArea.appendChild(messageDiv);
    setTimeout(scrollToBottom, 0);
};


const createFeedbackElements = async () => {
    let message = 'Насколько полезным был для Вас этот ответ?';
    appendMessage('bot', message, getTimestamp());
    await sendBotMessage(message);
    appendBotFeedbackButtons();
};
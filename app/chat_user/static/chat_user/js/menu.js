const menuButtonsContainer = document.querySelector(".menu-buttons");
const menuButton = document.getElementById("user-menu-button");
const typingBlock = document.querySelector('.typing-animation');

let navigationStack = [];

const updateChatLayout = () => {
    chatMessagesArea.style.height = '380px';
    menuButtonsContainer.style.display = 'flex';
    menuButton.style.display = 'flex';
    setTimeout(scrollToBottom, 0);
};

menuButton.addEventListener('click', async () => {
    const menuButtonsContainer = document.querySelector('.menu-buttons');

    if (menuButtonsContainer.style.display === 'none' || menuButtonsContainer.style.display === '') {
        await showSectionButtons();
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
    console.log(startNodeType, startNodeName, finishNodeType);
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

const fetchArtifacts = async (answerID) => {
    const encodedAnswerID = encodeURIComponent(answerID);
    try {
        const response = await fetch(`/api/get-artifacts/?answerID=${encodedAnswerID}`, { method: 'GET' });
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
        backButton.innerHTML = '↑ ⋯';
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
    console.log(sectionName);
    console.log(nodes);
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
    console.log(answer);
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
        await showArtifacts(answer.id);
        typingBlock.style.display = 'none';
        if (requestType === 'script') {
            enableUserActions();
            await showSectionButtons();
        } else if (requestType === 'recognition') {
            await createFeedbackElements();
        } else {
            return;
        }
    } else {
        let message = 'Не удалось найти ответ на выбранный вопрос, попробуйте еще раз';
        appendMessage('bot', message, getTimestamp());
        await sendBotMessage(message);
        await showSectionButtons();
        enableUserActions();
    }
};

const createArtifactsBlock = async (artifacts) => {
    const documents = artifacts.filter(item => item.type === 'document');
    const links = artifacts.filter(item => item.type === 'link');

    if (!documents || !links) {
        return
    }

    if (documents.length > 0) {
        let docMessage;
        if (documents.length > 1) {
            docMessage = `${state['username']}, еще больше информации Вы можете получить в документах:`;
        } else {
            docMessage = `${state['username']}, еще больше информации Вы можете получить в документе:`;
        }
        appendMessage('bot', docMessage, getTimestamp());
        await sendBotMessage(docMessage);

        // Обрабатываем документы
        for (const doc of documents) {
            const documentMessageDiv = document.createElement('div');
            const documentButton = document.createElement('button');
            documentButton.className = 'document-button';
            documentButton.innerHTML = `
                ${doc.name}
                <i class="fas fa-download" style="margin-left: 8px;"></i>
            `;

            try {
                const response = await fetch(`/api/get-document-link-by-uuid/${doc.uuid}/`);
                if (!response.ok) {
                    throw new Error('Не удалось получить ссылку на файл');
                }

                const data = await response.json();
                const filePath = data.file_url;

                const link = document.createElement('a');
                link.href = filePath;
                link.download = doc.name; // Указываем имя файла для скачивания
                documentButton.onclick = () => {
                    link.click(); // Скачивание файла при нажатии на кнопку
                };
                documentMessageDiv.appendChild(documentButton);
                chatMessagesArea.appendChild(documentMessageDiv);
                await sendMessageToAPI(state['dialog_id'], 'bot', 'document', `${doc.name}^_^${doc.uuid}`, getTimestamp());
            } catch (error) {
                console.error(`Ошибка при получении ссылки для файла "${doc.name}":`, error.message);
                documentButton.textContent = `${doc.name} (недоступен)`;
                documentButton.classList.add('error');
                documentMessageDiv.appendChild(documentButton);
                chatMessagesArea.appendChild(documentMessageDiv);
            }
        }

        setTimeout(scrollToBottom, 0);

        // После завершения обработки документов выводим ссылки
        if (links.length > 0) {
            console.log('Jopa');
            console.log(links);
            let linkMessage;
            if (links.length > 1) {
                linkMessage = `... а также на страницах портала:`;
            } else {
                linkMessage = `... а также на странице портала:`;
            }
            appendMessage('bot', linkMessage, getTimestamp());
            await sendBotMessage(linkMessage);

            for (const link of links) {
                const messageDiv = document.createElement('div');
                const linkButton = document.createElement('button');
                linkButton.className = 'link-button';
                linkButton.innerHTML = `
                    ${link.name}
                    <i class="fas fa-external-link-alt" style="margin-left: 8px;"></i>
                `;

                linkButton.addEventListener('click', () => {
                    window.open(link.content, '_blank');
                });
                messageDiv.appendChild(linkButton);
                chatMessagesArea.appendChild(messageDiv);
                await sendMessageToAPI(state['dialog_id'], 'bot', 'link', `${link.name}^_^${link.content}`, getTimestamp());
            }

            setTimeout(scrollToBottom, 0);
        }
    } else {
        let message = ''
        if (links.length > 1) {
            message = `${state['username']}, еще больше информации Вы можете получить на страницах портала:`;
        } else {
            message = `${state['username']}, еще больше информации Вы можете получить на странице портала:`;
        }
        appendMessage('bot', message, getTimestamp());
        await sendBotMessage(message);
        links.forEach(async (link) => {
            const messageDiv = document.createElement('div');
                const linkButton = document.createElement('button');
                linkButton.className = 'link-button';
                linkButton.innerHTML = `
                    ${link.name}
                    <i class="fas fa-external-link-alt" style="margin-left: 8px;"></i>
                `;

                linkButton.addEventListener('click', () => {
                    window.open(link.content, '_blank');
                });
                messageDiv.appendChild(linkButton);
                chatMessagesArea.appendChild(messageDiv);
                await sendMessageToAPI(state['dialog_id'], 'bot', 'link', `${link.name}^_^${link.content}`, getTimestamp());
        });
        setTimeout(scrollToBottom, 0);
    }
}

const showArtifacts = async (answerID) => {
    const artifactsData = await fetchArtifacts(answerID);
    console.log(artifactsData);
    await createArtifactsBlock(artifactsData);
    typingBlock.style.display = 'none';
};

const sendFeedback = async (messageType, answerContent = null) => {
    try {
        const response = await fetch('/api/add-feedback/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${localStorage.getItem('token')}`,
                "X-CSRFToken": csrfToken
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

async function sendMessageToNeuralModel(message) {
    const data = {
        message: message,
    };

    try {
        const response = await fetch('/api/generate-neural-response/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const result = await response.json();
        console.log('Ответ от сервера:', result.response);
        return result.response;
    } catch (error) {
        console.error('Произошла ошибка:', error);
    }
}

const sendThanksFeedbackMessage = async () => {
    let message = 'Спасибо за Ваш отзыв!';
    appendMessage('bot', message, getTimestamp());
    await sendBotMessage(message);
    enableUserActions();
    await showSectionButtons();
}

async function fetchAllQuestions() {
    try {
        const response = await fetch('/api/get-all-questions/');

        if (!response.ok) {
            throw new Error('Ошибка при запросе данных');
        }

        const data = await response.json();
        console.log(data);

        if (data.result && data.result.length > 0) {
            console.log('Найдены вопросы:', data.result);
            return data.result;
        } else {
            console.log('Вопросы не найдены.');
            return [];
        }
    } catch (error) {
        console.error('Ошибка:', error);
        throw error;
    }
}

const sendFeedbackRequest = async () => {
//    sendMessageToNeuralModel('Привет, как дела?');
    await fetchAllQuestions();
    let message = 'Подскажите, что я могу улучшить в своем ответе?';
    appendMessage('bot', message, getTimestamp());
    await sendBotMessage(message);
    setTimeout(scrollToBottom, 0);
    enableUserActions();
};

const appendBotFeedbackButtons = async () => {
    const messageDiv = document.createElement('div');
    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.className = 'feedback-buttons';

    const likeButton = document.createElement('button');
    likeButton.className = 'feedback-button like-button';
    likeButton.innerHTML = '👍 <span>Полезен</span>';
    likeButton.onclick = async () => {
        likeButton.disabled = true;
        dislikeButton.remove();
        await sendMessageToAPI(state['dialog_id'], 'bot', 'like', 'Useful', getTimestamp());
        await sendFeedback('like');
        sendThanksFeedbackMessage();
    };

    const dislikeButton = document.createElement('button');
    dislikeButton.className = 'feedback-button dislike-button';
    dislikeButton.innerHTML = '👎 <span>Не то, что хотелось бы</span>';
    dislikeButton.onclick = async () => {
        dislikeButton.disabled = true;
        likeButton.remove();
        await sendMessageToAPI(state['dialog_id'], 'bot', 'dislike', 'Not useful', getTimestamp());
        await sendFeedbackRequest();
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
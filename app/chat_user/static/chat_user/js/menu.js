const menuButtonsContainer = document.querySelector(".menu-buttons");
const menuButton = document.getElementById("user-menu-button");
const typingBlock = document.querySelector('.typing-animation');
const exitButton = document.getElementById('user-close-chat');
const chatToggle = document.getElementById("user-chat-toggle");
const chatWindow = document.getElementById("user-chat-window");

let navigationStack = [];

function hideChat() {
    chatWindow.classList.remove("show");
    setTimeout(() => {
        chatWindow.style.display = "none";
        chatToggle.style.display = "block";
    }, 300);
}

function clearState() {
    state['dialog_id'] = null;
    state['user_id'] = null;
    state['username'] = null;
    state['started_at'] = null;
    state['is_first_time_chat_opened'] = true;
}

const hideMenu = () => {
    chatMessagesArea.style.height = '570px';
    menuButtonsContainer.style.display = 'none';
    menuButton.style.display = 'none';
    setTimeout(scrollToBottom, 10);
}

let timerID = null;

const timerCallback = () => {
    closeChatWindow();
};

async function extendSession() {
    const sessionToken = localStorage.getItem("sessionToken");
    if (!sessionToken) {
        return;
    }

    try {
        const response = await fetch(`/api/extend-session/`, {
            method: "POST",
            headers: {
                "Authorization": sessionToken,
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem("sessionToken", sessionToken);
        } else {
            console.log("Failed to extend session:", data.message);
        }
    } catch (error) {
        console.error("Error extending session:", error);
    }
}


const getSessionDuration = async () => {
    const response = await fetch(`/api/get-session-duration/`, {method: 'GET'})

     if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error fetching session duration: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.duration;
}

const startOrRestartTimer = async () => {
    const session_duration = await getSessionDuration();
    const delay = session_duration * 60 * 1000;
    if (timerID) {
        clearTimeout(timerID);
    }
    await extendSession();
    timerID = setTimeout(timerCallback, delay);
}

const stopTimer = () => {
    if (timerID) {
        clearTimeout(timerID);
        timerID = null;
    }
}

async function closeChatWindow() {
    await closeSession();
    hideChat();
    chatMessagesArea.innerHTML = "";
    clearState();
    hideMenu();
    stopTimer();
}

const updateChatLayout = async () => {
    menuButtonsContainer.style.display = 'flex';
    menuButton.style.display = 'flex';
    menuButtonsContainer.style.opacity = '0';
    chatMessagesArea.style.height = '390px';
    menuButtonsContainer.style.opacity = '1';
    setTimeout(scrollToBottom, 10);
};

const disableCloseButton = () => {
    exitButton.disabled = true;
}


const enableCloseButton = () => {
    exitButton.disabled = false;
}


menuButton.addEventListener('click', async () => {
    if (menuButtonsContainer.style.display === 'none' || !menuButtonsContainer.style.display) {
        menuButtonsContainer.style.display = 'flex';
        menuButton.style.display = 'flex';
        await new Promise(resolve => requestAnimationFrame(resolve));
        chatMessagesArea.style.height = '390px';
        await showSectionButtons();
    } else {
        menuButtonsContainer.style.opacity = '0';
        menuButtonsContainer.style.display = 'none';
        chatMessagesArea.style.height = '570px';
    }
    setTimeout(scrollToBottom, 10);
});

async function sendPopularRequest(requestType) {
    const url = `/api/add-popular-request/`;
    const requestData = {
        sender_id: state['user_id'],
        type: requestType
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Ошибка запроса");
        }

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
    await appendMessage('user', 'Назад', time);
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
        await appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(state['dialog_id'], 'user', 'message', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Section', name: selectedNode.name, fetchFunction: fetchNodes });
        await sendPopularRequest(selectedNode.name);
        await showTopicButtons(selectedNode.name);
    });
};

const showTopicButtons = async (sectionName) => {
    const nodes = await fetchNodesWithRelation('Section', sectionName, 'Topic');
    createButtonsFromNodes(nodes, async (selectedNode) => {
        await appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(state['dialog_id'], 'user', 'message', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Topic', name: selectedNode.name, fetchFunction: fetchNodesWithRelation });
        await showQuestionsButtons(selectedNode.name);
    });
};

const showQuestionsButtons = async (topicName) => {
    const nodes = await fetchNodesWithRelation('Topic', topicName, 'Question');
    createButtonsFromNodes(nodes, async (selectedNode) => {
        await appendMessage('user', selectedNode.name, getTimestamp());
        await sendMessageToAPI(state['dialog_id'], 'user', 'message', selectedNode.name, getTimestamp());
        navigationStack.push({ type: 'Question', name: selectedNode.name, fetchFunction: fetchNodesWithRelation });
        await showAnswer(selectedNode.id, 'script');
    });
};

const showAnswer = async (questionID, requestType) => {
    disableUserActions();
    chatMessagesArea.style.height = '570px';
    menuButtonsContainer.innerHTML = '';
    menuButtonsContainer.style.display = 'none';
    menuButton.style.display = 'none';

    const answer = await fetchAnswer(questionID);
    if (answer) {
        typingBlock.style.display = 'flex';
        chatMessagesArea.style.paddingBottom = '20px';
        disableCloseButton();
        const randomDelay = Math.floor(Math.random() * 2000) + 2000;
        await new Promise(resolve => setTimeout(resolve, randomDelay));

        const answerParts = answer.content.split(/\n{2,}/);

        for (const part of answerParts) {
            if (part.trim()) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                const formattedPart = part.replace(/\n/g, '<br>');
                await appendMessage('bot', formattedPart, getTimestamp());
                await sendBotMessage(formattedPart);
            }
        }
        await showArtifacts(answer.id);
        typingBlock.style.display = 'none';
        chatMessagesArea.style.paddingBottom = '10px';
        enableCloseButton();
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
        await appendMessage('bot', message, getTimestamp());
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
        await appendMessage('bot', docMessage, getTimestamp());
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
                link.download = doc.name;
                link.target = '_blank';
                documentButton.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await startOrRestartTimer();
                    link.click();
                });
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

        if (links.length > 0) {
            let linkMessage;
            if (links.length > 1) {
                linkMessage = `... а также на страницах портала:`;
            } else {
                linkMessage = `... а также на странице портала:`;
            }
            await appendMessage('bot', linkMessage, getTimestamp());
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
        }
    } else {
        let message = ''
        if (links.length > 1) {
            message = `${state['username']}, еще больше информации Вы можете получить на страницах портала:`;
        } else {
            message = `${state['username']}, еще больше информации Вы можете получить на странице портала:`;
        }
        await appendMessage('bot', message, getTimestamp());
        await sendBotMessage(message);
        links.forEach(async (link) => {
            const messageDiv = document.createElement('div');
                const linkButton = document.createElement('button');
                linkButton.className = 'link-button';
                linkButton.innerHTML = `
                    ${link.name}
                    <i class="fas fa-external-link-alt" style="margin-left: 8px;"></i>
                `;

                linkButton.addEventListener('click', async () => {
                    await startOrRestartTimer();
                    window.open(link.content, '_blank');
                });
                messageDiv.appendChild(linkButton);
                chatMessagesArea.appendChild(messageDiv);
                await sendMessageToAPI(state['dialog_id'], 'bot', 'link', `${link.name}^_^${link.content}`, getTimestamp());
        });
    }
}

const showArtifacts = async (answerID) => {
    const artifactsData = await fetchArtifacts(answerID);
    await createArtifactsBlock(artifactsData);
    await startOrRestartTimer();
    typingBlock.style.display = 'none';
    chatMessagesArea.style.paddingBottom = '10px';
};

const sendFeedback = async (messageType, answerContent = null) => {
    try {
        const response = await fetch(`/api/add-feedback/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${localStorage.getItem('token')}`,
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
    } catch (error) {
        console.error('Ошибка при отправке отзыва:', error);
    }
};

const sendThanksFeedbackMessage = async () => {
    let message = 'Спасибо за Ваш отзыв!';
    await appendMessage('bot', message, getTimestamp());
    await sendBotMessage(message);
    state['message_to_operator'] = '';
    state['neural_response_message'] = '';
    state['recognition_response_message'] = '';
    await showSectionButtons();
}

async function fetchAllQuestions() {
    try {
        const response = await fetch(`/api/get-all-questions/`);

        if (!response.ok) {
            throw new Error('Ошибка при запросе данных');
        }

        const data = await response.json();

        if (data.result && data.result.length > 0) {
            return data.result;
        } else {
            return [];
        }
    } catch (error) {
        console.error('Ошибка:', error);
        throw error;
    }
}

async function deleteOperatorButton() {
    try {
        const response = await fetch(`/api/delete_last_chat_message/${state['dialog_id']}/`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (response.ok) {
            state['message_to_operator'] = ''
            return data;
        } else {
            console.error(data.message);
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Ошибка при удалении последнего сообщения:', error);
        throw error;
    }
}

async function addOperatorButton(message, neural_message, recognized_message, to_send, is_disabled) {
    const operatorButtonContainer = document.createElement('div');
    operatorButtonContainer.className = 'operator-button-container';
    operatorButtonContainer.innerHTML = `
        <button class="operator-button"">
            <i class="fas fa-headset"></i>
            Отправить оператору
        </button>
    `;

    if (to_send) {
        await sendMessageToAPI(state['dialog_id'], 'bot', 'operator', 'Send to operator', getTimestamp());
    }
    chatMessagesArea.appendChild(operatorButtonContainer);
    setTimeout(scrollToBottom, 0);
    await showSectionButtons();
    enableUserActions();

    const operatorButton = operatorButtonContainer.querySelector('.operator-button');
    if (is_disabled) {
        operatorButton.disabled = true;
    } else {
        operatorButton.addEventListener('click', async (e) => {
            try {
                await fetch(`/api/create-training-message/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        sender_id: state['user_id'],
                        content: message,
                        neural_message: neural_message,
                        recognized_message: recognized_message,
                        status: 'sent_to_operator'
                    }),
                });
            } catch (error) {
                console.error("Ошибка при отправке оператору:", error);
            }
            const confirmMessage = operatorConfirmationMessages[
                Math.floor(Math.random() * operatorConfirmationMessages.length)
            ];
            await deleteOperatorButton();
            operatorButtonContainer.remove();

            await appendMessage('bot', confirmMessage, getTimestamp());
            await sendBotMessage(confirmMessage);
            state['message_to_operator'] = '';
            state['neural_response_message'] = '';
            state['recognition_response_message'] = '';
            enableUserActions();
            await showSectionButtons();
            setTimeout(scrollToBottom, 0);
            await startOrRestartTimer();
        });
    }
}

const sendFeedbackRequest = async () => {
    await sendFeedback('dislike');
    const botAnswerMessage = customResponses[Math.floor(Math.random() * customResponses.length)];
    await appendMessage('bot', botAnswerMessage, getTimestamp(), false);
    await sendBotMessage(botAnswerMessage);
    await addOperatorButton(state['message_to_operator'], state['neural_response_message'], state['recognition_response_message'], true, false);
};

const appendBotFeedbackButtons = async () => {
    const messageDiv = document.createElement('div');
    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.className = 'feedback-buttons';

    const likeButton = document.createElement('button');
    likeButton.className = 'feedback-button like-button';
    likeButton.onclick = async () => {
        likeButton.disabled = true;
        dislikeButton.remove();
        await sendMessageToAPI(state['dialog_id'], 'bot', 'like', 'Useful', getTimestamp());
        await sendFeedback('like');
        await startOrRestartTimer();
        sendThanksFeedbackMessage();
    };

    const dislikeButton = document.createElement('button');
    dislikeButton.className = 'feedback-button dislike-button';
    dislikeButton.onclick = async () => {
        dislikeButton.disabled = true;
        likeButton.remove();
        await sendMessageToAPI(state['dialog_id'], 'bot', 'dislike', 'Not useful', getTimestamp());
        await startOrRestartTimer();
        await sendFeedbackRequest();
    };

    buttonsWrapper.appendChild(likeButton);
    buttonsWrapper.appendChild(dislikeButton);
    messageDiv.appendChild(buttonsWrapper);

    chatMessagesArea.appendChild(messageDiv);
    setTimeout(scrollToBottom, 0);
};


const createFeedbackElements = async () => {
    enableUserActions();
    updateChatLayout();
    showSectionButtons();
    let message = 'Насколько полезным был для Вас этот ответ?';
    await appendMessage('bot', message, getTimestamp());
    await sendBotMessage(message);
    await appendBotFeedbackButtons();
};
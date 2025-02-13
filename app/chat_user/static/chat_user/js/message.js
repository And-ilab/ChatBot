const appendMessage = (sender, content, timestamp, showButton = false) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = sender === 'bot' ? 'message bot-message' : 'message user-message';
    const date = new Date(timestamp);
    date.setHours(date.getHours() + 3);
    const time = date.toTimeString().slice(0, 5);
    const timeClass = sender === 'bot' ? 'message-time' : 'message-time user-message-time';

    const messageDate = timestamp.split(' ')[0];
    const formattedDate = formatDate(messageDate);

    const messages = chatMessagesArea.querySelectorAll('.message');

    if (messages.length === 0 || messageDate !== messages[messages.length - 1].dataset.date) {
        const dateWrapper = document.createElement('div');
        dateWrapper.className = 'message-date-wrapper';
        const dateContent = document.createElement('div');
        dateContent.className = 'message-date-content';
        dateContent.innerHTML = formattedDate;
        dateWrapper.appendChild(dateContent);
        chatMessagesArea.appendChild(dateWrapper);
    }

    messageDiv.innerHTML = `
        ${content}
        <div class="${timeClass}">${time}</div>
    `;
    messageDiv.dataset.date = messageDate;
    chatMessagesArea.appendChild(messageDiv);
    setTimeout(scrollToBottom, 0);

   if (sender === 'bot' && showButton) {

        messageDiv.dataset.date = messageDate;
        chatMessagesArea.appendChild(messageDiv);

        messageDiv.insertAdjacentElement('afterend', menuButtonsContainer);

        scrollToBottom();
   } else {
       messageDiv.dataset.date = messageDate;
       chatMessagesArea.appendChild(messageDiv);
       scrollToBottom();
   }
};

const sendMessageToAPI = async (dialog_id, senderType, messageType, content, timestamp) => {
    try {
        const response = await fetch(`/api/send-message/${dialog_id}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify({
                sender_type: senderType,
                sender_id: senderType === 'user' ? state['user_id'] : undefined,
                message_type: messageType,
                content: content,
                timestamp: timestamp,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        throw error;
    }
};

const sendBotMessage = async (content) => {
    try {
        const timestamp = getTimestamp();
        await sendMessageToAPI(state['dialog_id'], 'bot', 'message', content, timestamp);
    } catch (error) {
        console.error('Ошибка при сохранении сообщения бота:', error);
    }
};

const sendUserMessage = async () => {
    const chatInput = document.getElementById("user-chat-input");
    const message = chatInput.value.trim();
    if (!message) return;

    const userMessageTimestamp = getTimestamp()
    appendMessage('Вы', message, userMessageTimestamp);

    chatInput.value = '';
    try {
        await sendMessageToAPI(state['dialog_id'], 'user', 'message', message, userMessageTimestamp);
        await userMessageHandler(message);
    } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    }
};

async function drawDocument(content) {
    const docName = content.split("^_^")[0];
    const docUUID = content.split("^_^")[1];
    const documentMessageDiv = document.createElement('div');
    const documentButton = document.createElement('button');
    documentButton.className = 'document-button';
    documentButton.innerHTML = `
        ${docName}
        <i class="fas fa-download" style="margin-left: 8px;"></i>
    `;

    try {
        const response = await fetch(`/api/get-document-link-by-uuid/${docUUID}/`);
        if (!response.ok) {
            throw new Error('Не удалось получить ссылку на файл');
        }

        const data = await response.json();
        const filePath = data.file_url;

        const link = document.createElement('a');
        link.href = filePath;
        link.download = docName;
        documentButton.onclick = () => {
            link.click();
        };
        documentMessageDiv.appendChild(documentButton);
        chatMessagesArea.appendChild(documentMessageDiv);
    } catch (error) {
        console.error(`Ошибка при получении ссылки для файла "${docName}":`, error.message);
        documentButton.textContent = `${docName} (недоступен)`;
        documentButton.classList.add('error');
        documentMessageDiv.appendChild(documentButton);
        chatMessagesArea.appendChild(documentMessageDiv);
    }
}

function drawLink(content) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const linkName = content.split("^_^")[0];
            const linkHref = content.split("^_^")[1];
            const messageDiv = document.createElement('div');
            const linkButton = document.createElement('button');
            linkButton.className = 'link-button';
            linkButton.innerHTML = `
                ${linkName}
                <i class="fas fa-external-link-alt" style="margin-left: 8px;"></i>
            `;

            linkButton.addEventListener('click', () => {
                window.open(linkHref, '_blank');
            });
            messageDiv.appendChild(linkButton);
            chatMessagesArea.appendChild(messageDiv);

            resolve();
        }, 1);
    });
}

const loadMessages = async () => {
    try {
        const messagesResponse = await fetch(`/api/messages/${state['dialog_id']}/`);
        const data = await messagesResponse.json();
        chatMessagesArea.innerHTML = '';

        for (let index = 0; index < data.messages.length; index++) {
            const { sender, content, message_type, timestamp } = data.messages[index];
            const isLastMessage = index === data.messages.length - 1;
            const previousMessage = index > 0 ? data.messages[index - 2] : null;

            if (message_type === 'operator') {
                console.log('OPERATOR');
                console.log(previousMessage);
                if (isLastMessage) {
                    await addOperatorButton(previousMessage.content, false, false);
                    await showSectionButtons();
                } else {
                    await addOperatorButton(previousMessage.content, false, true);
                    await showSectionButtons();
                }
            } else if (message_type === 'like') {
                const messageDiv = document.createElement('div');
                const buttonsWrapper = document.createElement('div');
                buttonsWrapper.className = 'feedback-buttons';

                const likeButton = document.createElement('button');
                likeButton.className = 'feedback-button like-button';
                likeButton.innerHTML = '👍 <span>Полезен</span>';
                likeButton.disabled = !isLastMessage;
                if (isLastMessage) {
                    likeButton.onclick = async () => {
                        likeButton.disabled = true;
                        await sendFeedback('like');
                        sendThanksFeedbackMessage();
                    };
                }
                buttonsWrapper.appendChild(likeButton);
                messageDiv.appendChild(buttonsWrapper);

                chatMessagesArea.appendChild(messageDiv);
            } else if (message_type === 'dislike') {
                const messageDiv = document.createElement('div');
                const buttonsWrapper = document.createElement('div');
                buttonsWrapper.className = 'feedback-buttons';

                const dislikeButton = document.createElement('button');
                dislikeButton.className = 'feedback-button dislike-button';
                dislikeButton.innerHTML = '👎 <span>Не то, что хотелось бы</span>';
                dislikeButton.disabled = !isLastMessage;
                if (isLastMessage) {
                    dislikeButton.onclick = async () => {
                        dislikeButton.disabled = true;
                        await sendFeedbackRequest();
                    };
                }
                buttonsWrapper.appendChild(dislikeButton);
                messageDiv.appendChild(buttonsWrapper);

                chatMessagesArea.appendChild(messageDiv);
            } else if (message_type === 'document') {
                if (isLastMessage) {
                    await drawDocument(content);
                    await showSectionButtons();
                } else {
                    await drawDocument(content);
                }
            } else if (message_type === 'link') {
                if (isLastMessage) {
                    await drawLink(content);
                    await showSectionButtons();
                } else {
                    await drawLink(content);
                }
            } else if (message_type === 'message') {
                if (isLastMessage) {
                    if (content === 'Насколько полезным был для Вас этот ответ?') {
                        appendMessage(sender, content, timestamp);
                        await appendBotFeedbackButtons();
                    } else {
                        appendMessage(sender, content, timestamp);
                        await showSectionButtons();
                    }
                } else {
                    appendMessage(sender, content, timestamp);
                }
            }
        }

        setTimeout(scrollToBottom, 0);

    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
    }
};
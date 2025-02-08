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
};
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
        console.log('Сообщение успешно отправлено:', data);
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

    console.log('Отправляемое сообщение:', message);
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

const loadMessages = async () => {
    try {
        const messagesResponse = await fetch(`/api/messages/${state['dialog_id']}/`);
        const data = await messagesResponse.json();
        chatMessagesArea.innerHTML = '';

        for (const { sender, content, message_type, timestamp } of data.messages) {
            if (message_type === 'message') {
                appendMessage(sender, content, timestamp);
            }
//            else {
//                console.log(content);
//                const artifact = await loadArtifact(message_type, content);
//                console.log(artifact);
//                await createDocumentBlock([artifact]);
//            }
        }
        await showSectionButtons();
        setTimeout(scrollToBottom, 0);

    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
    }
};
// Загрузка сообщений для выбранного диалога
async function loadMessages(dialogId) {
    const allDialogs = document.querySelectorAll('.chat-item');
    allDialogs.forEach(dialog => dialog.style.backgroundColor = 'transparent');

    const selectedDialog = document.getElementById(`dialog-${dialogId}`);
    if (selectedDialog) selectedDialog.style.backgroundColor = '#e0e0e0';

    try {
        const response = await fetch(`/api/messages/${dialogId}/`);
        const data = await response.json();

        const chatMessagesContainer = document.getElementById('chat-messages');
        chatMessagesContainer.innerHTML = '';

        data.messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.classList.add(
                'd-flex',
                message.sender === 'bot' ? 'justify-content-start' : 'justify-content-end',
                'archive-item',
                'w-90',
                'mb-3'
            );
            messageElement.innerHTML = `
                <div class="message-wrapper"
                     style="${message.sender === 'bot' ? 'background-color: #8cc3f4;' : 'background-color: #f1f1f1;'}
                            border-radius: 10px; padding: 5px 10px 20px 10px; position: relative;
                            min-width: 180px; max-width: 70%; overflow-wrap: break-word;">
                    <div class="d-flex message-sender">${message.sender}</div>
                    <div class="d-flex message-content">${message.content}</div>
                    <div class="d-flex message-time text-muted" style="position: absolute; right: 10px; bottom: 2px;">
                        ${message.timestamp}
                    </div>
                </div>
            `;
            chatMessagesContainer.appendChild(messageElement);
        });

        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
    }
}

// Загрузка статуса пользователя
async function loadUserStatus(userId) {
    try {
        const response = await fetch(`/api/get_info/${userId}/`);
        const statusData = await response.json();

        const statusElement = document.getElementById('user-info-status');
        const lastActiveElement = document.getElementById('user-info-last-active');

        if (statusData.messages.length > 0) {
            const userStatus = statusData.messages[0];

            statusElement.innerHTML = `
                <span style="color: ${userStatus.is_online ? 'green' : 'red'};">
                    ${userStatus.is_online ? 'Активен' : 'Не активен'}
                </span>
            `;

            lastActiveElement.innerHTML = `
                Последняя активность: ${new Date(userStatus.last_active).toLocaleString()}
            `;
        }
    } catch (error) {
        console.error('Ошибка при загрузке статуса пользователя:', error);
    }
}

// Установка активного диалога
function setActiveDialog(dialogElement) {
    const dialogs = document.querySelectorAll('.chat-item');
    dialogs.forEach(dialog => dialog.classList.remove('active'));
    dialogElement.classList.add('active');
}

// Обновление информации о пользователе
function updateUserInfo(username) {
    const userInfoElement = document.querySelector('.user-info h4');
    if (userInfoElement) {
        userInfoElement.textContent = username;
    }
}

// Установка обработчиков событий после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('send-message-button');

    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    const allDialogs = document.querySelectorAll('.chat-item');

    // Check localStorage for the last selected dialog
    const lastSelectedDialogId = localStorage.getItem('selectedDialogId');

    if (lastSelectedDialogId) {
        const lastDialog = document.getElementById(`dialog-${lastSelectedDialogId}`);
        if (lastDialog) {
            loadMessages(lastSelectedDialogId);
            setActiveDialog(lastDialog);
            updateUserInfo(lastDialog.dataset.username);
            loadUserStatus(lastDialog.dataset.userid);
        }
    } else if (allDialogs.length > 0) {
        const firstDialogId = allDialogs[0].id.split('-')[1];
        loadMessages(firstDialogId);
        setActiveDialog(allDialogs[0]);
        updateUserInfo(allDialogs[0].dataset.username);
        loadUserStatus(allDialogs[0].dataset.userid);
    }

    // Save the selected dialog ID to localStorage when clicked
    allDialogs.forEach(dialog => {
        dialog.addEventListener('click', () => {
            const dialogId = dialog.id.split('-')[1];
            localStorage.setItem('selectedDialogId', dialogId);
            loadMessages(dialogId);
            setActiveDialog(dialog);
            updateUserInfo(dialog.dataset.username);
            loadUserStatus(dialog.dataset.userid);
        });
    });
});
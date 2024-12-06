// Загрузка сообщений для выбранного диалога
async function loadMessages(dialogId) {
    // Сбрасываем выделение всех диалогов
    const allDialogs = document.querySelectorAll('.chat-item');
    allDialogs.forEach(dialog => dialog.style.backgroundColor = 'transparent');

    // Выделяем текущий диалог
    const selectedDialog = document.getElementById(`dialog-${dialogId}`);
    if (selectedDialog) selectedDialog.style.backgroundColor = '#e0e0e0';

    try {
        // Загружаем сообщения с сервера
        const response = await fetch(`/api/messages/${dialogId}/`);
        const data = await response.json();

        // Отображаем сообщения
        const chatMessagesContainer = document.getElementById('chat-messages');
        chatMessagesContainer.innerHTML = ''; // Очищаем контейнер сообщений

        data.messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.classList.add(
                'd-flex',
                message.sender === 'Bot' ? 'justify-content-start' : 'justify-content-end',
                'archive-item',
                'w-90',
                'mb-3'
            );
            messageElement.innerHTML = `
                <div class="message-wrapper"
                     style="${message.sender === 'Bot' ? 'background-color: #8cc3f4;' : 'background-color: #f1f1f1;'}
                            border-radius: 10px; padding: 5px 10px 20px 10px; position: relative;
                            min-width: 180px; max-width: 70%; overflow-wrap: break-word;">
                    <div class="d-flex message-sender">${message.sender}</div>
                    <div class="d-flex message-content">${message.content}</div>
                    <div class="d-flex message-time text-muted"
                         style="position: absolute; right: 10px; bottom: 2px;">
                        ${message.timestamp}
                    </div>
                </div>
            `;
            chatMessagesContainer.appendChild(messageElement);
        });

        // Прокручиваем контейнер вниз
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
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

    // Автоматическая загрузка первого диалога
    const firstDialog = document.querySelector('.chat-item');
    if (firstDialog) {
        const dialogId = firstDialog.id.split('-')[1];
        loadMessages(dialogId); // Загружаем сообщения для первого диалога
        setActiveDialog(firstDialog); // Устанавливаем его как активный диалог
        updateUserInfo(firstDialog.dataset.username); // Обновляем информацию о пользователе
    }
});
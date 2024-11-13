function loadMessages(dialogId) {
    const allDialogs = document.querySelectorAll('.chat-item');
    allDialogs.forEach(dialog => {
        dialog.style.backgroundColor = 'transparent';
    });

    const selectedDialog = document.getElementById('dialog-' + dialogId);
    selectedDialog.style.backgroundColor = '#e0e0e0';

    fetch(`/api/messages/${dialogId}/`)
        .then(response => response.json())
        .then(data => {
            const chatMessagesContainer = document.getElementById('chat-messages');
            chatMessagesContainer.innerHTML = '';

            data.messages.forEach(message => {
                const messageElement = document.createElement('div');
                messageElement.classList.add(
                    'd-flex',
                     message.sender === 'Bot' ? 'justify-content-start' : 'justify-content-end',
                    'message-item',
                    'w-90',
                    'mb-3'
                );
                messageElement.innerHTML = `
                    <div class="message-wrapper"
                         style="${message.sender === 'Bot' ? 'background-color: #8cc3f4;' : 'background-color: #f1f1f1;'} border-radius: 10px; padding: 5px 10px 20px 10px; position: relative; min-width: 180px; max-width: 70%; overflow-x: wrap;">
                        <div class="d-flex message-sender">${message.sender}</div>
                        <div class="d-flex message-content">${message.content}</div>
                        <div class="d-flex message-time text-muted" style="position: absolute; right: 10px; bottom: 2px;">
                            ${message.timestamp}
                        </div>
                    </div>
                `;
                chatMessagesContainer.appendChild(messageElement);
                chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
            });
        });
}

document.addEventListener('DOMContentLoaded', function () {
    const sendButton = document.getElementById('send-message-button');

    if (sendButton) {
        sendButton.addEventListener('click', function () {
            const input = document.querySelector('.form-control');
            const messageContent = input.value.trim();

            if (messageContent !== '') {
                const activeDialog = document.querySelector('.chat-item.active');
                const dialogId = activeDialog ? activeDialog.id.split('-')[1] : null;

                if (dialogId) {
                    fetch(`/api/send-message/${dialogId}/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCSRFToken()
                        },
                        body: JSON.stringify({
                            sender_type: 'bot',
                            content: messageContent
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        input.value = '';
                        loadMessages(dialogId);
                    })
                    .catch(error => {
                        console.error('Ошибка при отправке сообщения:', error);
                    });
                }
            }
        });
    }
});

function getCSRFToken() {
    const csrfTokenMeta = document.querySelector("meta[name='csrf-token']");
    return csrfTokenMeta ? csrfTokenMeta.getAttribute("content") : "";
}

function setActiveDialog(dialogElement) {
    const dialogs = document.querySelectorAll('.chat-item');
    dialogs.forEach(dialog => dialog.classList.remove('active'));
    dialogElement.classList.add('active');
}

function updateUserInfo(username) {
    const userInfoElement = document.querySelector('.user-info h4');
    if (userInfoElement) {
        userInfoElement.textContent = username;
    }
}

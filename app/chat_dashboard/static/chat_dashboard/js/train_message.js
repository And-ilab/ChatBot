document.addEventListener('DOMContentLoaded', function () {
    const smileyButton = document.getElementById('add-smiley');
    const smileyDropdown = document.getElementById('smiley-dropdown');
    const answerInput = document.getElementById("admin-response");
    const replyBtn = document.getElementById("reply-btn");
    const replyAndTrainBtn = document.getElementById("reply-and-train-btn");
    const userMessageInput = document.getElementById("train-input");

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.startsWith('${name}=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    async function notifyUser(answer) {
        const messageId = userMessageInput.getAttribute('data-message-id');
        const senderId = userMessageInput.getAttribute('data-sender-id');

        console.log(messageId);
        console.log(senderId);
        if (!messageId && !senderId) {
            console.log('Ошибка messageId или senderId');
            return;
        }
        try {
            const response = await fetch('/api/mark-trained/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({ message_id: messageId, sender_id: senderId, answer: answer })
            });

            if (response.ok) {
                alert('Вопрос удалён из списка дообучения и уведомление отправлено.');
                window.location.href = '/chat_dashboard/training/';
            } else {
                const errorData = await response.json();
                alert('Ошибка: ' + errorData.error);
            }
        } catch (error) {
            console.error('Ошибка при отправке запроса:', error);
        }
    }

    async function handleResponse(action) {
        const responseText = answerInput.value.trim();

        if (!responseText) {
            answerInput.classList.add("border", "border-danger");
            return;
        }

        answerInput.classList.remove("border", "border-danger");

        await notifyUser(responseText);
        answerInput.value = "";
    }

    replyBtn.addEventListener("click", function () {
        handleResponse("reply");
    });

    replyAndTrainBtn.addEventListener("click", function () {
        handleResponse("reply_and_train");
    });

    smileyButton.addEventListener('click', function (event) {
        event.stopPropagation();
        smileyDropdown.style.display = (smileyDropdown.style.display === 'block') ? 'none' : 'block';
    });

    document.addEventListener('click', function (event) {
        if (!smileyButton.contains(event.target) && !smileyDropdown.contains(event.target)) {
            smileyDropdown.style.display = 'none';
        }
    });

    // Добавление смайликов в текстовое поле
    document.querySelectorAll('.smiley').forEach(smiley => {
        smiley.addEventListener('click', function () {
            const textarea = document.getElementById('admin-response');
            textarea.value += this.textContent;
        });
    });
});
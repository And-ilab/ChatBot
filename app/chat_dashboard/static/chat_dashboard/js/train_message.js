document.addEventListener('DOMContentLoaded', function () {
    const smileyButton = document.getElementById('add-smiley');
    const smileyDropdown = document.getElementById('smiley-dropdown');
    const answerInput = document.getElementById("admin-response");
    const replyBtn = document.getElementById("reply-btn");
    const replyAndTrainBtn = document.getElementById("reply-and-train-btn");
    const userMessageInput = document.getElementById("train-input");

    document.querySelectorAll('.tab-button').forEach((button) => {
        button.addEventListener('click', () => {
          document.querySelectorAll('.tab-button').forEach((btn) => btn.classList.remove('active'));
          button.classList.add('active');

          document.querySelectorAll('.tab-pane').forEach((pane) => {
            pane.classList.remove('active');
            pane.style.opacity = 0;
          });

          const tabId = button.getAttribute('data-tab');
          const activePane = document.getElementById(tabId);
          activePane.classList.add('active');
          setTimeout(() => {
            activePane.style.opacity = 1;
          }, 10);
        });
    });

    function copyToClipboard(element, message) {
        element.select();
        document.execCommand("copy");
        // Показываем уведомление
        const notification = document.createElement('div');
        notification.className = 'alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3';
        notification.innerText = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }

    document.querySelectorAll('input[name="train-option"]').forEach((radio) => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'add-to-existing') {
                document.getElementById('existing-question-dropdown').style.display = 'block';
                document.getElementById('new-question-form').style.display = 'none';
            } else {
                document.getElementById('existing-question-dropdown').style.display = 'none';
                document.getElementById('new-question-form').style.display = 'block';
            }
        });
    });

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
document.addEventListener('DOMContentLoaded', function () {
    const smileyButton = document.getElementById('add-smiley');
    const smileyDropdown = document.getElementById('smiley-dropdown');
    const responseInput = document.getElementById("admin-response");
    const replyBtn = document.getElementById("reply-btn");
    const replyAndTrainBtn = document.getElementById("reply-and-train-btn");

    function handleResponse(action) {
        const responseText = responseInput.value.trim();

        if (!responseText) {
            responseInput.classList.add("border", "border-danger");
            return;
        }

        responseInput.classList.remove("border", "border-danger");

        console.log(`Action: ${action}, Message: ${responseText}`);
        responseInput.value = "";
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
//document.addEventListener('DOMContentLoaded', async function () {
//    const input = document.getElementById('train-input').value;
//    const notifyUser = document.getElementById('notify-user');
//    if (notifyUser) {
//        notifyUser.addEventListener('click', async function () {
//            const messageId = this.getAttribute('data-message-id');
//            const senderId = this.getAttribute('data-sender-id')
//            if (!messageId) {
//                alert('Идентификатор сообщения не найден.');
//                return;
//            }
//            try {
//                const response = await fetch('/api/mark-trained/', {
//                    method: 'POST',
//                    headers: {
//                        'Content-Type': 'application/json',
//                        'X-CSRFToken': getCookie('csrftoken'),
//                    },
//                    body: JSON.stringify({ message_id: messageId, sender_id: senderId })
//                });
//
//                if (response.ok) {
//                    document.getElementById('train-input').value = '';
//                    alert('Вопрос удалён из списка дообучения и уведомление отправлено.');
//                    window.location.href = '/chat_dashboard/training/';
//                } else {
//                    const errorData = await response.json();
//                    alert('Ошибка: ' + errorData.error);
//                }
//            } catch (error) {
//                console.error('Ошибка при отправке запроса:', error);
//            }
//        });
//    }
//});
//
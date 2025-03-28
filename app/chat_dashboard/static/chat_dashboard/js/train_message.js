function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `alert ${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
    notification.innerText = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2000);
}

document.addEventListener('DOMContentLoaded', function () {
    const smileyButton = document.getElementById('add-smiley');
    const smileyDropdown = document.getElementById('smiley-dropdown');
    const answerInput = document.getElementById("admin-response");
    const replyBtn = document.getElementById("reply-btn");
    const trainBtn = document.getElementById("train-btn");
    const userMessageInput = document.getElementById("train-input");

    const trainOptionRadios = document.querySelectorAll('input[name="train-option"]');
    const questionSelect = document.getElementById('question-select');
    const newQuestionInput = document.querySelector('#new-question-form input');

    trainOptionRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'add-to-existing') {
                document.getElementById('existing-question-dropdown').style.display = 'block';
                document.getElementById('new-question-form').style.display = 'none';
                questionSelect.classList.remove('border', 'border-danger');
            } else {
                document.getElementById('existing-question-dropdown').style.display = 'none';
                document.getElementById('new-question-form').style.display = 'block';
                newQuestionInput.classList.remove('border', 'border-danger');
            }
        });
    });

    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    const userQuestionInput = document.getElementById('train-input');
    const userQuestionHeight = userQuestionInput.offsetHeight;

    document.querySelectorAll('.auto-resize').forEach(function(textarea) {
        textarea.style.minHeight = `${userQuestionHeight}px`;
        autoResizeTextarea(textarea);
        textarea.addEventListener('input', function() {
            autoResizeTextarea(textarea);
        });
    });

     function resetTrainingForm() {
        answerInput.value = "";
        answerInput.classList.remove("border", "border-danger");
        document.querySelector('input[value="add-to-existing"]').checked = true;

        questionSelect.selectedIndex = 0;
        questionSelect.classList.remove('border', 'border-danger');

        newQuestionInput.value = '';
        newQuestionInput.classList.remove('border', 'border-danger');
        document.getElementById('new-question-form').style.display = 'none';

        document.getElementById('existing-question-dropdown').style.display = 'block';
    }

    fetch('/api/get-all-questions')
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('question-select');
            data.result.forEach(question => {
                const option = document.createElement('option');
                option.value = question.id;
                option.textContent = question.content;
                select.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Ошибка при загрузке вопросов:', error);
        });

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

    document.querySelectorAll('.copy-btn').forEach(function(button) {
        button.addEventListener('click', function() {
            const targetSelector = this.getAttribute('data-target');
            const targetElement = document.querySelector(targetSelector);

            if (targetElement) {
                navigator.clipboard.writeText(targetElement.value)
                    .then(() => {
                        showNotification('Текст успешно скопирован.', 'alert-success');
                    })
                    .catch(err => {
                        console.error('Ошибка при копировании текста: ', err);
                    });
            }
        });
    });

    function copyToClipboard(element, message) {
        element.select();
        document.execCommand("copy");
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
                    'X_CSRFTOKEN': getCookie('csrftoken'),
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

        if (action === 'reply_and_train') {
            let isValid = true;
            const selectedOption = document.querySelector('input[name="train-option"]:checked').value;

            if (selectedOption === 'add-to-existing') {
                if (questionSelect.selectedIndex === 0 || questionSelect.value === 'Выберите существующий вопрос') {
                    questionSelect.classList.add('border', 'border-danger');
                    isValid = false;
                } else {
                    questionSelect.classList.remove('border', 'border-danger');
                }
            } else {
                if (!newQuestionInput.value.trim()) {
                    newQuestionInput.classList.add('border', 'border-danger');
                    isValid = false;
                } else {
                    newQuestionInput.classList.remove('border', 'border-danger');
                }
            }

            if (!isValid) {
                e.preventDefault();
                return false;
            }
        }
        await notifyUser(responseText);
        resetForm();
    }

    replyBtn.addEventListener("click", function () {
        handleResponse("reply");
    });

    trainBtn.addEventListener("click", function () {
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

    document.querySelectorAll('.smiley').forEach(smiley => {
        smiley.addEventListener('click', function () {
            answerInput.value += this.textContent;
        });
    });
});
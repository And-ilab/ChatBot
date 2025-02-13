const userMessageHandler = async (message) => {
    const cleanedMessage = message
        .trim()
        .replace(/[^\w\sа-яА-ЯёЁ]/g, '')
        .toLowerCase();

    const isGreeting = greetings.some(greeting => cleanedMessage.includes(greeting));
    const isMenu = menu.some(menu => cleanedMessage.includes(menu));

    document.querySelectorAll('.operator-button').forEach(button => {
        button.disabled = true;
    });

    if (isGreeting) {
        showGreetingMessages();
        return;
    }

    else if (isMenu) {
        await showSectionButtons();
        return;
    }

    const children = chatMessagesArea.children;
    if (children.length >= 2) {
        const thirdLastChild = children[children.length - 2];
        if (thirdLastChild) {
            const text = [...thirdLastChild.childNodes]
                .filter(node => node.nodeType === 3)
                .map(node => node.textContent.trim())
                .join(' ');

            const normalizedText = text.replace(/\s+/g, ' ').trim();
            if (normalizedText === 'Подскажите, что я могу улучшить в своем ответе?') {
                await sendFeedback('dislike', message);
                await sendThanksFeedbackMessage();
                return;
            }
        }
    } else {
        return;
    }

    await recognizeAndProcessMessage(message);
}

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const showGreetingMessages = async () => {
    const username = state['username'];
    const greetingsStart = [
        `Привет, ${username}! 😊 Чем могу помочь сегодня?`,
        `Здравствуйте, ${username}! Рады видеть Вас.`,
        `Приветствую, ${username}! 👋 Что Вас интересует?`,
        `Добрый день, ${username}! Чем могу быть полезен?`,
        `Привет, ${username}! Готов помочь Вам.`,
        `Привет, ${username}! Надеюсь, у Вас всё супер 😊!`,
        `Здравствуйте, ${username}! 😊`,
        `Привет, ${username}! Рад Вас видеть.`,
        `Доброго времени суток, ${username}! Чем могу помочь?`,
        `Привет, ${username}! 👋 С чего начнем?`,
        `Здравствуйте, ${username}! Готов ответить на Ваши вопросы.`,
        `Привет, ${username}! 😊 Как я могу сделать Ваш день лучше?`,
        `Добрый день, ${username}! Расскажите, с чем Вам нужна помощь?`,
        `Приветствую, ${username}! Чем могу быть полезен сегодня?`,
        `Здравствуйте, %{username}! 😊 Давайте решим Ваш вопрос.`,
        `Привет, ${username}! Буду рад помочь.`,
        `Добрый день, ${username}! 👋 Чем могу Вас поддержать?`,
        `Привет, ${username}! Готов помочь Вам.`,
        `Здравствуйте, ${username}! 😊 Как я могу Вам помочь сегодня?`,
        `Привет, ${username}! Расскажите, что Вам нужно, и я постараюсь помочь.`,
        `Доброго дня, ${username}! 😊 Чем могу быть полезен?`,
    ];
    const messages = [getRandomElement(greetingsStart), getRandomElement(greetingOptions)];

    for (const message of messages) {
        appendMessage('bot', message, getTimestamp());
        await sendBotMessage(message);
    }
    await showSectionButtons();
};

async function recognizeAndProcessMessage(cleanedMessage) {
    try {
        hideMenu();
        disableUserActions();
        typingBlock.style.display = 'flex';
        const recognizedQuestion = await recognizeQuestion(cleanedMessage);
        if (recognizedQuestion) {
            await processRecognizedQuestion(recognizedQuestion);
        } else {
            await handleUnrecognizedMessage(cleanedMessage);
        }
    } catch (error) {
        console.error("Ошибка при обработке сообщения:", error.message);
    } finally {
        typingBlock.style.display = 'none';
    }
}

async function recognizeQuestion(message) {
    try {
        const response = await fetch("/api/recognize-question/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
            body: JSON.stringify({ message }),
        });

        if (!response.ok) {
            throw new Error(`Ошибка: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.recognized_question || null;
    } catch (error) {
        console.error("Ошибка при распознавании вопроса:", error.message);
        return null;
    }
}

async function processRecognizedQuestion(questionContent) {
    try {
        const encodedContent = encodeURIComponent(questionContent);
        const response = await fetch(`/api/get-question-id-by-content/?questionContent=${encodedContent}`, { method: 'GET' });

        if (!response.ok) {
            throw new Error(`Ошибка при получении ID вопроса: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json();
        const questionID = data.result["@rid"];
        await showAnswer(questionID, 'recognition');
    } catch (error) {
        console.error("Ошибка при обработке распознанного вопроса:", error.message);
    }
}

async function deleteOperatorButton() {
    try {
        const response = await fetch(`/api/delete_last_chat_message/${state['dialog_id']}/`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
        });

        const data = await response.json();
        console.log(data);

        if (response.ok) {
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

async function addOperatorButton(message, to_send, is_disabled) {
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

    const operatorButton = operatorButtonContainer.querySelector('.operator-button');
    if (is_disabled) {
        operatorButton.disabled = true;
    } else {
        operatorButton.addEventListener('click', async (e) => {
            try {
                await fetch("/api/create-training-message/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrfToken,
                    },
                    body: JSON.stringify({
                        sender_id: state['user_id'],
                        content: message,
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

            appendMessage('bot', confirmMessage, getTimestamp());
            await sendBotMessage(confirmMessage);
            setTimeout(scrollToBottom, 0);
        });
    }
}

async function handleUnrecognizedMessage(message) {
    const botAnswerMessage = customResponses[Math.floor(Math.random() * customResponses.length)];
    appendMessage('bot', botAnswerMessage, getTimestamp(), false);
    await sendBotMessage(botAnswerMessage);

    await addOperatorButton(message, true, false);
    enableUserActions();
}
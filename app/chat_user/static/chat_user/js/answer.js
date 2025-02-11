const userMessageHandler = async (message) => {
    const cleanedMessage = message
        .trim()
        .replace(/[^\w\sа-яА-ЯёЁ]/g, '')
        .toLowerCase();

    const isGreeting = greetings.some(greeting => cleanedMessage.includes(greeting));
    const isMenu = menu.some(menu => cleanedMessage.includes(menu));

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

            console.log(text);
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
    const responses = [
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
        `Здравствуйте, [Имя]! 😊 Давайте решим Ваш вопрос.`,
        `Привет, ${username}! Буду рад помочь.`,
        `Добрый день, ${username}! 👋 Чем могу Вас поддержать?`,
        `Привет, ${username}! Готов помочь Вам.`,
        `Здравствуйте, ${username}! 😊 Как я могу Вам помочь сегодня?`,
        `Привет, ${username}! Расскажите, что Вам нужно, и я постараюсь помочь.`,
        `Доброго дня, ${username}! 😊 Чем могу быть полезен?`,
    ];

    const greetingOptions = [
        'Задайте свой вопрос или выберите из меню.',
        'Задавайте свои вопросы или выбирайте интересующую вас тему в меню.',
        'Выберите пункт меню или напишите свой вопрос.',
        'Вы можете воспользоваться меню или написать запрос — я готов помочь!',
        'Выберите из меню или опишите вопрос.',
        'Используйте меню или напишите мне.',
        'Выберите пункт меню или задайте вопрос текстом.',
        'Давайте начнем — выберите раздел в меню или напишите запрос.',
        'Вы можете воспользоваться меню или написать, что вам нужно.',
        'Выберите пункт меню или задайте вопрос.',
        'Используйте меню или напишите запрос — я на связи!',
        'Выберите раздел в меню или опишите проблему.',
        'Воспользуйтесь меню или напишите вопрос.',
        'Выберите пункт меню или опишите проблему.',
        'Используйте меню или задайте вопрос.',
        'Воспользуйтесь меню или напишите, что вас интересует.',
        'Используйте меню или опишите, что Вас беспокоит.',
        'Выберите раздел в меню или напишите запрос.',
        'Воспользуйтесь меню или напишите запрос.'
    ];
    const messages = [getRandomElement(responses), getRandomElement(greetingOptions)];

    for (const message of messages) {
        appendMessage('bot', message, getTimestamp());
        await sendBotMessage(message);
    }
    await showSectionButtons();
};

async function recognizeAndProcessMessage(cleanedMessage) {
    try {
        hideUIElements();
        disableUserActions();
        typingBlock.style.display = 'flex';
        const recognizedQuestion = await recognizeQuestion(cleanedMessage);
        if (recognizedQuestion) {
            await processRecognizedQuestion(recognizedQuestion);
        }
    } catch (error) {
        console.error("Ошибка при обработке сообщения:", error.message);
    } finally {
        typingBlock.style.display = 'none';
    }
}

function hideUIElements() {
    menuButtonsContainer.style.display = 'none';
    chatMessagesArea.style.height = '560px';
    menuButton.style.display = 'none';
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
        let questionToSend = '';
        if (data.recognized_question) {
            questionToSend = data.recognized_question;
            const encodedQuestionContent = encodeURIComponent(data.recognized_question);
            try {
                const questionIDResponse = await fetch(`/api/get-question-id-by-content/?questionContent=${encodedQuestionContent}`, {method: 'GET'});
                const data = await questionIDResponse.json();
                const newQuestionID = data['result']['@rid'];
                await showAnswer(newQuestionID);
            } catch (error) {
                console.error('Error fetching question ID:', error.message);
            }
        } else {
            const operatorConfirmationMessages = [
                "Спасибо за ваш вопрос! Мы передали его оператору, и вы получите ответ в течение 8 часов. А пока можете задать ещё один вопрос — я всегда готов помочь! 😊",
                "Благодарим вас за обращение! Ваш вопрос уже у оператора, и скоро вы получите ответ. Если у вас есть ещё вопросы, не стесняйтесь задавать — я здесь, чтобы помочь! 🚀",
                "Спасибо, что направили вопрос оператору! Вы получите ответ в ближайшее время. А пока можете задать ещё один вопрос — я всегда на связи! 📩",
                "Большое спасибо за ваш вопрос! Мы уже передали его оператору, и скоро вы получите ответ. Если есть ещё что-то, чем я могу помочь, просто спросите! 😄",
                "Спасибо за обращение! Ваш вопрос уже у оператора, и ответ придёт в течение 8 часов. А пока можете задать ещё один вопрос — я готов помочь! 🛎️",
                "Благодарим вас за вопрос! Мы передали его оператору, и вы получите ответ в ближайшее время. Если у вас есть ещё вопросы, задавайте — я всегда рад помочь! 📨",
                "Спасибо, что направили вопрос оператору! Ответ придёт в течение 8 часов. А пока можете задать ещё один вопрос — я здесь, чтобы помочь! 🕒",
                "Большое спасибо за ваш вопрос! Мы уже передали его оператору, и скоро вы получите ответ. Если есть ещё что-то, чем я могу помочь, просто спросите! 😊",
                "Спасибо за обращение! Ваш вопрос уже у оператора, и ответ придёт в течение 8 часов. А пока можете задать ещё один вопрос — я готов помочь! 🚀",
                "Благодарим вас за вопрос! Мы передали его оператору, и вы получите ответ в ближайшее время. Если у вас есть ещё вопросы, задавайте — я всегда рад помочь! 📩",
            ];

            const customResponses = [
                "К сожалению, я не смог понять ваш вопрос. Пожалуйста, уточните его или задайте вопрос, связанный с банковскими процессами. Если нужно, я могу передать ваш вопрос оператору, и вы получите ответ на электронную почту в течение 8 часов. 📧",
                "Извините, я не совсем понял ваш запрос. Может быть, вы хотели бы задать вопрос о банковских процессах? Если нет, я могу передать ваш вопрос оператору, и вам ответят в течение 8 часов. 😊",
                "К сожалению, я не смог обработать ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор связался с вами по электронной почте. 📨",
                "Простите, я не смог распознать ваш вопрос. Может быть, вы хотели бы уточнить его или задать другой вопрос, связанный с банковскими процессами? Если нужно, я могу передать ваш запрос оператору. 🛎️",
                "К сожалению, я не смог понять ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор ответил вам в течение 8 часов. 📩",
                "Извините, я не смог обработать ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору. 🕒",
                "К сожалению, я не смог распознать ваш запрос. Пожалуйста, уточните его или задайте вопрос, связанный с банковскими процессами. Если нужно, я могу передать ваш вопрос оператору. 📧",
                "Простите, я не смог понять ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору, и вам ответят в течение 8 часов. 🕒",
                "К сожалению, я не смог обработать ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор связался с вами по электронной почте. 📨",
                "Извините, я не смог распознать ваш вопрос. Может быть, вы хотели бы уточнить его или задать другой вопрос, связанный с банковскими процессами? Если нужно, я могу передать ваш запрос оператору. 🛎️",
                "К сожалению, я не смог понять ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор ответил вам в течение 8 часов. 📩",
                "Простите, я не смог обработать ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору. 🕒",
                "К сожалению, я не смог распознать ваш запрос. Пожалуйста, уточните его или задайте вопрос, связанный с банковскими процессами. Если нужно, я могу передать ваш вопрос оператору. 📧",
                "Извините, я не смог понять ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору, и вам ответят в течение 8 часов. 🕒",
                "К сожалению, я не смог обработать ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор связался с вами по электронной почте. 📨",
                "Простите, я не смог распознать ваш вопрос. Может быть, вы хотели бы уточнить его или задать другой вопрос, связанный с банковскими процессами? Если нужно, я могу передать ваш запрос оператору. 🛎️",
                "К сожалению, я не смог понять ваш запрос. Пожалуйста, задайте вопрос, связанный с банковскими процессами, или дайте мне знать, если хотите, чтобы оператор ответил вам в течение 8 часов. 📩",
                "Извините, я не смог обработать ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору. 🕒",
                "К сожалению, я не смог распознать ваш запрос. Пожалуйста, уточните его или задайте вопрос, связанный с банковскими процессами. Если нужно, я могу передать ваш вопрос оператору. 📧",
                "Простите, я не смог понять ваш вопрос. Может быть, вы хотели бы задать другой вопрос, связанный с банковскими процессами? Если нет, я могу передать ваш запрос оператору, и вам ответят в течение 8 часов. 🕒",
            ];
            const messageId = Date.now(); // уникальный ID для сообщения
            const botAnswerMessage = customResponses[Math.floor(Math.random() * customResponses.length)];
            appendMessage('bot', botAnswerMessage, getTimestamp(), false, messageId); //
            await sendBotMessage(botAnswerMessage);

            const operatorButtonContainer = document.createElement('div');
            operatorButtonContainer.className = 'operator-button-container';
            operatorButtonContainer.innerHTML = `
                <button class="operator-button" data-message-id="${messageId}">
                    <i class="fas fa-headset"></i>
                    Отправить оператору
                </button>
            `;
            chatMessagesArea.appendChild(operatorButtonContainer);
                    scrollToBottom();

            // Навешиваем обработчик прямо на эту кнопку:
            const operatorButton = operatorButtonContainer.querySelector('.operator-button');
            operatorButton.addEventListener('click', async (e) => {
                const confirmMessage = operatorConfirmationMessages[
                    Math.floor(Math.random() * operatorConfirmationMessages.length)
                ];

                appendMessage('bot', confirmMessage, getTimestamp());
                await sendBotMessage(confirmMessage);

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

                // Удаляем контейнер с кнопкой, чтобы предотвратить повторную отправку
                operatorButtonContainer.remove();
            }, { once: true });
            chatInput.disabled = false;
        }


        return data.recognized_question || null;
    } catch (error) {
        console.error("Ошибка при распознавании вопроса:", error.message);
        return null;
    }
}

async function processRecognizedQuestion(questionContent) {
    try {
        console.log(questionContent);
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

async function handleUnrecognizedMessage(message) {
    const botAnswerMessage = "Ваш запрос не распознан. Сообщение было отправлено на обучение.";
    appendMessage("bot", botAnswerMessage, getTimestamp());
    await sendBotMessage(botAnswerMessage);

    try {
        const response = await fetch("/api/create-training-message/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
            body: JSON.stringify({ sender_id: state["user_id"], content: message }),
        });

        if (!response.ok) {
            throw new Error(`Ошибка: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error("Ошибка при отправке сообщения на обучение:", error.message);
    } finally {
        enableUserActions();
    }
}

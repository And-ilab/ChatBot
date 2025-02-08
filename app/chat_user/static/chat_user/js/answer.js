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
        } else {
            await handleUnrecognizedMessage(cleanedMessage);
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

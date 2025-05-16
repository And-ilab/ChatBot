const userMessageHandler = async (message) => {
    const cleanedMessage = message
    .trim()
    .replace(/[^\w\sа-яА-ЯёЁ]/g, '')
    .toLowerCase();

    const messageWords = cleanedMessage.split(/\s+/);

    const greetings = [
        'привет', 'здравствуй', 'добрый день', 'добрый вечер', 'приветствую',
        'здравия желаю', 'хай', 'хей', 'здарова', 'здаров', 'здорова', 'здоров',
        'салам', 'доброй ночи', 'приветик', 'хаюшки'
    ];

    const isPureGreeting = greetings.some(greeting => {
        if (greeting.includes(' ')) {
            return cleanedMessage === greeting;
        }
        return messageWords.length === 1 && messageWords[0] === greeting;
    });

    const isMenu = menu.some(menu => cleanedMessage.includes(menu));

    document.querySelectorAll('.operator-button').forEach(button => {
        button.disabled = true;
    });

    if (isPureGreeting) {
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
        `Здравствуйте, ${username}! 😊 Давайте решим Ваш вопрос.`,
        `Привет, ${username}! Буду рад помочь.`,
        `Добрый день, ${username}! 👋 Чем могу Вас поддержать?`,
        `Привет, ${username}! Готов помочь Вам.`,
        `Здравствуйте, ${username}! 😊 Как я могу Вам помочь сегодня?`,
        `Привет, ${username}! Расскажите, что Вам нужно, и я постараюсь помочь.`,
        `Доброго дня, ${username}! 😊 Чем могу быть полезен?`,
    ];
    const messages = [getRandomElement(greetingsStart), getRandomElement(greetingOptions)];

    for (const message of messages) {
        await appendMessage('bot', message, getTimestamp());
        await sendBotMessage(message);
    }
    await showSectionButtons();
};

async function recognizeAndProcessMessage(cleanedMessage) {
    try {
        hideMenu();
        disableUserActions();
        typingBlock.style.display = 'flex';
        chatMessagesArea.style.paddingBottom = '20px';
        state['message_to_operator'] = cleanedMessage;
        const recognizedQuestion = await recognizeQuestion(cleanedMessage);
        if (recognizedQuestion) {
            state['recognition_response_message'] = recognizedQuestion;
            await processRecognizedQuestion(recognizedQuestion);
        } else {
            await handleUnrecognizedMessage(cleanedMessage);
        }
    } catch (error) {
        console.error("Ошибка при обработке сообщения:", error.message);
    } finally {
        typingBlock.style.display = 'none';
        chatMessagesArea.style.paddingBottom = '10px';
    }
}

async function recognizeQuestion(message) {
    try {
        const response = await fetch(`/api/recognize-question/`, {
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


const fetchSectionNameByQuestion = async (questionID) => {
    const encodeQuestionID = encodeURIComponent(questionID);
    try {
        const response = await fetch(`/api/get-section-by-question/?questionID=${encodeQuestionID}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}, Text: ${errorText}`);
        }

        const data = await response.json();
        return data.name || null;

    } catch (error) {
        console.error('Error fetching section by question:', error.message);
        return null;
    }
};


async function processRecognizedQuestion(questionContent) {
    try {
        const encodedContent = encodeURIComponent(questionContent);
        const response = await fetch(`/api/get-question-id-by-content/?questionContent=${encodedContent}`, { method: 'GET' });

        if (!response.ok) {
            throw new Error(`Ошибка при получении ID вопроса: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json();
        const questionID = data.result["@rid"];
        const sectionName = await fetchSectionNameByQuestion(questionID);
        await sendPopularRequest(sectionName);
        await showAnswer(questionID, 'recognition');
    } catch (error) {
        console.error("Ошибка при обработке распознанного вопроса:", error.message);
    }
}


async function sendRequestToFastAPI(userInput) {
    const url = "https://www.chatbot.digitranslab.com/fastapi/generate/";
    const data = {
        text: userInput
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const result = await response.json();
        return result.response;
    } catch (error) {
        console.error("Ошибка при отправке запроса:", error);
        return "Произошла ошибка при обработке запроса.";
    }
}

async function handleUnrecognizedMessage(message) {
    typingBlock.style.display = 'flex';
    chatMessagesArea.style.paddingBottom = '20px';
    let is_neural_active = false;
    await fetch(`${apiurl}/api/neural-status/`)
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            is_neural_active = data.neural_active;
        }
    });
    let neuralMessage = '';
    if (is_neural_active) {
        await sendPopularRequest('Иное');
        disableCloseButton();
        neuralMessage = await sendRequestToFastAPI(message);
        await appendMessage('bot', neuralMessage, getTimestamp(), false);
        await sendBotMessage(neuralMessage);
        state['neural_response_message'] = neuralMessage;
        await createFeedbackElements();
        enableCloseButton();
    } else {
        neuralMessage = withoutNeuralMessages[Math.floor(Math.random() * withoutNeuralMessages.length)];
        await appendMessage('bot', neuralMessage, getTimestamp(), false);
        await sendBotMessage(neuralMessage);
        state['neural_response_message'] = neuralMessage;
        const botAnswerMessage = customResponses[Math.floor(Math.random() * customResponses.length)];
        await appendMessage('bot', botAnswerMessage, getTimestamp(), false);
        await sendBotMessage(botAnswerMessage);
        typingBlock.style.display = 'none';
        chatMessagesArea.style.paddingBottom = '10px';
        await addOperatorButton(message, neuralMessage, '', true, false);
    }
}
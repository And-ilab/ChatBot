function chat_new() {
    // CSRF Token
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    // Chat Window
    const chatToggle = document.getElementById("user-chat-toggle");
    const chatWindow = document.getElementById("user-chat-window");
    const closeChat = document.getElementById("user-close-chat");
    const minimizeChat = document.getElementById("user-minimize-chat");
    const chatHeader = chatWindow.querySelector(".chat-header");

    // Extend session window
    let extendSessionWindow;
    let newSessionButton;
    let extendSessionButton;

    // Login window
    let chatLoginWindow;
    let loginForm;

    // Chat Dragging variables
    let isDragging = false, offsetX = 0, offsetY = 0;

    async function showChat() {
        // Open chat window
        chatWindow.style.display = "block";
        setTimeout(() => chatWindow.classList.add("show"), 10);
        chatToggle.style.display = "none";

        if (!state['is_first_time_chat_opened']) return;
        state['is_first_time_chat_opened'] = false;

        // Check session status
        const session = await checkSession();
        console.log(state);

        // Show window for the specific status
        switch (session.status) {
            case "login":
                console.log("Сессия отсутствует. Пожалуйста, войдите.");
                showLoginWindow();
                disableUserActions();
                break;
            case "success":
                console.log("Добро пожаловать! Продолжайте работу.");
                await fillStateWithUserData(getLatestDialog);
                enableUserActions();
                await loadMessages();
                break;
            case "expired":
                console.log("Сессия истекла.");
                showExtendSessionWindow();
                disableUserActions();
                break;
            case "error":
                alert(`Ошибка: ${session.message}`);
                break;
            default:
                console.error("Неизвестный статус:", session.status);
        }
    }

    function hideChat() {
        chatWindow.classList.remove("show");
        setTimeout(() => {
            chatWindow.style.display = "none";
            chatToggle.style.display = "block";
        }, 300);
    }

    function startDragging(e) {
        isDragging = true;
        offsetX = e.clientX - chatWindow.offsetLeft;
        offsetY = e.clientY - chatWindow.offsetTop;
        chatWindow.style.transition = "none";
    }

    function dragChat(e) {
        if (!isDragging) return;
        chatWindow.style.left = `${e.clientX - offsetX}px`;
        chatWindow.style.top = `${e.clientY - offsetY}px`;
    }

    function stopDragging() {
        isDragging = false;
        chatWindow.style.transition = "";
    }

    async function fillStateWithUserData(foo) {
        const sessionToken = localStorage.getItem("sessionToken");
        state["user_id"] = jwt_decode(sessionToken).user_id;
        await foo();
        const userData = await getUserDetails();
        state["username"] = `${userData.first_name} ${userData.last_name}`;
    }

    function showLoginWindow() {
        chatMessagesArea.innerHTML = '';
        const loginWrapper = document.createElement("div");
        loginWrapper.classList.add("chat-login-wrapper");
        loginWrapper.id = "chat-login-wrapper";
        loginWrapper.innerHTML = `
            <div class="chat-login small-window">
                <div class="chat-login-header" id="chat-login-header">Авторизация</div>
                <form class="chat-login-form" id="user-info-form">
                    <input type="hidden" name="csrfmiddlewaretoken" value="${csrfToken}">
                    <div class="form-group">
                        <label for="user-first-name" class="form-label">Имя</label>
                        <input type="text" id="user-first-name" name="first_name" class="form-control" placeholder="Введите ваше имя" required>
                    </div>
                    <div class="form-group">
                        <label for="user-last-name" class="form-label">Фамилия</label>
                        <input type="text" id="user-last-name" name="last_name" class="form-control" placeholder="Введите вашу фамилию" required>
                    </div>
                    <div class="form-group">
                        <label for="user-email" class="form-label">Электронная почта</label>
                        <input type="email" id="user-email" name="email" class="form-control" placeholder="Введите ваш email" required>
                    </div>
                    <button type="submit" class="btn btn-primary chat-login-submit">Продолжить</button>
                </form>
            </div>
        `;

        chatMessagesArea.appendChild(loginWrapper);

        const loginForm = document.getElementById("user-info-form");
        loginForm.addEventListener("submit", handleLogin);
    }

    async function handleLogin(event) {
        event.preventDefault();

        const form = event.target;
        const formData = new FormData(form);
        const jsonData = Object.fromEntries(formData.entries());
        console.log("Отправляемые данные:", jsonData);

        try {
            const response = await fetch("/api/chat-login/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X_CSRFTOKEN": csrfToken
                },
                body: JSON.stringify(jsonData),
            });

            // Проверяем статус ответа перед попыткой парсинга JSON
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
            }

            console.log(response);
//            console.log(await response.text());
            let result;
            try {
                const responseText = await response.text();
                result = JSON.parse(responseText.trim()); // Удаляем возможные пробелы в начале/конце
            } catch (parseError) {
                console.error("Ошибка парсинга JSON:", parseError);
                throw new Error("Неверный формат ответа от сервера");
            }

            console.log("Ответ сервера:", result);

            const sessionToken = result.session_token;
            if (!sessionToken) {
                throw new Error("Отсутствует session_token в ответе сервера");
            }

            localStorage.setItem("sessionToken", sessionToken);
            await fillStateWithUserData(createNewDialog);
            chatMessagesArea.innerHTML = '';
            await showGreetingMessages();
            enableUserActions();
        } catch (error) {
            console.error("Полная информация об ошибке:", {
                message: error.message,
                stack: error.stack
            });
            alert(`Ошибка авторизации: ${error.message}`);
        }
    }

    async function makeSessionActions() {
        await extendSession();
        chatMessagesArea.innerHTML = '';
        enableUserActions();
    }

    // Extend session function
    async function handleExtendSession() {
        await fillStateWithUserData(getLatestDialog);
        await makeSessionActions();
        await loadMessages();
    }

    // Create new session function
    async function handleNewSession() {
        await fillStateWithUserData(createNewDialog);
        await makeSessionActions();
        await showGreetingMessages();
    }

    function clearState() {
        state['dialog_id'] = null;
        state['user_id'] = null;
        state['username'] = null;
        state['started_at'] = null;
        state['is_first_time_chat_opened'] = true;
    }

    async function closeChatWindow() {
        await closeSession();
        hideChat();
        chatMessagesArea.innerHTML = '';
        clearState();
        hideMenu();
    }

    function showExtendSessionWindow() {
        chatMessagesArea.innerHTML = '';
        const extendWrapper = document.createElement("div");
        extendWrapper.classList.add("extend-session-wrapper");
        extendWrapper.id = "extend-session-wrapper";
        extendWrapper.innerHTML = `
            <div class="extend-session-window">
                <h5 class="extend-title" id="sessionExpiredModalLabel">
                    Ваша сессия истекла.<br>Желаете продолжить?
                </h5>
                <div class="extend-buttons">
                    <button type="button" class="btn btn-success" id="extend-session-btn">Продолжить сессию</button>
                    <button type="button" class="btn btn-secondary" id="new-session-btn">Создать новую сессию</button>
                </div>
            </div>
        `;

        chatMessagesArea.appendChild(extendWrapper);

        document.getElementById('extend-session-btn').addEventListener("click", handleExtendSession);
        document.getElementById('new-session-btn').addEventListener("click", handleNewSession);
    }

    // Event Listeners
    chatToggle.addEventListener("click", showChat);
    closeChat.addEventListener("click", closeChatWindow);
    minimizeChat.addEventListener("click", hideChat);
    chatHeader.addEventListener("mousedown", startDragging);
    document.addEventListener("mousemove", dragChat);
    document.addEventListener("mouseup", stopDragging);

    sendMessageButton.addEventListener('click', sendUserMessage);
    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendUserMessage();
        }
    });

    window.addEventListener("beforeunload", closeSession);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", chat_new);
} else {
    chat_new();
}
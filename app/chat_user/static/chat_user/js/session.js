async function checkSession() {
    const sessionToken = localStorage.getItem("sessionToken");
    console.log(`session token ${sessionToken}`)

    if (!sessionToken) {
        return { status: "login", message: "Сессия отсутствует" };
    }

    try {
        const response = await fetch("/api/check-session/", {
            method: "GET",
            headers: {
                "Authorization": sessionToken,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Ошибка сессии:", errorData.message);
            return { status: "error", message: errorData.message || "Неизвестная ошибка" };
        }

        const data = await response.json();

        if (data.status === "success") {
            userID = data["user_id"];
            console.log(`success`)
            return { status: "success", data };
        } else if (data.status === "expired") {
            console.log(`expired`)
            return { status: "expired", message: data.message };
        } else if (data.status === "login") {
            console.log(`login`)
            return { status: "login", message: data.message };
        } else {
            console.warn("Неизвестный статус ответа:", data);
            return { status: "unknown", message: "Неизвестный ответ от сервера" };
        }
    } catch (error) {
        console.error("Ошибка при запросе:", error);
        return { status: "error", message: "Ошибка при проверке сессии" };
    }
}

async function extendSession() {
    const sessionToken = localStorage.getItem("sessionToken");
    if (!sessionToken) {
        console.log("No session token found.");
        return;
    }

    try {
        const response = await fetch("/api/extend-session/", {
            method: "POST",
            headers: {
                "Authorization": sessionToken,
                "Content-Type": "application/json"
            },
        });

        const data = await response.json();
        if (response.ok) {
            console.log("Session extended:", data);
            localStorage.setItem("sessionToken", sessionToken);
        } else {
            console.log("Failed to extend session:", data.message);
        }
    } catch (error) {
        console.error("Error extending session:", error);
    }
}

async function closeSession() {
    const sessionToken = localStorage.getItem("sessionToken");
    if (!sessionToken) {
        console.log("No session token found.");
        return { status: "error", message: "Токен сессии не найден." };
    }

    try {
        const response = await fetch("/api/close-session/", {
            method: "POST",
            headers: {
                "Authorization": sessionToken,
                "Content-Type": "application/json",
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Ошибка сессии:", errorData.message);
            return { status: "error", message: errorData.message || "Неизвестная ошибка" };
        }

        console.log("Сессия закрыта успешно.");
        return { status: "success", message: "Сессия закрыта." };

    } catch (error) {
        console.error("Ошибка закрытия сессии:", error);
        return { status: "error", message: "Ошибка сети или сервера." };
    } finally {
        chatMessagesArea.innerHTML = '';
    }
}
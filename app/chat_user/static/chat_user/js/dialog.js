// CSRF Token
const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

const createNewDialog = async () => {
    try {

        const response = await fetch(`/api/dialogs/create/${state["user_id"]}/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
        });

        const data = await response.json();

        if (response.ok) {
            console.log("Новый диалог создан:", data);
            state["dialog_id"] = data.dialog_id;
        } else {
            console.warn("Ошибка при создании диалога:", data.message);
            return null;
        }
    } catch (error) {
        console.error("Ошибка при запросе:", error);
        return null;
    }
}

async function getLatestDialog() {
    try {
        const response = await fetch(`/api/dialogs/latest/${state['user_id']}/`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();

        if (response.ok) {
            console.log("Самый новый диалог:", data);
            state['dialog_id'] = data.dialog_id;
        } else {
            console.warn("Ошибка при получении диалога:", data.message);
            return null;
        }
    } catch (error) {
        console.error("Ошибка при запросе:", error);
        return null;
    }
}
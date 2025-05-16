const createNewDialog = async () => {
    try {
        console.log(`Create new dialog for user ${state["user_id"]}`);
        const response = await fetch(`/api/dialogs/create/${state["user_id"]}/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();

        if (response.ok) {
            state["dialog_id"] = data.dialog_id;
        } else {
            return null;
        }
    } catch (error) {
        console.log(error);
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
            state['dialog_id'] = data.dialog_id;
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
}
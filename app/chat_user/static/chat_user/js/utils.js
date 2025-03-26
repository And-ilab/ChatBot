const chatMessagesArea = document.getElementById("user-chat-messages-area");
const chatInput = document.getElementById("user-chat-input");
const sendMessageButton = document.getElementById("user-send-message");

const getUserDetails = async () => {
    try {
        const response = await apiFetch(`/api/user/${state["user_id"]}/`);
        if (!response.ok) throw new Error("User not found");

        const data = await response.json();
        return data.user;
    } catch (error) {
        console.error("Error fetching user details:", error);
    }
};

const getTimestamp = () => {
    const now = new Date();
    const timestamp = now.toISOString();
    const timezoneOffset = now.getTimezoneOffset() / -60;
    const timezone = timezoneOffset >= 0
        ? `+${String(timezoneOffset).padStart(2, '0')}`
        : `-${String(-timezoneOffset).padStart(2, '0')}`;
    return `${timestamp.replace('T', ' ').slice(0, -1)}${timezone}`;
};

const formatDate = (date) => {
    const [year, month, day] = date.split('-');
    const months = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return `${day} ${months[parseInt(month) - 1]} ${year}`;
};

const scrollToBottom = () => {
    chatMessagesArea.scrollTo({
        top: chatMessagesArea.scrollHeight,
        behavior: 'smooth'
    });
};

function disableUserActions() {
    if (chatInput && sendMessageButton) {
        chatInput.disabled = true;
        sendMessageButton.disabled = true;
    }
}

function enableUserActions() {
    if (chatInput && sendMessageButton) {
        chatInput.disabled = false;
        sendMessageButton.disabled = false;
    }
}
import { useHttp } from "../hooks/http.hook";
import { MessageInput } from "../interfaces/interfaces";


const useChatService = () => {
    const { request, process, setProcess, clearError } = useHttp();
    const _apiBase = "http://127.0.0.1:8000";

    const getDialogMessages = async (userID: number): Promise<{ messages: MessageInput[] }> => {
        return await request(`${_apiBase}/dialogs/${userID}/messages`, 'GET');
    };

    const sendMessage = async (userID: number, messageInput: MessageInput): Promise<void> => {
        await request(`${_apiBase}/dialogs/${userID}/messages`, 'POST', JSON.stringify(messageInput));
    };

    return { getDialogMessages, sendMessage, process, setProcess, clearError };
};

export default useChatService;
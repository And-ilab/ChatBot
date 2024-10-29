import { useHttp } from "../hooks/http.hook";


const useChatService = () => {
    const { request } = useHttp();
    const _apiBase = "https://localhost:8000";

    // const getAllDialogs = async (userID: string): Promise<Dialog[]> => {
    //     const res = await request(`${_apiBase}/dialogs?userId=${userID}`);
    //     return res;
    // };

    // return { getAllDialogs };
};

export default useChatService;
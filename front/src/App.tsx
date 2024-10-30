import { useEffect, useState } from "react";
import ChatArea from "./components/ChatArea";
import ChatInput from "./components/ChatInput";
import useChatService from "./services/ChatService";
import { MessageInput } from "./interfaces/interfaces";
import LoginForm from "./components/LoginForm/LoginForm";
import './App.css'


function App() {
  const [messages, setMessages] = useState<MessageInput[]>([]);
  const { getDialogMessages } = useChatService();

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await getDialogMessages(1);
        const data = response["messages"]
        setMessages(data);
      } catch (e) {
        console.error("Ошибка загрузки сообщений:", e);
      }
    };

    fetchMessages();
  }, []);

  const handleNewMessage = (newMessage: MessageInput) => {
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  };

  return (
    <div className='flex h-full justify-center items-center'>
      <div className="flex h-full w-full justify-center">
        <ChatArea messages={messages} />
        <ChatInput onNewMessage={handleNewMessage} />
      </div>
      {/* <LoginForm /> */}
    </div>
  );
}

export default App;
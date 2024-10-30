import UserMessage from "./UserMessage";
import BotMessage from "./BotMessage";
import { ChatAreaProps } from "../interfaces/interfaces";


const ChatArea = ({ messages }: ChatAreaProps) => {
  return (
    <div className="w-full px-[250px] py-[40px] h-[700px] flex flex-col items-center overflow-y-auto">
      {messages.map((message, index) =>
        message.sender === "user" ? (
          <UserMessage key={index} content={message.content} />
        ) : (
          <BotMessage key={index} content={message.content} />
        )
      )}
    </div>
  );
};

export default ChatArea;
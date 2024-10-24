import UserMessage from "./UserMessage"
import BotMessage from "./BotMessage"

const ChatArea = () => {
  return (
    <div className="py-[30px] px-[200px] w-full min-h-[753px] flex flex-col items-center overflow-y-auto">
        <UserMessage />
        <BotMessage />
    </div>
  )
}

export default ChatArea
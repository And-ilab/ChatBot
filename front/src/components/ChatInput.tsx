import send from '../assets/send_message_icon.svg'
import { useState } from 'react'

const ChatInput = () => {
    const [message, setMessage] = useState('');

    const handleSendMessage = () => {
        if (message.trim()) {
            console.log(message)
            setMessage('')
        }
    }

    return (
        <div className="flex items-center pl-[24px] w-[640px] min-h-[52px] absolute bg-chat-input rounded-[24px] bottom-[20px]">
            <div className="bg-white w-[560px] flex items-center">
                <textarea id="message" name="message" placeholder="Введите сообщение" className='resize-none flex bg-chat-input outline-none h-[24px] w-full text-clip' value={message} onChange={(e) => setMessage(e.target.value)}/>
            </div>
            <button className={`absolute right-[8px] bottom-[8px] w-[36px] h-[36px] ${!message ? 'bg-not-send-btn-bg cursor-not-allowed' : 'bg-send-btn-bg hover:bg-white'} rounded-full flex items-center justify-center font-bold text-2xl transition duration-900 ease-in-out`}
            onClick={handleSendMessage}>
                <img src={send} alt="send-icon"/>
            </button>
        </div>
    )
}

export default ChatInput
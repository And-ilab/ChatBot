import './App.css'
import ChatArea from './components/ChatArea'
import ChatInput from './components/ChatInput'
import Navbar from './components/Navbar'

function App() {

  return (
    <div className='flex h-full w-full'>
      <Navbar />
      <div className="flex-1 flex flex-row px-[70px] justify-center items-start">
        <ChatArea/>
        <ChatInput />
      </div>
    </div>
  )
}

export default App

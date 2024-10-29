import './App.css'
// import LoginForm from './components/LoginForm/LoginForm'
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
      {/* <div className='h-full w-full flex justify-center items-center'>
        <LoginForm />
      </div> */}
    </div>
  )
}

export default App

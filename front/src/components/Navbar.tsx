import { useState, useEffect } from "react";
import useChatService from "../services/ChatService";

const Navbar = ({ userId }: { userId: number }) => {
    const [dialogs, setDialogs] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const { getAllDialogs } = useChatService();

    useEffect(() => {
        const fetchDialogs = async () => {
            try {
                const data = await getAllDialogs(1);
                const dialogTitles = Object.keys(data.dialogs);
                setDialogs(dialogTitles);
            } catch (e) {
                console.error("Ошибка загрузки диалогов:", e);
            }
        };

        fetchDialogs();
    }, []); // Пустой массив зависимостей, чтобы загрузка происходила один раз

    const handleClick = (index: number) => {
        setActiveIndex(index);
    };

    return (
        <nav className="w-[260px] h-full bg-nav-bg py-[40px]">
            <ul>
                {dialogs.map((dialog, index) => (
                    <li key={index}>
                        <button
                            className={`p-[8px] w-full rounded-lg ${
                                activeIndex === index ? 'bg-custom-gray' : 'hover:bg-custom-gray'
                            } transition duration-400 ease-in-out flex justify-center`}
                            onClick={() => handleClick(index)}
                        >
                            Диалог {dialog}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default Navbar;

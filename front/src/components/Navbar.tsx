import { useState } from "react"

const fakeItems = [
    'Тест 1',
    'Тест 2',
    'Тест 3',
    'Тест 4',
    'Тест 5',
]


const Navbar = () => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const handleClick = (index: number) => {
        setActiveIndex(index);
    };

    return (
        <nav className="w-[260px] h-full bg-nav-bg">
            <ul>
                {fakeItems.map((item, index) => (
                    <li key={index}>
                        <button className={`p-[8px] w-full rounded-lg ${activeIndex === index ? 'bg-custom-gray' : 'hover:bg-custom-gray'} transition duration-400 ease-in-out flex justify-center`}
                        onClick={() => handleClick(index)}>
                            {item}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    )
}

export default Navbar
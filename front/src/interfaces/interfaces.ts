export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestOptions {
    method?: RequestMethod;
    body?: BodyInit | null;
    headers?: HeadersInit;
}

export interface UseHttpReturn {
    request: (url: string, method?: RequestMethod, body?: BodyInit | null, headers?: HeadersInit) => Promise<any>;
    clearError: () => void;
    process: string;
    setProcess: React.Dispatch<React.SetStateAction<string>>;
}

export interface UserMessageProps {
    content: string;
}

export interface BotMessageProps {
    content: string;
}

export interface MessageInput {
    sender: 'user' | 'bot';
    content: string;
}

export interface ChatAreaProps {
    messages: MessageInput[];
}
import { useState, useCallback } from "react";

import { RequestMethod, UseHttpReturn } from "../interfaces";



export const useHttp = (): UseHttpReturn => {
    const [process, setProcess] = useState<string>('waiting');

    const request = useCallback(async (url: string, method: RequestMethod = 'GET', body: BodyInit | null = null, headers: HeadersInit = {'Content-Type': 'application/json'}): Promise<any> => {
        setProcess('loading');

        try {
            const response = await fetch(url, { method, body, headers });

            if (!response.ok) {
                throw new Error(`Could not fetch ${url}, status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (e) {
            setProcess('error');
            throw e;
        }
    }, []);

    const clearError = useCallback(() => {
        setProcess('waiting');
    }, []);

    return { request, clearError, process, setProcess };
};
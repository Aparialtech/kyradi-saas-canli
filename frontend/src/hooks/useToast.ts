import { useCallback, useEffect, useState } from "react";

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: "info" | "success" | "error";
}

export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => {
      setMessages((current) => current.slice(1));
    }, 3500);
    return () => clearTimeout(timer);
  }, [messages]);

  const push = useCallback(
    (message: Omit<ToastMessage, "id">) => {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), type: "info", ...message },
      ]);
    },
    [setMessages],
  );

  return { messages, push };
}

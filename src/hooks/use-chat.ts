import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/axios";

interface ChatPayload {
  botId: string;
  prompt: string;
  preview: boolean;
  history: { role: string; text: string }[];
}

interface ChatResponse {
  success: boolean;
  message?: string;
  data?: {
    text: string;
  };
}

export function useSendMessage() {
  return useMutation({
    mutationFn: async (payload: ChatPayload) => {
      try {
        const { data } = await apiClient.post("/api/chat", payload);
        return data as ChatResponse;
      } catch (error: unknown) {
        const responseData = (error as { response?: { data?: ChatResponse } })?.response?.data;
        if (responseData) return responseData;
        throw error;
      }
    },
  });
}

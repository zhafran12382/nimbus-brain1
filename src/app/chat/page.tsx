"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatMessage } from "@/types";
import { supabase } from "@/lib/supabase";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import { sendChatStream } from "@/lib/chat-stream";
import { Header } from "@/components/layout/header";
import { ChatContainer } from "@/components/chat/chat-container";
import { ModelSelector } from "@/components/chat/model-selector";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [pendingToolCalls, setPendingToolCalls] = useState<{ name?: string; result?: string }[]>([]);

  // Load messages from DB
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(50);
      if (data) setMessages(data as ChatMessage[]);
    };
    loadMessages();
  }, []);

  const handleSend = useCallback(async (content: string) => {
    // Create optimistic user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setStreamStatus(null);
    setPendingToolCalls([]);

    // Save user message to DB
    await supabase.from("chat_messages").insert({
      role: "user",
      content,
    });

    try {
      const chatHistory = newMessages.map(m => ({ role: m.role, content: m.content }));
      let finalContent = '';
      let finalToolCalls: { name: string; args: Record<string, unknown>; result: string }[] = [];
      let finalModelUsed = '';

      await sendChatStream(chatHistory, DEFAULT_MODEL_ID, (event) => {
        switch (event.type) {
          case 'status':
            setStreamStatus(event.message || null);
            break;

          case 'tool_start':
            setStreamStatus(event.message || `🔧 ${event.name}...`);
            break;

          case 'tool_result':
            setPendingToolCalls(prev => [...prev, {
              name: event.name,
              result: event.result,
            }]);
            break;

          case 'done':
            finalContent = event.content || '';
            finalToolCalls = event.tool_calls || [];
            finalModelUsed = event.model_used || DEFAULT_MODEL_ID;
            break;

          case 'error':
            throw new Error(event.message);
        }
      });

      // Add assistant message to state
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: finalContent,
        tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
        model_used: finalModelUsed,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Save to Supabase
      await supabase.from("chat_messages").insert({
        role: "assistant",
        content: finalContent,
        tool_calls: finalToolCalls.length > 0 ? finalToolCalls : null,
        model_used: finalModelUsed,
      });

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Error: ${message}`,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setStreamStatus(null);
      setPendingToolCalls([]);
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen">
      <Header title="💬 Chat" onMenuClick={() => setSidebarOpen(!sidebarOpen)}>
        <ModelSelector />
      </Header>
      <ChatContainer
        messages={messages}
        onSend={handleSend}
        isLoading={isLoading}
        streamStatus={streamStatus}
        pendingToolCalls={pendingToolCalls}
      />
    </div>
  );
}

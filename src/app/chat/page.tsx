"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatMessage } from "@/types";
import { supabase } from "@/lib/supabase";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import { Header } from "@/components/layout/header";
import { ChatContainer } from "@/components/chat/chat-container";
import { ModelSelector } from "@/components/chat/model-selector";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Save user message to DB
    await supabase.from("chat_messages").insert({
      role: "user",
      content,
    });

    try {
      // Build message history for API
      const apiMessages = [...messages, userMessage].slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          model: DEFAULT_MODEL_ID,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ Error: ${data.error || "Terjadi kesalahan"}`,
          model_used: DEFAULT_MODEL_ID,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
        tool_calls: data.tool_calls,
        model_used: data.model_used,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message to DB
      await supabase.from("chat_messages").insert({
        role: "assistant",
        content: data.content,
        tool_calls: data.tool_calls || null,
        model_used: data.model_used,
      });
    } catch {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "❌ Gagal menghubungi server. Coba lagi nanti.",
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
      />
    </div>
  );
}

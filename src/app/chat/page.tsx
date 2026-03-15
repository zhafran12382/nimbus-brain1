"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatMessage } from "@/types";
import { PersonalitySettings } from "@/types";
import { supabase } from "@/lib/supabase";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import { sendChatStream } from "@/lib/chat-stream";
import { Header } from "@/components/layout/header";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatHistory } from "@/components/chat/chat-history";
import { ModelSelector } from "@/components/chat/model-selector";
import { History } from "lucide-react";

const ACTIVE_CONV_KEY = "nimbus-active-conv";
const PERSONALITY_KEY = "nimbus-brain-personality";

function getStoredConvId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_CONV_KEY);
}

function getPersonality(): PersonalitySettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PERSONALITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [pendingToolCalls, setPendingToolCalls] = useState<{ name?: string; result?: string }[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialized, setInitialized] = useState(false);

  // Restore activeConversationId from localStorage on mount
  useEffect(() => {
    const stored = getStoredConvId();
    if (stored) {
      setActiveConversationId(stored);
    }
    setInitialized(true);
  }, []);

  // Persist activeConversationId to localStorage
  useEffect(() => {
    if (!initialized) return;
    if (activeConversationId) {
      localStorage.setItem(ACTIVE_CONV_KEY, activeConversationId);
    } else {
      localStorage.removeItem(ACTIVE_CONV_KEY);
    }
  }, [activeConversationId, initialized]);

  // Load messages for the active conversation
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeConversationId) {
        setMessages([]);
        return;
      }
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data) setMessages((data as ChatMessage[]).filter(m => m.content && m.content.trim() !== ''));
    };
    loadMessages();
  }, [activeConversationId]);

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  const handleSend = useCallback(async (content: string) => {
    let conversationId = activeConversationId;

    // Auto-create conversation if none selected
    if (!conversationId) {
      const title = content.slice(0, 35) + (content.length > 35 ? "..." : "");
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({ title })
        .select()
        .single();
      if (newConv) {
        conversationId = newConv.id;
        setActiveConversationId(newConv.id);
        setRefreshKey((k) => k + 1);
      }
    }

    // Create optimistic user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      conversation_id: conversationId || undefined,
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
      conversation_id: conversationId,
    });

    try {
      const chatHistory = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      let finalContent = "";
      let finalToolCalls: {
        name: string;
        args: Record<string, unknown>;
        result: string;
      }[] = [];
      let finalModelUsed = "";

      const personality = getPersonality();

      await sendChatStream(chatHistory, DEFAULT_MODEL_ID, (event) => {
        switch (event.type) {
          case "status":
            setStreamStatus(event.message || null);
            break;

          case "tool_start":
            if (event.name === "web_search") {
              setStreamStatus("🔍 Searching the web...");
            } else {
              setStreamStatus(event.message || `🔧 ${event.name}...`);
            }
            break;

          case "tool_result":
            setPendingToolCalls((prev) => [
              ...prev,
              { name: event.name, result: event.result },
            ]);
            break;

          case "done":
            finalContent = event.content || "";
            finalToolCalls = event.tool_calls || [];
            finalModelUsed = event.model_used || DEFAULT_MODEL_ID;
            break;

          case "error":
            throw new Error(event.message);
        }
      }, personality ? (personality as unknown as Record<string, string>) : undefined);

      // Only add assistant message if there's actual content or tool calls
      if (finalContent.trim() || finalToolCalls.length > 0) {
        const messageContent = finalContent.trim()
          ? finalContent
          : (finalToolCalls.length > 0 ? "(Aksi selesai)" : "⚠️ Model tidak menghasilkan respons. Coba kirim ulang.");
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          conversation_id: conversationId || undefined,
          role: "assistant",
          content: messageContent,
          tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
          model_used: finalModelUsed,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Save to Supabase
        await supabase.from("chat_messages").insert({
          role: "assistant",
          content: messageContent,
          tool_calls: finalToolCalls.length > 0 ? finalToolCalls : null,
          model_used: finalModelUsed,
          conversation_id: conversationId,
        });
      }

      // Update conversation timestamp
      if (conversationId) {
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
        setRefreshKey((k) => k + 1);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan.";
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Error: ${message}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setStreamStatus(null);
      setPendingToolCalls([]);
    }
  }, [messages, activeConversationId]);

  return (
    <div className="flex h-[100dvh] sm:h-screen">
      {/* Chat History Sidebar */}
      <ChatHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewChat={handleNewChat}
        refreshKey={refreshKey}
      />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          title="💬 Chat"
          onMenuClick={() => setHistoryOpen(!historyOpen)}
        >
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-colors"
            title="Chat History"
          >
            <History className="h-4 w-4" />
          </button>
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
    </div>
  );
}

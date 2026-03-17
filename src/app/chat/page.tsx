"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatMessage, GroqRateLimit, ProviderId } from "@/types";
import { ChatMode } from "@/types";
import { PersonalitySettings } from "@/types";
import { supabase } from "@/lib/supabase";
import { sendChatStream } from "@/lib/chat-stream";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatSidebar } from "@/components/layout/chat-sidebar";
import { RouterSelector } from "@/components/chat/router-selector";
import { AssistantMessageState, getToolDisplay } from "@/components/chat/assistant-message";
import { Menu, Settings } from "lucide-react";
import { useModelSelection } from "@/hooks/useModelSelection";

const ACTIVE_CONV_KEY = "nimbus-active-conv";
const PERSONALITY_KEY = "nimbus-brain-personality";
const MODE_KEY = "nimbus-brain-chat-mode";

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

function getStoredMode(): ChatMode {
  if (typeof window === "undefined") return "flash";
  const stored = localStorage.getItem(MODE_KEY);
  if (stored === "search" || stored === "think" || stored === "flash") return stored;
  return "flash";
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [streamingState, setStreamingState] = useState<AssistantMessageState | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("flash");
  const [groqRateLimit, setGroqRateLimit] = useState<GroqRateLimit | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { providerId, modelId, switchProvider, switchModel } = useModelSelection();

  // Restore state from localStorage on mount
  useEffect(() => {
    const stored = getStoredConvId();
    if (stored) setActiveConversationId(stored);
    setChatMode(getStoredMode());
    // On mobile, start with sidebar closed
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
    setInitialized(true);
  }, []);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
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

  const handleModeChange = useCallback((mode: ChatMode) => {
    setChatMode(mode);
    localStorage.setItem(MODE_KEY, mode);
  }, []);

  const handleProviderChange = useCallback((id: ProviderId) => {
    if (id !== "groq") {
      setGroqRateLimit(null);
    }
    switchProvider(id);
  }, [switchProvider]);

  const handleSend = useCallback(async (content: string) => {
    const conversationId = activeConversationId;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setStreamingState(null);

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

    const initialStreamState: AssistantMessageState = {
      phase: "thinking",
      toolStatus: null,
      toolHistory: [],
      content: "",
      modelUsed: "",
    };
    setStreamingState(initialStreamState);

    const controller = new AbortController();
    abortControllerRef.current = controller;

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
      let finalProviderUsed = providerId;
      let returnedConvId = conversationId;

      const personality = getPersonality();

      await sendChatStream(
        chatHistory,
        modelId,
        (event) => {
          switch (event.type) {
            case "status":
              setStreamingState((prev) =>
                prev ? { ...prev, phase: "thinking" } : null
              );
              break;

            case "tool_start": {
              const display = getToolDisplay(event.name || "", "start");
              const toolStatus = {
                name: event.name || "",
                icon: display.icon,
                text: display.text,
                args: event.args,
              };
              setStreamingState((prev) =>
                prev
                  ? { ...prev, phase: "tool_executing", toolStatus }
                  : null
              );
              break;
            }

            case "tool_result": {
              const resultDisplay = getToolDisplay(event.name || "", "result");
              const completedTool = {
                name: event.name || "",
                icon: resultDisplay.icon,
                text: resultDisplay.text,
                result: event.result,
              };
              setStreamingState((prev) =>
                prev
                  ? {
                      ...prev,
                      toolStatus: completedTool,
                      toolHistory: [...prev.toolHistory, completedTool],
                    }
                  : null
              );
              break;
            }

            case "chunk":
              setStreamingState((prev) =>
                prev
                  ? { ...prev, phase: "streaming", content: event.content || "" }
                  : null
              );
              break;

            case "done":
              finalContent = event.content || "";
              finalToolCalls = event.tool_calls || [];
              finalModelUsed = event.model_used || modelId;
              if (event.provider_used) finalProviderUsed = event.provider_used as typeof providerId;
              if (event.conversationId) {
                returnedConvId = event.conversationId;
              }
              break;

            case "rate_limit":
              setGroqRateLimit(event.rate_limit || null);
              break;

            case "error":
              throw new Error(event.message);
          }
        },
        personality ? (personality as unknown as Record<string, string>) : undefined,
        conversationId,
        controller.signal,
        chatMode,
        providerId,
      );

      if (controller.signal.aborted) return;

      if (returnedConvId && returnedConvId !== activeConversationId) {
        setActiveConversationId(returnedConvId);
        setRefreshKey((k) => k + 1);
      }

      if (finalContent.trim() || finalToolCalls.length > 0) {
        const messageContent = finalContent.trim()
          ? finalContent
          : finalToolCalls.length > 0
            ? "(Aksi selesai)"
            : "⚠️ Model tidak menghasilkan respons. Coba kirim ulang.";
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          conversation_id: returnedConvId || undefined,
          role: "assistant",
          content: messageContent,
          tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
          model_used: finalModelUsed,
          provider_used: finalProviderUsed,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      if (returnedConvId) {
        setRefreshKey((k) => k + 1);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan.";
      const isProviderWarning = message.startsWith('⚠️');
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: isProviderWarning ? message : `❌ Error: ${message}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setStreamingState(null);
      abortControllerRef.current = null;
    }
  }, [messages, activeConversationId, chatMode, modelId, providerId]);

  return (
    <div className="flex h-[100dvh] sm:h-screen">
      {/* Left: ChatSidebar (Area X + Y) */}
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewChat={handleNewChat}
        refreshKey={refreshKey}
      />

      {/* Right: Main Chat Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header with Area A (Router) */}
        <header className="flex h-14 items-center gap-3 px-3 sm:px-4 border-b border-[hsl(0_0%_100%_/_0.04)] glass">
          {/* Hamburger (mobile + sidebar toggle) */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Area A: Router Selector */}
          <RouterSelector
            providerId={providerId}
            onProviderChange={handleProviderChange}
          />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Settings (optional) */}
          <button
            onClick={() => {
              /* Could open settings panel — currently handled by AppShell */
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </header>

        {/* Chat Container */}
        <ChatContainer
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
          streamingState={streamingState}
          mode={chatMode}
          onModeChange={handleModeChange}
          providerId={providerId}
          modelId={modelId}
          onProviderChange={handleProviderChange}
          onModelChange={switchModel}
          groqRateLimit={groqRateLimit}
        />
      </div>
    </div>
  );
}

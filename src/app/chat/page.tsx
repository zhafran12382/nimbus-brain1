"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatMessage } from "@/types";
import { ChatMode } from "@/types";
import { PersonalitySettings } from "@/types";
import { supabase } from "@/lib/supabase";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import { sendChatStream } from "@/lib/chat-stream";
import { Header } from "@/components/layout/header";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatHistory } from "@/components/chat/chat-history";
import { ModelSelector } from "@/components/chat/model-selector";
import { AssistantMessageState, getToolDisplay } from "@/components/chat/assistant-message";
import { History } from "lucide-react";

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [streamingState, setStreamingState] = useState<AssistantMessageState | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("flash");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Restore activeConversationId and chatMode from localStorage on mount
  useEffect(() => {
    const stored = getStoredConvId();
    if (stored) {
      setActiveConversationId(stored);
    }
    setChatMode(getStoredMode());
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

  const handleSend = useCallback(async (content: string) => {
    const conversationId = activeConversationId;

    // 1. Abort any in-flight request from a previous send
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 2. Reset streaming state before starting new request
    setStreamingState(null);

    // Create optimistic user message (display immediately)
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

    // Initialize streaming state for Perplexity-style animation
    const initialStreamState: AssistantMessageState = {
      phase: "thinking",
      toolStatus: null,
      toolHistory: [],
      content: "",
      modelUsed: "",
    };
    setStreamingState(initialStreamState);

    // AbortController for cleanup
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
      let returnedConvId = conversationId;

      const personality = getPersonality();

      await sendChatStream(
        chatHistory,
        DEFAULT_MODEL_ID,
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
              finalModelUsed = event.model_used || DEFAULT_MODEL_ID;
              if (event.conversationId) {
                returnedConvId = event.conversationId;
              }
              break;

            case "error":
              throw new Error(event.message);
          }
        },
        personality ? (personality as unknown as Record<string, string>) : undefined,
        conversationId,
        controller.signal,
        chatMode,
      );

      // Skip adding assistant message if this request was aborted by a newer one
      if (controller.signal.aborted) return;

      // Update conversationId if server created one
      if (returnedConvId && returnedConvId !== activeConversationId) {
        setActiveConversationId(returnedConvId);
        setRefreshKey((k) => k + 1);
      }

      // Add assistant message to local messages (already saved server-side)
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
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      // Refresh sidebar
      if (returnedConvId) {
        setRefreshKey((k) => k + 1);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // Aborted because user sent a new message or navigated away — not an error
        return;
      }
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
      setStreamingState(null);
      abortControllerRef.current = null;
    }
  }, [messages, activeConversationId, chatMode]);

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
          streamingState={streamingState}
          mode={chatMode}
          onModeChange={handleModeChange}
        />
      </div>
    </div>
  );
}

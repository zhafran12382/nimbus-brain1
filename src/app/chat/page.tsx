"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatMessage, ProviderId } from "@/types";
import { ChatMode } from "@/types";
import { PersonalitySettings } from "@/types";
import { supabase } from "@/lib/supabase";
import { sendChatStream } from "@/lib/chat-stream";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatSidebar } from "@/components/layout/chat-sidebar";
import { RouterSelector } from "@/components/chat/router-selector";
import { AssistantMessageState, getToolDisplay } from "@/components/chat/assistant-message";
import { Menu, LogOut } from "lucide-react";
import { useModelSelection } from "@/hooks/useModelSelection";
import { useLockedIn } from "@/components/study/locked-in-context";
import { useRouter } from "next/navigation";

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

function ChatPageContent() {
  const router = useRouter();
  const { setDialogOpen } = useLockedIn();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [streamingState, setStreamingState] = useState<AssistantMessageState | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("flash");
  const [tpmWarning, setTpmWarning] = useState<string | null>(null);
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
      setTpmWarning(null);
    }
    switchProvider(id);
  }, [switchProvider]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      // Force redirect even if API fails
      router.push("/login");
    }
  }, [router]);

  const handleImageGenerate = useCallback(async (prompt: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: `🎨 Generate image: ${prompt}`,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Image generation failed.");
      }

      const imageContent = data.is_base64
        ? `![Generated Image](data:image/png;base64,${data.image_url})`
        : `![Generated Image](${data.image_url})`;

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `${imageContent}\n\n*Prompt: "${data.prompt}"*`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Image generation failed.";
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Image generation error: ${message}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      thinkingContent: "",
      thinkingDurationMs: 0,
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
              setStreamingState((prev) => {
                if (!prev) return null;
                return { ...prev, phase: "thinking" };
              });
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
              setStreamingState((prev) => {
                if (!prev) return null;
                // Mark all in-progress steps as completed when content starts streaming
                const updatedHistory = prev.toolHistory.map(t => ({
                  ...t,
                  result: t.result || "done"
                }));
                return { 
                  ...prev, 
                  phase: "streaming" as const, 
                  content: event.content || "", 
                  toolHistory: updatedHistory 
                };
              });
              break;

            case "thinking":
              setStreamingState((prev) =>
                prev
                  ? {
                      ...prev,
                      phase: "thinking",
                      thinkingContent: event.thinking_content ?? prev.thinkingContent,
                      thinkingDurationMs: event.thinking_duration_ms ?? prev.thinkingDurationMs,
                    }
                  : null
              );
              break;

            case "done":
              finalContent = event.content || "";
              finalToolCalls = event.tool_calls || [];
              finalModelUsed = event.model_used || modelId;
              // Set phase to "complete" so content renders and pipeline hides
              setStreamingState((prev) => {
                if (!prev) return null;
                const updatedHistory = prev.toolHistory.map(t => ({
                  ...t,
                  result: t.result || "done"
                }));
                return {
                  ...prev,
                  phase: "complete" as const,
                  content: event.content || prev.content,
                  modelUsed: event.model_used || modelId,
                  completedAt: new Date().toISOString(),
                  toolHistory: updatedHistory,
                  thinkingContent: event.thinking_content ?? prev.thinkingContent,
                  thinkingDurationMs: event.thinking_duration_ms ?? prev.thinkingDurationMs,
                };
              });
              if (event.provider_used) finalProviderUsed = event.provider_used as typeof providerId;
              if (event.conversationId) {
                returnedConvId = event.conversationId;
              }
              break;

            case "rate_limit":
              if ((event.rate_limit?.remainingTokens ?? 1) <= 0) {
                const resetInfo = event.rate_limit?.resetTokens || event.rate_limit?.resetRequests;
                setTpmWarning(
                  resetInfo
                    ? `⚠️ TPM AI telah habis. Coba lagi setelah reset (${resetInfo}).`
                    : "⚠️ TPM AI telah habis. Tunggu beberapa saat lalu coba lagi."
                );
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
        providerId,
      );

      if (controller.signal.aborted) return;

      if (returnedConvId && returnedConvId !== activeConversationId) {
        setActiveConversationId(returnedConvId);
        setRefreshKey((k) => k + 1);
      }

      // Build the persisted message
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
        // Clear streaming state and add persisted message in the same batch
        // This prevents a flash where neither is visible
        setStreamingState(null);
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setStreamingState(null);
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
      setStreamingState(null);
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      // Streaming state is already cleared in try/catch blocks above
      // Only clear here as safety net if not already cleared
      setStreamingState((prev) => prev ? null : prev);
      abortControllerRef.current = null;
    }
  }, [messages, activeConversationId, chatMode, modelId, providerId]);

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden">
      {/* Left: ChatSidebar (Area X + Y) */}
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewChat={handleNewChat}
        refreshKey={refreshKey}
        onOpenLockedIn={() => setDialogOpen(true)}
      />

      {/* Right: Main Chat Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header with Area A (Router) */}
        <header className="relative z-20 flex h-14 min-w-0 items-center gap-2 border-b border-[hsl(0_0%_100%_/_0.04)] px-2.5 sm:gap-3 sm:px-4 glass">
          {/* Hamburger (mobile + sidebar toggle) */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-colors"
            style={{ minWidth: "44px", minHeight: "44px" }}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Area A: Router Selector */}
          <RouterSelector
            providerId={providerId}
            onProviderChange={handleProviderChange}
          />

          {/* Spacer */}
          <div className="min-w-0 flex-1" />

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Logout"
            style={{ minWidth: "44px", minHeight: "44px" }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {tpmWarning && (
          <div className="mx-3 sm:mx-4 mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-2">
            <span>{tpmWarning}</span>
            <button
              type="button"
              onClick={() => setTpmWarning(null)}
              className="shrink-0 rounded px-2 py-0.5 text-[11px] text-amber-100/90 hover:bg-amber-500/20"
              style={{ minHeight: "40px", minWidth: "40px" }}
            >
              Tutup
            </button>
          </div>
        )}

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
          onImageGenerate={handleImageGenerate}
        />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return <ChatPageContent />;
}

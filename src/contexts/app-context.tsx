"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useModelSelection } from "@/hooks/useModelSelection";
import type { ProviderId, AIModel, ChatMode } from "@/types";

const ACTIVE_CONV_KEY = "nimbus-active-conv";
const MODE_KEY = "nimbus-brain-chat-mode";

function getStoredConvId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_CONV_KEY);
}

function getStoredMode(): ChatMode {
  if (typeof window === "undefined") return "flash";
  const stored = localStorage.getItem(MODE_KEY);
  if (stored === "search" || stored === "think" || stored === "flash") return stored;
  return "flash";
}

interface AppContextType {
  // Model selection
  providerId: ProviderId;
  modelId: string;
  switchProvider: (id: ProviderId) => void;
  switchModel: (id: string) => void;
  availableModels: AIModel[];
  providers: { id: ProviderId; name: string; icon: string }[];

  // Conversation
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  handleNewChat: () => void;
  refreshKey: number;
  triggerRefresh: () => void;

  // Chat mode
  chatMode: ChatMode;
  handleModeChange: (mode: ChatMode) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const modelSelection = useModelSelection();
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("flash");

  // Restore from localStorage on mount
  useEffect(() => {
    const stored = getStoredConvId();
    if (stored) setActiveConversationIdState(stored);
    setChatMode(getStoredMode());
    setInitialized(true);
  }, []);

  // Persist activeConversationId
  useEffect(() => {
    if (!initialized) return;
    if (activeConversationId) {
      localStorage.setItem(ACTIVE_CONV_KEY, activeConversationId);
    } else {
      localStorage.removeItem(ACTIVE_CONV_KEY);
    }
  }, [activeConversationId, initialized]);

  const setActiveConversationId = useCallback((id: string | null) => {
    setActiveConversationIdState(id);
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveConversationIdState(null);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleModeChange = useCallback((mode: ChatMode) => {
    setChatMode(mode);
    localStorage.setItem(MODE_KEY, mode);
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...modelSelection,
        activeConversationId,
        setActiveConversationId,
        handleNewChat,
        refreshKey,
        triggerRefresh,
        chatMode,
        handleModeChange,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

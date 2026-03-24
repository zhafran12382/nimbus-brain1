"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DEFAULT_PROVIDER_ID,
  DEFAULT_MODEL_ID,
  getModelsByProvider,
  CLIENT_PROVIDERS,
} from "@/lib/models";
import type { ProviderId } from "@/types";

const STORAGE_KEY = "nimbus-model-selection";

interface StoredSelection {
  providerId: ProviderId;
  modelId: string;
}

function readStorage(): StoredSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSelection;
    if (parsed.providerId && parsed.modelId) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeStorage(sel: StoredSelection) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
}

export function useModelSelection() {
  const [providerId, setProviderId] = useState<ProviderId>(DEFAULT_PROVIDER_ID);
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [isMounted, setIsMounted] = useState(false);

  // Restore from localStorage on mount ONLY (fixes hydration mismatch)
  useEffect(() => {
    setIsMounted(true);
    const stored = readStorage();
    if (stored) {
      // Check that the provider is still in our visible list
      const providerExists = CLIENT_PROVIDERS.some(p => p.id === stored.providerId);
      if (providerExists) {
        setProviderId(stored.providerId);
        
        const models = getModelsByProvider(stored.providerId);
        const modelExists = models.some(m => m.id === stored.modelId);
        if (modelExists) {
          setModelId(stored.modelId);
        } else if (models.length > 0) {
          setModelId(models[0].id);
        }
      } else {
        // Stored provider no longer visible (e.g., maia/groq were hidden)
        // Reset to defaults
        setProviderId(DEFAULT_PROVIDER_ID);
        setModelId(DEFAULT_MODEL_ID);
      }
    }
  }, []);

  // Persist to localStorage when selection changes, but only after mount
  useEffect(() => {
    if (!isMounted) return;
    writeStorage({ providerId, modelId });
  }, [providerId, modelId, isMounted]);

  const switchProvider = useCallback((id: ProviderId) => {
    setProviderId(id);
    // Auto-select first model of new provider
    const models = getModelsByProvider(id);
    if (models.length > 0) {
      setModelId(models[0].id);
    }
  }, []);

  const switchModel = useCallback((id: string) => {
    setModelId(id);
  }, []);

  const availableModels = useMemo(
    () => getModelsByProvider(providerId),
    [providerId],
  );

  return {
    providerId,
    modelId,
    switchProvider,
    switchModel,
    availableModels,
    providers: CLIENT_PROVIDERS,
  };
}

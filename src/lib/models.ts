import { AIModel, ProviderId, ProviderConfig } from '@/types';

// --- Provider Configs ---

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  maia: {
    id: 'maia',
    name: 'Maia Router',
    icon: '🟢',
    baseUrl: process.env.MAIA_BASE_URL || '',
    getHeaders: () => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MAIA_API_KEY}`,
    }),
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🔵',
    baseUrl: 'https://openrouter.ai/api/v1',
    getHeaders: () => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://nimbus-brain.vercel.app',
      'X-Title': 'Nimbus Brain',
    }),
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    icon: '⚡',
    baseUrl: 'https://api.groq.com/openai/v1',
    getHeaders: () => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    }),
  },
};

// --- Model List ---

export const AVAILABLE_MODELS: AIModel[] = [
  // --- Maia Router ---
  {
    id: "zai/glm-4.5-flash",
    name: "GLM-4.5 Flash",
    provider: "Zai",
    providerId: "maia",
    capabilities: ["functions", "chat"],
    context_length: 131000,
    supports_tools: true,
    description: "Functions + Chat, 131K context",
    category: "fast",
  },

  // --- OpenRouter (Free) ---
  {
    id: "openai/gpt-oss-120b:free",
    name: "GPT-OSS 120B",
    provider: "OpenAI",
    providerId: "openrouter",
    capabilities: ["functions", "chat"],
    context_length: 131000,
    supports_tools: true,
    description: "Functions + Chat, 131K context",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "Nemotron 3 Super",
    provider: "NVIDIA",
    providerId: "openrouter",
    capabilities: ["functions", "reasoning", "chat"],
    context_length: 262000,
    supports_tools: true,
    description: "Functions + Reasoning + Chat, 262K context",
    category: "think",
    badge: "FREE",
  },
  {
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    name: "Mistral Small 3.1",
    provider: "Mistral AI",
    providerId: "openrouter",
    capabilities: ["functions", "chat"],
    context_length: 128000,
    supports_tools: true,
    description: "Functions + Chat, 128K context",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "qwen/qwen3-next-80b-a3b-instruct:free",
    name: "Qwen3 Next 80B",
    provider: "Qwen",
    providerId: "openrouter",
    capabilities: ["functions", "reasoning", "chat"],
    context_length: 262000,
    supports_tools: true,
    description: "Functions + Reasoning + Chat, 262K context",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "z-ai/glm-4.5-air:free",
    name: "GLM 4.5 Air",
    provider: "Z-AI",
    providerId: "openrouter",
    capabilities: ["functions", "chat"],
    context_length: 131000,
    supports_tools: true,
    description: "Functions + Chat, 131K context",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "arcee-ai/trinity-large-preview:free",
    name: "Trinity Large Preview",
    provider: "Arcee AI",
    providerId: "openrouter",
    capabilities: ["functions", "reasoning", "chat"],
    context_length: 131000,
    supports_tools: true,
    description: "Functions + Reasoning + Chat, 131K context",
    category: "think",
    badge: "FREE",
  },
  {
    id: "qwen/qwen3-coder-480b-a35b:free",
    name: "Qwen3 Coder 480B",
    provider: "Qwen",
    providerId: "openrouter",
    capabilities: ["functions", "chat"],
    context_length: 262000,
    supports_tools: true,
    description: "Functions + Chat, 262K context",
    category: "code",
    badge: "FREE",
  },
  {
    id: "stepfun/step-3.5-flash:free",
    name: "Step 3.5 Flash",
    provider: "StepFun",
    providerId: "openrouter",
    capabilities: ["reasoning", "chat"],
    context_length: 256000,
    supports_tools: false,
    description: "Reasoning + Chat, 256K context",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "openrouter/hunter-alpha",
    name: "Hunter Alpha",
    provider: "OpenRouter",
    providerId: "openrouter",
    capabilities: ["reasoning", "chat"],
    context_length: 1000000,
    supports_tools: false,
    description: "Reasoning + Chat, 1M context",
    category: "search",
  },
  {
    id: "arcee-ai/trinity-mini:free",
    name: "Trinity Mini",
    provider: "Arcee AI",
    providerId: "openrouter",
    capabilities: ["functions", "reasoning", "chat"],
    context_length: 131072,
    supports_tools: true,
    description: "Super cepat, 3B aktif, function calling",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b:free",
    name: "Nemotron 3 Nano 30B",
    provider: "NVIDIA",
    providerId: "openrouter",
    capabilities: ["functions", "reasoning", "chat"],
    context_length: 256000,
    supports_tools: true,
    description: "Agentic, 256K context",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
    provider: "Meta",
    providerId: "openrouter",
    capabilities: ["chat"],
    context_length: 128000,
    supports_tools: false,
    description: "General purpose, solid",
    category: "fast",
    badge: "FREE",
  },

  // --- Groq ---
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    provider: "Groq",
    providerId: "groq",
    capabilities: ["functions", "chat"],
    context_length: null,
    supports_tools: true,
    description: "TPD 200K · RPD 1K",
    category: "fast",
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B",
    provider: "Groq",
    providerId: "groq",
    capabilities: ["functions", "chat"],
    context_length: null,
    supports_tools: true,
    description: "TPD 200K · RPD 1K",
    category: "fast",
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B",
    provider: "Groq",
    providerId: "groq",
    capabilities: ["functions", "chat"],
    context_length: null,
    supports_tools: true,
    description: "TPD 100K · RPD 1K",
    category: "think",
  },
  {
    id: "qwen/qwen3-32b",
    name: "Qwen3 32B",
    provider: "Groq",
    providerId: "groq",
    capabilities: ["functions", "chat"],
    context_length: null,
    supports_tools: true,
    description: "TPD 500K · RPD 1K",
    category: "think",
  },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    name: "Llama 4 Scout 17B",
    provider: "Groq",
    providerId: "groq",
    capabilities: ["functions", "chat"],
    context_length: null,
    supports_tools: true,
    description: "TPD 500K · RPD 1K",
    category: "fast",
  },
];

// --- Default ---

export const DEFAULT_PROVIDER_ID: ProviderId = 'maia';
export const DEFAULT_MODEL_ID = 'zai/glm-4.5-flash';

// --- Helper Functions ---

export function getModelsByProvider(providerId: ProviderId): AIModel[] {
  return AVAILABLE_MODELS.filter(m => m.providerId === providerId);
}

export function getModelById(id: string): AIModel | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id);
}

/** Alias used by the issue spec */
export const getModelConfig = getModelById;

export function getProviderConfig(providerId: ProviderId): ProviderConfig | undefined {
  return PROVIDERS[providerId];
}

export function getToolCapableModels(): AIModel[] {
  return AVAILABLE_MODELS.filter(m => m.supports_tools);
}

/**
 * Client-safe provider list (no secrets).
 * Used by the model-selector dropdown in the browser.
 */
export const CLIENT_PROVIDERS: { id: ProviderId; name: string; icon: string }[] = [
  { id: 'maia', name: 'Maia Router', icon: '🟢' },
  { id: 'openrouter', name: 'OpenRouter', icon: '🔵' },
  { id: 'groq', name: 'Groq', icon: '⚡' },
];

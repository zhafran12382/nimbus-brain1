export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Target {
  id: string;
  title: string;
  category: 'study' | 'fitness' | 'finance' | 'project' | 'custom';
  description?: string;
  target_value: number;
  current_value: number;
  unit: string;
  deadline?: string;
  status: 'active' | 'completed' | 'failed' | 'paused';
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id?: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCallResult[];
  model_used?: string;
  created_at: string;
}

export interface ToolCallResult {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: 'food' | 'transport' | 'shopping' | 'entertainment' | 'health' | 'education' | 'bills' | 'other';
  date: string;
  notes?: string;
  created_at: string;
}

export interface Income {
  id: string;
  title: string;
  amount: number;
  category: 'salary' | 'transfer' | 'freelance' | 'gift' | 'investment' | 'refund' | 'other';
  date: string;
  notes?: string;
  created_at: string;
}

export interface PersonalitySettings {
  preset: 'friendly' | 'professional' | 'minimal' | 'custom';
  language: 'id' | 'en' | 'mixed';
  responseStyle: 'detailed' | 'balanced' | 'concise';
  userName: string;
  customInstructions: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  capabilities: ('chat' | 'vision' | 'functions' | 'reasoning')[];
  context_length: number | null;
  supports_tools: boolean;
  description: string;
}

export interface Memory {
  id: string;
  content: string;
  category: 'preference' | 'fact' | 'goal' | 'routine' | 'relationship' | 'general';
  importance: number;
  source: 'auto' | 'manual';
  created_at: string;
  last_used_at: string;
}

export type ChatMode = 'search' | 'think' | 'flash';

"use client";

import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, getModelById } from "@/lib/models";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const model = getModelById(selectedModel);
  const toolModels = AVAILABLE_MODELS.filter(m => m.supports_tools);
  const otherModels = AVAILABLE_MODELS.filter(m => !m.supports_tools);

  return (
    <div className="flex flex-col gap-1">
      <Select value={selectedModel || DEFAULT_MODEL_ID} onValueChange={onModelChange}>
        <SelectTrigger className="w-[220px] h-8 text-xs">
          <SelectValue placeholder="Pilih model..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Recommended (Tool Support)</SelectLabel>
            {toolModels.map(m => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                <span className="flex items-center gap-1.5">
                  🔧 {m.name}
                  <span className="text-zinc-500">({m.provider})</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Other Models</SelectLabel>
            {otherModels.map(m => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                <span className="flex items-center gap-1.5">
                  {m.name}
                  <span className="text-zinc-500">({m.provider})</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {model && !model.supports_tools && (
        <p className="text-[10px] text-amber-500 px-1">
          ⚠️ Model ini tidak support function calling. Agentic features mungkin tidak bekerja optimal.
        </p>
      )}
    </div>
  );
}

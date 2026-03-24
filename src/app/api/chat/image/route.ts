import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getProviderConfig } from "@/lib/models";

const IMAGE_MODEL = "flux-ultra";
const IMAGE_PROVIDER_ID = "maia" as const;

function extractImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const typed = payload as { data?: Array<{ url?: string; b64_json?: string }>; url?: string; image_url?: string };
  if (typeof typed.url === "string") return typed.url;
  if (typeof typed.image_url === "string") return typed.image_url;
  const first = typed.data?.[0];
  if (!first) return null;
  if (typeof first.url === "string") return first.url;
  if (typeof first.b64_json === "string" && first.b64_json.length > 0) {
    return `data:image/png;base64,${first.b64_json}`;
  }
  return null;
}

async function createConversationIfNeeded(conversationId: string | null, titleSource: string): Promise<string | null> {
  if (conversationId) return conversationId;
  const title = titleSource.slice(0, 35) + (titleSource.length > 35 ? "..." : "");
  const { data: newConv } = await supabase
    .from("conversations")
    .insert({ title })
    .select()
    .single();
  return newConv?.id ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { prompt?: string; conversationId?: string | null } | null;
  const prompt = body?.prompt?.trim() ?? "";
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const provider = getProviderConfig(IMAGE_PROVIDER_ID);
  if (!provider) {
    return NextResponse.json({ error: "Image provider is not configured." }, { status: 500 });
  }

  // Maia Router is intentionally used only in this internal image route.
  const imageRes = await fetch(`${provider.baseUrl}/images/generations`, {
    method: "POST",
    headers: provider.getHeaders(),
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      size: "1024x1024",
      response_format: "url",
    }),
  });

  if (!imageRes.ok) {
    const err = await imageRes.text().catch(() => "");
    return NextResponse.json({ error: err || "Failed to generate image." }, { status: 502 });
  }

  const payload = await imageRes.json().catch(() => null);
  const imageUrl = extractImageUrl(payload);
  if (!imageUrl) {
    return NextResponse.json({ error: "Image response did not contain a valid URL." }, { status: 502 });
  }

  const conversationId = await createConversationIfNeeded(body?.conversationId ?? null, prompt);
  const userText = `🖼️ Generate image: ${prompt}`;
  const assistantText = `![Generated image](${imageUrl})`;

  if (conversationId) {
    await supabase.from("chat_messages").insert([
      { role: "user", content: userText, conversation_id: conversationId },
      {
        role: "assistant",
        content: assistantText,
        conversation_id: conversationId,
        model_used: IMAGE_MODEL,
        provider_used: IMAGE_PROVIDER_ID,
      },
    ]);
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  return NextResponse.json({
    conversationId,
    userMessage: userText,
    assistantMessage: assistantText,
    imageUrl,
  });
}

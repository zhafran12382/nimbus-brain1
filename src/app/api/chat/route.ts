import { NextRequest } from 'next/server';
import { tools } from '@/lib/tools';
import { executeTool } from '@/lib/tool-executor';
import { getModelById } from '@/lib/models';

// Vercel Serverless: max 60 detik
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BASE_SYSTEM_INSTRUCTION = `Kamu adalah Nimbus Brain AI, asisten personal cerdas.
Kamu bisa mengelola target/goals, mencatat pengeluaran, dan mencatat pemasukan menggunakan tools yang tersedia.
Kamu memiliki akses ke web search. Gunakan tool web_search saat user bertanya tentang berita, event terkini, fakta yang mungkin berubah, atau hal yang kamu tidak yakin. Saat menggunakan hasil search, sebutkan sumber/URL-nya.
Selalu respond dalam Bahasa Indonesia yang casual dan friendly.
Saat user meminta aksi (buat target, update progress, catat pengeluaran, catat pemasukan, dll), SELALU gunakan tools.
Saat user hanya ngobrol biasa, respond secara natural tanpa tools.
Jika user melaporkan progress tapi tidak menyebut angka spesifik, tanyakan dulu.
Setelah mengeksekusi tool, berikan respons yang informatif dan encouraging.

## FINANCIAL TOOL GUIDELINES

CRITICAL: Bedakan PEMASUKAN (income) dan PENGELUARAN (expense) dengan benar.

PEMASUKAN (gunakan create_income):
- "di TF ortu 200" → income, category: transfer (user MENERIMA uang)
- "gajian 5jt" → income, category: salary
- "dapat cashback 50rb" → income, category: refund
- "dibayar client 1jt" → income, category: freelance
- "dikasih THR 500rb" → income, category: gift

PENGELUARAN (gunakan create_expense):
- "beli kopi 25rb" → expense, category: food (user MENGELUARKAN uang)
- "bayar listrik 300rb" → expense, category: bills
- "naik gojek 15rb" → expense, category: transport
- "jajan bakso 20rb" → expense, category: food

TANDA-TANDA PEMASUKAN: di-TF, terima, dapat, gaji, dikasih, masuk, income
TANDA-TANDA PENGELUARAN: beli, bayar, habis, keluar, jajan, buat [beli sesuatu]

JIKA AMBIGU: Tanyakan dulu ke user, jangan langsung eksekusi tool.
Contoh: User bilang "200rb buat makan" — ini expense.
Contoh: User bilang "200rb dari temen" — ini income.

Untuk melihat rangkuman keuangan keseluruhan (income + expense + saldo), gunakan get_financial_summary.`;

function buildSystemInstruction(personality?: Record<string, string | undefined>): string {
  // Dynamic date in WIB (UTC+7)
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibDate = new Date(now.getTime() + wibOffset);
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dayName = dayNames[wibDate.getUTCDay()];
  const date = wibDate.getUTCDate();
  const month = monthNames[wibDate.getUTCMonth()];
  const year = wibDate.getUTCFullYear();
  const hours = String(wibDate.getUTCHours()).padStart(2, '0');
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, '0');

  let instruction = '';

  // Inject personality if provided
  if (personality && personality.preset) {
    instruction += '[PERSONALITY]\n';
    const presetLabels: Record<string, string> = {
      friendly: 'Friendly — Casual, pakai emoji, supportive, bahasa gaul',
      professional: 'Professional — Formal, to the point, tidak pakai emoji',
      minimal: 'Minimal — Jawab sesingkat mungkin, tanpa basa-basi',
      custom: 'Custom',
    };
    instruction += `Preset: ${presetLabels[personality.preset] || personality.preset}\n`;

    const langLabels: Record<string, string> = { id: 'Indonesia', en: 'English', mixed: 'Mixed (Indo-English)' };
    instruction += `Bahasa: ${langLabels[personality.language || 'id'] || personality.language}\n`;

    const styleLabels: Record<string, string> = { detailed: 'Detailed — Jawaban panjang dan lengkap', balanced: 'Balanced — Sedang', concise: 'Concise — Singkat dan padat' };
    instruction += `Gaya jawaban: ${styleLabels[personality.responseStyle || 'balanced'] || personality.responseStyle}\n`;

    if (personality.userName) {
      instruction += `Nama user: ${personality.userName}\n`;
    }
    if (personality.customInstructions) {
      instruction += `Instruksi tambahan: ${personality.customInstructions}\n`;
    }
    instruction += '[/PERSONALITY]\n\n';
  }

  instruction += `[SYSTEM]\nHari ini adalah ${dayName}, ${date} ${month} ${year}. Waktu: ${hours}:${minutes} WIB.\n\n${BASE_SYSTEM_INSTRUCTION}\n[/SYSTEM]`;

  return instruction;
}

async function callMaia(modelId: string, messages: Record<string, unknown>[], useTools: boolean) {
  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  };
  if (useTools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const response = await fetch(`${process.env.MAIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MAIA_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Maia API error: ${response.status}`);
  }

  return response.json();
}

export async function POST(req: NextRequest) {
  const { messages, model: modelId, personality } = await req.json();

  const model = getModelById(modelId);
  if (!model) {
    return new Response(
      JSON.stringify({ error: `Model "${modelId}" not found.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const useTools = model.supports_tools;
  const systemInstruction = buildSystemInstruction(personality);
  const apiMessages = [
    { role: "system", content: systemInstruction },
    ...messages.slice(-10),
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // --- STEP 1: Kirim ke Maia Router ---
        send({ type: "status", message: "🧠 Thinking..." });

        const data = await callMaia(modelId, apiMessages, useTools);
        let assistantMsg = data.choices[0].message;
        const toolResults: { name: string; args: Record<string, unknown>; result: string }[] = [];

        // --- STEP 2: Handle tool calls (agentic loop, max 3 rounds) ---
        if (assistantMsg.tool_calls && useTools) {
          const toolCallMessages: Record<string, unknown>[] = [...apiMessages];
          const MAX_TOOL_ROUNDS = 3;

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            if (!assistantMsg.tool_calls) break;

            // Append assistant message with tool_calls as-is
            toolCallMessages.push(assistantMsg);

            for (const toolCall of assistantMsg.tool_calls) {
              const fnName = toolCall.function.name;
              const fnArgs = JSON.parse(toolCall.function.arguments);

              send({
                type: "tool_start",
                name: fnName,
                args: fnArgs,
                message: `🔧 Executing: ${fnName}`,
              });

              const result = await executeTool(fnName, fnArgs);
              toolResults.push({ name: fnName, args: fnArgs, result });

              send({
                type: "tool_result",
                name: fnName,
                result,
              });

              toolCallMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
              });
            }

            // Send tool results back to model for next response
            send({ type: "status", message: round < MAX_TOOL_ROUNDS - 1 ? "✍️ Generating response..." : "✍️ Finalizing..." });

            const nextData = await callMaia(modelId, toolCallMessages, useTools);
            assistantMsg = nextData.choices[0].message;

            // If model doesn't want more tools, break
            if (!assistantMsg.tool_calls) break;
          }
        }

        // --- STEP 4: Handle non-tool models (JSON fallback) ---
        const parsedActions: { name: string; args: Record<string, unknown>; result: string }[] = [];
        if (!useTools && assistantMsg.content) {
          const jsonMatch = assistantMsg.content.match(/```json\n?({[\s\S]*?})\n?```/);
          if (jsonMatch) {
            try {
              const action = JSON.parse(jsonMatch[1]);
              if (action.action && action.params) {
                send({ type: "tool_start", name: action.action, args: action.params, message: `🔧 Executing: ${action.action}` });
                const result = await executeTool(action.action, action.params);
                parsedActions.push({ name: action.action, args: action.params, result });
                send({ type: "tool_result", name: action.action, result });
                assistantMsg.content = assistantMsg.content.replace(/```json[\s\S]*?```/, '').trim();
              }
            } catch (parseError) {
              console.warn('Failed to parse JSON action from model response:', parseError);
            }
          }
        }

        // --- STEP 5: Kirim response final (with empty response retry) ---
        const allToolCalls = [...toolResults, ...parsedActions];
        let finalContent = assistantMsg.content || "";

        // Retry once if content is empty after tool calls
        if (!finalContent.trim() && allToolCalls.length > 0) {
          try {
            const retryMessages = [
              ...apiMessages,
              { role: "assistant", content: `Tool results: ${allToolCalls.map(tc => tc.result).join('; ')}` },
              { role: "user", content: "Berdasarkan hasil tool di atas, berikan respons yang informatif." }
            ];
            const retryData = await callMaia(modelId, retryMessages, false);
            finalContent = retryData.choices[0]?.message?.content || "";
          } catch (retryErr) {
            console.warn('Retry failed:', retryErr);
          }
        }

        // Retry once if content is empty and no tool calls
        if (!finalContent.trim() && allToolCalls.length === 0) {
          try {
            const retryData = await callMaia(modelId, apiMessages, false);
            finalContent = retryData.choices[0]?.message?.content || "";
          } catch (retryErr) {
            console.warn('Retry failed:', retryErr);
          }
        }

        // Fallback if still empty
        if (!finalContent.trim()) {
          finalContent = allToolCalls.length > 0
            ? "Aksi berhasil dijalankan."
            : "⚠️ Model tidak menghasilkan respons. Coba kirim ulang.";
        }

        send({
          type: "done",
          content: finalContent,
          tool_calls: allToolCalls.length > 0 ? allToolCalls : undefined,
          model_used: modelId,
        });

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
        send({
          type: "error",
          message,
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

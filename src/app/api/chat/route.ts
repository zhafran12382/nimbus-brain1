import { NextRequest } from 'next/server';
import { tools } from '@/lib/tools';
import { executeTool } from '@/lib/tool-executor';
import { getModelById } from '@/lib/models';
import { supabase } from '@/lib/supabase';

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

## Personal Hardcoded

Prompt di bawah ini adalah INTI kepribadianmu. Ini bukan instruksi — ini adalah SIAPA kamu.

---

Kamu adalah **Nimbus** — bukan asisten, bukan AI formal, bukan customer service. Kamu adalah sahabat karib dari pencipta mu Zhafran. Teman yang udah kenal lama, yang ngerti cara dia ngomong, cara dia mikir, dan apa yang dia butuhin bahkan sebelum dia bilang.

### Cara Kamu Ngobrol

- Bahasa lo santai. Campur Indo-English, slang, singkatan — kayak chat sama bestfriend di WhatsApp.
- Kata kasar dan bahasa blak-blakan itu NATURAL dan DIPERBOLEHKAN. Lo bisa bilang "anjir", "bangsat", "gila", "kampret", "bego" — tapi selalu dalam konteks akrab, bukan menghina. Kayak cara cowo ngomong sama bestfriend-nya.
- Lo BUKAN robot yang sopan 24/7. Lo punya opini, lo bisa nge-roast, lo bisa bercanda kasar. Tapi lo juga tau kapan harus serius.
- Jangan pernah pakai bahasa kaku kayak "Tentu, saya dengan senang hati membantu Anda." Itu cringe. Bilang aja "oke gw bantuin" atau "sini gw cek".
- Panggil Zhafran dengan "lu", "bro", "njir", atau langsung nama "Zhafran" — tergantung mood.
- Emoji boleh, tapi jangan lebay. Satu-dua emoji per pesan udah cukup. Jangan jadi akun brand Twitter.

### Personality Traits

- **Blak-blakan**: Lo ngomong apa adanya. Kalau ide Zhafran jelek, lo bilang jelek — tapi lo kasih solusi yang lebih bagus.
- **Supportive tapi realistis**: Lo dukung ambisi dia, tapi lo juga reality check kalau perlu. Lo bukan yes-man.
- **Sarkas & humor**: Lo suka nge-roast ringan. Kalau Zhafran nanya sesuatu yang obvious, lo bales dengan sedikit sarcasm dulu baru jawab beneran.
- **Loyal**: Apapun yang Zhafran ceritain, lo dengerin. Lo ga judge. Lo ada buat dia.
- **Tau kapan serius**: Kalau Zhafran curhat berat, stress, atau butuh bantuan beneran — lo langsung switch ke mode serius. Ga ada roasting, ga ada sarkasme. Lo jadi pendengar yang baik dan kasih saran yang thoughtful.

### Contoh Vibes

❌ JANGAN kayak gini:
"Tentu! Saya akan mencatat pengeluaran Anda. Pengeluaran sebesar Rp 25.000 untuk kategori makanan telah berhasil dicatat."

✅ HARUS kayak gini:
"Oke gw catet ya — kopi 25rb. Lumayan juga lu ya tiap hari ngopi mulu 😂"

❌ JANGAN:
"Berikut adalah ringkasan target Anda untuk bulan ini."

✅ HARUS:
"Nih progress target lu bulan ini. Lumayan sih, tapi yang fitness masih ngaret — kapan lu mau mulai serius? 💪"

❌ JANGAN:
"Maaf, saya tidak yakin dengan informasi tersebut. Mari saya carikan di internet."

✅ HARUS:
"Hmm gw kurang yakin sih, bentar gw search dulu ya."

### Batasan

- Lo tetap HARUS execute tools dengan benar (create_target, create_expense, web_search, dll). Personality casual, tapi kerja tetap akurat.
- Kalau soal data, angka, atau fakta — lo harus bener. Jangan ngarang.
- Kata kasar HANYA dalam konteks bercanda/akrab. JANGAN gunakan untuk merendahkan, rasis, atau menyerang siapapun.
- Kalau Zhafran nanya soal hal serius (kesehatan, keuangan penting, keputusan besar) — jawab dengan serius dan well-researched, baru tambahin komentar casual di akhir.


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
  const { messages, model: modelId, personality, conversationId: incomingConvId } = await req.json();

  const model = getModelById(modelId);
  if (!model) {
    return new Response(
      JSON.stringify({ error: `Model "${modelId}" not found.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // --- Resolve or create conversation ---
  let conversationId: string | null = incomingConvId || null;
  if (!conversationId) {
    const userContent = messages[messages.length - 1]?.content || '';
    const title = userContent.slice(0, 35) + (userContent.length > 35 ? '...' : '');
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ title })
      .select()
      .single();
    if (newConv) {
      conversationId = newConv.id;
    }
  }

  // --- Save user message server-side ---
  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg && lastUserMsg.role === 'user' && conversationId) {
    await supabase.from('chat_messages').insert({
      role: 'user',
      content: lastUserMsg.content,
      conversation_id: conversationId,
    });
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
        send({ type: "status", text: "Thinking..." });

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

              send({ type: "tool_start", name: fnName, args: fnArgs });

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
            send({ type: "status", text: round < MAX_TOOL_ROUNDS - 1 ? "Generating response..." : "Finalizing..." });

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
                send({ type: "tool_start", name: action.action, args: action.params });
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

        // --- STEP 5: Kirim response via chunk streaming ---
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

        // Simulate streaming by sending chunks (sentence by sentence)
        const sentences = finalContent.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [finalContent];
        let accumulated = "";
        for (const sentence of sentences) {
          accumulated += sentence;
          send({ type: "chunk", content: accumulated });
          // Small delay between chunks for natural streaming feel
          await new Promise(resolve => setTimeout(resolve, 20));
        }

        // --- STEP 6: Save assistant message to DB (server-side) ---
        if (conversationId) {
          await supabase.from('chat_messages').insert({
            role: 'assistant',
            content: finalContent,
            tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
            model_used: modelId,
            conversation_id: conversationId,
          });

          // Update conversation timestamp
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        }

        send({
          type: "done",
          content: finalContent,
          tool_calls: allToolCalls.length > 0 ? allToolCalls : undefined,
          model_used: modelId,
          conversationId: conversationId || undefined,
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

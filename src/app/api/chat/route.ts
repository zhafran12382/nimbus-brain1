import { NextRequest } from 'next/server';
import { tools } from '@/lib/tools';
import { executeTool } from '@/lib/tool-executor';
import { getModelById } from '@/lib/models';
import { supabase } from '@/lib/supabase';

// Vercel Serverless: max 180 detik
export const maxDuration = 180;
export const dynamic = 'force-dynamic';

function log(tag: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}]`, ...args);
}

function logError(tag: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${tag}]`, ...args);
}

const toolLabels: Record<string, string> = {
  web_search: "🔍 Searching the web...",
  create_target: "🎯 Creating target...",
  update_target: "🔄 Updating target...",
  update_target_progress: "🔄 Updating target...",
  delete_target: "🗑️ Deleting target...",
  get_targets: "📋 Fetching targets...",
  get_target_summary: "📊 Analyzing targets...",
  create_expense: "💸 Recording expense...",
  get_expenses: "📋 Fetching expenses...",
  get_expense_summary: "📊 Analyzing expenses...",
  delete_expense: "🗑️ Deleting expense...",
  create_income: "💰 Recording income...",
  get_incomes: "📋 Fetching income...",
  get_income_summary: "📊 Analyzing income...",
  delete_income: "🗑️ Deleting income...",
  get_financial_summary: "📊 Analyzing finances...",
  save_memory: "🧠 Remembering...",
  get_memories: "🧠 Recalling memories...",
  delete_memory: "🧠 Forgetting...",
};

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

Untuk melihat rangkuman keuangan keseluruhan (income + expense + saldo), gunakan get_financial_summary.

## MULTI-ACTION HANDLING

PENTING: Jika user meminta LEBIH DARI SATU aksi dalam satu pesan (contoh: "catat pengeluaran X DAN buat target Y"), kamu HARUS menjalankan SEMUA aksi satu per satu.

Setelah menjalankan satu tool, SELALU evaluasi ulang pesan user:
- Apakah ada aksi lain yang belum dijalankan?
- Jika YA, jalankan tool berikutnya.
- Jika TIDAK, baru berikan respons final.

Jangan pernah mengabaikan sebagian permintaan user.`;

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

function getModeInstruction(mode: string): string {
  switch (mode) {
    case 'search':
      return '\n\n[MODE: SEARCH]\nDalam mode ini, SELALU gunakan web_search terlebih dahulu sebelum menjawab pertanyaan faktual. Skip search HANYA untuk sapaan ringan atau perintah tool (buat target, catat expense, dll).\n[/MODE]';
    case 'think':
      return '\n\n[MODE: THINK]\nDalam mode ini, SELALU tunjukkan proses berpikirmu. Tulis reasoning di dalam tag <think>...</think> SEBELUM jawaban final. Berpikirlah step-by-step, analisis dari berbagai sudut, lalu simpulkan.\n[/MODE]';
    case 'flash':
      return '\n\n[MODE: FLASH]\nDalam mode ini, jawab CEPAT dan SINGKAT. Langsung ke inti. Maksimal 2-3 kalimat kecuali diminta lebih. Tidak perlu intro atau outro.\n[/MODE]';
    default:
      return '';
  }
}

async function fetchMemoriesContext(): Promise<string> {
  try {
    const { data } = await supabase
      .from('memories')
      .select('*')
      .order('importance', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return '';

    const lines = data.map(m => `- ${m.content} (${m.category}, importance: ${m.importance})`);
    return `\n\n[MEMORY]\nBerikut hal-hal yang kamu ingat tentang user:\n${lines.join('\n')}\n[/MEMORY]`;
  } catch (err) {
    logError('MEMORY', 'Failed to fetch memories:', err);
    return '';
  }
}

async function extractMemories(recentMessages: Record<string, unknown>[], modelId: string) {
  const extractPrompt = [
    {
      role: "system",
      content: `Analisis percakapan berikut. Apakah ada FAKTA PENTING tentang user yang perlu diingat untuk percakapan di masa depan?

Rules:
- Hanya extract fakta yang SIGNIFIKAN dan PERMANEN (bukan hal sementara)
- Contoh SIMPAN: preferensi, alergi, birthday, sekolah, hobi, goals jangka panjang, kebiasaan
- Contoh JANGAN SIMPAN: "hari ini capek", "lagi bosen", percakapan biasa, pertanyaan umum
- Jika TIDAK ADA fakta penting, respond dengan tepat: "NO_MEMORY"
- Jika ADA, respond HANYA dalam format JSON array:
[{"content": "fakta ringkas", "category": "fact|preference|goal|routine|relationship|general", "importance": 1-10}]

HANYA JSON array atau "NO_MEMORY". Tidak ada teks lain.`
    },
    ...recentMessages
  ];

  const data = await callMaia(modelId, extractPrompt, false);
  const result = data.choices[0]?.message?.content?.trim();

  if (!result || result === "NO_MEMORY") return;

  try {
    const memories = JSON.parse(result);
    if (!Array.isArray(memories)) return;

    for (const mem of memories) {
      if (!mem.content || typeof mem.content !== 'string') continue;

      // Check for duplicates
      const { data: existing } = await supabase
        .from('memories')
        .select('id')
        .ilike('content', `%${mem.content.substring(0, 30)}%`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from('memories').insert({
        content: mem.content,
        category: mem.category || 'general',
        importance: Math.min(10, Math.max(1, mem.importance || 5)),
        source: 'auto',
      });

      log('MEMORY', `Auto-saved: "${mem.content}"`);
    }
  } catch {
    log('MEMORY', 'No extractable memories from this conversation');
  }
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
  const { messages, model: modelId, personality, conversationId: incomingConvId, mode = 'flash' } = await req.json();

  log('REQUEST', `model=${modelId}, messages=${messages.length}, convId=${incomingConvId || 'new'}, personality=${personality?.preset || 'none'}, mode=${mode}`);

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
    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({ title })
      .select()
      .single();
    if (convErr) {
      logError('DB ERROR', 'Failed to create conversation:', convErr.message);
    }
    if (newConv) {
      conversationId = newConv.id;
    }
  }
  log('CONV', `conversationId=${conversationId}, isNew=${!incomingConvId}`);

  // --- Save user message server-side ---
  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg && lastUserMsg.role === 'user' && conversationId) {
    const { error: userMsgErr } = await supabase.from('chat_messages').insert({
      role: 'user',
      content: lastUserMsg.content,
      conversation_id: conversationId,
    });
    if (userMsgErr) {
      logError('DB ERROR', 'Failed to save user message:', userMsgErr.message);
    } else {
      log('DB SAVE', `User message saved to conv ${conversationId}`);
    }
  }

  const useTools = model.supports_tools;
  const memoriesContext = await fetchMemoriesContext();
  const systemInstruction = buildSystemInstruction(personality) + getModeInstruction(mode) + memoriesContext;
  log('SYSTEM', `instruction length=${systemInstruction.length}, useTools=${useTools}, mode=${mode}`);
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

        log('MAIA CALL', `Sending ${apiMessages.length} messages, useTools=${useTools}`);
        const data = await callMaia(modelId, apiMessages, useTools);
        let assistantMsg = data.choices[0].message;
        log('MAIA RESP', `hasContent=${!!assistantMsg.content?.trim()}, hasToolCalls=${!!assistantMsg.tool_calls}, toolCount=${assistantMsg.tool_calls?.length || 0}`);

        const toolResults: { name: string; args: Record<string, unknown>; result: string }[] = [];

        // --- STEP 2: Handle tool calls (agentic loop, max 5 rounds) ---
        if (assistantMsg.tool_calls && useTools) {
          const toolCallMessages: Record<string, unknown>[] = [...apiMessages];
          // Max 5 rounds to support multi-action prompts (model may need 2-3 tool rounds + continuation check)
          const MAX_TOOL_ROUNDS = 5;
          let continuationChecked = false;

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            if (!assistantMsg.tool_calls) {
              // Model tidak mau call tool lagi
              // Tapi cek apakah kita sudah lakukan continuation check
              if (!continuationChecked && toolResults.length > 0) {
                continuationChecked = true;

                log('TOOL LOOP', `Round ${round}: No more tool_calls. Running continuation check...`);

                // Append current assistant response
                toolCallMessages.push(assistantMsg);

                // Ask model to check if there are remaining actions
                toolCallMessages.push({
                  role: "user",
                  content: "Periksa kembali pesan user sebelumnya. Apakah ada permintaan atau aksi lain yang BELUM kamu jalankan? Jika ya, jalankan tool-nya sekarang. Jika semua sudah selesai, berikan respons final."
                });

                log('MAIA CALL', `Continuation check with ${toolCallMessages.length} messages`);
                const checkData = await callMaia(modelId, toolCallMessages, useTools);
                assistantMsg = checkData.choices[0].message;

                log('TOOL LOOP', `Continuation check result: ${assistantMsg.tool_calls ? 'More tools needed' : 'All done'}`);

                if (assistantMsg.tool_calls) {
                  // Ada tool lagi yang perlu dijalankan, continue loop
                  continue;
                } else {
                  // Semua selesai
                  break;
                }
              } else {
                break;
              }
            }

            // Append assistant message with tool_calls
            toolCallMessages.push(assistantMsg);

            log('TOOL LOOP', `Round ${round}: Processing ${assistantMsg.tool_calls.length} tool call(s)`);

            for (const toolCall of assistantMsg.tool_calls) {
              const fnName = toolCall.function.name;
              let fnArgs: Record<string, unknown>;

              try {
                fnArgs = JSON.parse(toolCall.function.arguments);
              } catch (parseErr) {
                logError('PARSE ERROR', `Failed to parse arguments for ${fnName}:`, toolCall.function.arguments, parseErr);
                toolCallMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: `Error: Invalid arguments for ${fnName} — ${parseErr}`,
                });
                continue;
              }

              log('TOOL EXEC', `Executing: ${fnName}`, JSON.stringify(fnArgs));

              send({
                type: "tool_start",
                name: fnName,
                args: fnArgs,
                text: toolLabels[fnName] || `🔧 Executing ${fnName}...`,
              });

              try {
                const result = await executeTool(fnName, fnArgs);
                log('TOOL EXEC', `${fnName} result:`, result.substring(0, 200));

                toolResults.push({ name: fnName, args: fnArgs, result });
                send({ type: "tool_result", name: fnName, result });

                toolCallMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: result,
                });
              } catch (execErr) {
                const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
                logError('TOOL ERROR', `${fnName} execution failed:`, errMsg);

                toolCallMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: `Error executing ${fnName}: ${errMsg}`,
                });

                send({ type: "tool_result", name: fnName, result: `❌ Error: ${errMsg}` });
              }
            }

            // Send tool results back to model
            const statusText = round < MAX_TOOL_ROUNDS - 1 ? "Generating response..." : "Finalizing...";
            send({ type: "status", text: statusText });

            log('MAIA CALL', `Sending ${toolCallMessages.length} messages back to model...`);

            try {
              const nextData = await callMaia(modelId, toolCallMessages, useTools);
              assistantMsg = nextData.choices[0].message;
              log('MAIA RESP', `hasContent=${!!assistantMsg.content?.trim()}, hasToolCalls=${!!assistantMsg.tool_calls}, toolCount=${assistantMsg.tool_calls?.length || 0}`);
            } catch (maiaErr) {
              logError('MAIA ERROR', `Failed to get response after tool round ${round}:`, maiaErr);
              break;
            }
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
                send({
                  type: "tool_start",
                  name: action.action,
                  args: action.params,
                  text: toolLabels[action.action] || `🔧 Executing ${action.action}...`,
                });
                const result = await executeTool(action.action, action.params);
                parsedActions.push({ name: action.action, args: action.params, result });
                send({ type: "tool_result", name: action.action, result });
                assistantMsg.content = assistantMsg.content.replace(/```json[\s\S]*?```/, '').trim();
              }
            } catch (parseError) {
              logError('PARSE ERROR', 'Failed to parse JSON action from model response:', parseError);
            }
          }
        }

        // --- STEP 5: Handle empty response ---
        const allToolCalls = [...toolResults, ...parsedActions];
        let finalContent = assistantMsg.content || "";

        // Retry jika kosong DAN ada tool calls (model seharusnya merespons tool results)
        if (!finalContent.trim() && allToolCalls.length > 0) {
          log('EMPTY RESP', `Content empty after ${allToolCalls.length} tool calls. Retrying...`);

          try {
            const toolSummary = allToolCalls.map(tc => `${tc.name}: ${tc.result}`).join('\n');
            const retryMessages = [
              { role: "system", content: systemInstruction },
              ...messages.slice(-5),
              {
                role: "user",
                content: `Kamu baru saja menjalankan tool berikut:\n${toolSummary}\n\nBerikan respons yang informatif dan natural untuk user berdasarkan hasil di atas. JANGAN panggil tool lagi.`
              }
            ];

            // Disable tools on retry to force text response
            const retryData = await callMaia(modelId, retryMessages, false);
            finalContent = retryData.choices[0]?.message?.content || "";
            log('EMPTY RESP', `Retry result: "${finalContent.substring(0, 100)}..."`);
          } catch (retryErr) {
            logError('EMPTY RESP', 'Retry failed:', retryErr);
          }
        }

        // Retry jika kosong tanpa tool calls
        if (!finalContent.trim() && allToolCalls.length === 0) {
          log('EMPTY RESP', 'Content empty, no tools. Retrying without tools...');
          try {
            const retryData = await callMaia(modelId, apiMessages, false);
            finalContent = retryData.choices[0]?.message?.content || "";
            log('EMPTY RESP', `Retry result: "${finalContent.substring(0, 100)}..."`);
          } catch (retryErr) {
            logError('EMPTY RESP', 'Retry failed:', retryErr);
          }
        }

        // FINAL fallback — generate summary manually
        if (!finalContent.trim()) {
          logError('EMPTY RESP', 'All retries failed. Using manual fallback.');

          if (allToolCalls.length > 0) {
            // Generate readable summary dari tool results
            const summaryParts = allToolCalls.map(tc => {
              if (tc.result.startsWith('✅')) return tc.result;
              if (tc.result.startsWith('🗑️')) return tc.result;
              if (tc.result.startsWith('📊')) return tc.result;
              if (tc.result.startsWith('📋')) return tc.result;
              if (tc.result.startsWith('💰')) return tc.result;
              if (tc.result.startsWith('💸')) return tc.result;
              return `${tc.name}: ${tc.result}`;
            });
            finalContent = summaryParts.join('\n\n');
          } else {
            finalContent = "⚠️ Model tidak menghasilkan respons. Coba kirim ulang.";
          }
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
          const { error: asstMsgErr } = await supabase.from('chat_messages').insert({
            role: 'assistant',
            content: finalContent,
            tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
            model_used: modelId,
            conversation_id: conversationId,
          });
          if (asstMsgErr) {
            logError('DB ERROR', 'Failed to save assistant message:', asstMsgErr.message);
          } else {
            log('DB SAVE', `Assistant message saved. Length: ${finalContent.length} chars`);
          }

          // Update conversation timestamp
          const { error: convUpdateErr } = await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
          if (convUpdateErr) {
            logError('DB ERROR', 'Failed to update conversation timestamp:', convUpdateErr.message);
          }
        }

        log('DONE', `Tools: ${allToolCalls.length}, Content: ${finalContent.length} chars, ConvId: ${conversationId}`);

        send({
          type: "done",
          content: finalContent,
          tool_calls: allToolCalls.length > 0 ? allToolCalls : undefined,
          model_used: modelId,
          conversationId: conversationId || undefined,
        });

        // --- STEP 7: Auto-extract memories (background, non-blocking) ---
        extractMemories(messages.slice(-6), modelId).catch(err =>
          logError('MEMORY', 'Auto-extract failed:', err)
        );

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
        logError('REQUEST', 'Unhandled error:', message);
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

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
  create_quiz: "📝 Generating quiz...",
  get_quiz_history: "📚 Fetching quiz history...",
  get_quiz_stats: "📊 Analyzing study stats...",
};

const BASE_SYSTEM_INSTRUCTION = `Kamu Nimbus — sahabat karib Zhafran. Bukan asisten formal, bukan robot.

CARA NGOMONG:
- Bahasa santai, campur Indo-English, slang. Panggil "lu/bro".
- Kata kasar boleh (anjir, bangsat, kampret) tapi HANYA konteks akrab bercanda.
- JANGAN pernah pakai bahasa kaku ("Tentu, saya dengan senang hati..."). Bilang "oke gw bantuin" / "sini gw cek".
- Punya opini, bisa nge-roast ringan, tapi tau kapan serius.
- Kalau curhat berat → langsung mode serius, no sarcasm.

TOOLS:
- Target/goals, expense, income, web search → SELALU gunakan tools saat diminta aksi.
- Obrolan biasa → respond natural tanpa tools.
- Setelah tool execution → SELALU beri respons informatif.
- JANGAN panggil get_memories kecuali user SECARA EKSPLISIT bertanya tentang hal yang pernah disimpan (contoh: "apa yang lu inget?", "lu tau gak gw suka apa?"). Memory sudah otomatis di-inject ke context di bawah — kamu TIDAK PERLU fetch ulang.

KEUANGAN (CRITICAL):
- PEMASUKAN (create_income): "di TF ortu", "gajian", "dapat cashback", "dikasih", "terima"
- PENGELUARAN (create_expense): "beli", "bayar", "jajan", "habis buat"
- AMBIGU → tanya dulu, JANGAN langsung eksekusi.

MULTI-AKSI: Jika user minta 2+ aksi sekaligus, jalankan SEMUA satu per satu. Jangan skip.`;

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

  // Inject personality if provided (compact format)
  if (personality && personality.preset) {
    instruction += `[P] ${personality.preset}`;
    if (personality.language) instruction += ` | lang:${personality.language}`;
    if (personality.responseStyle) instruction += ` | style:${personality.responseStyle}`;
    if (personality.userName) instruction += ` | name:${personality.userName}`;
    if (personality.customInstructions) instruction += `\n${personality.customInstructions}`;
    instruction += '\n\n';
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

const maxTokensMap: Record<string, number> = { flash: 256, search: 1024, think: 1500 };

async function callMaia(modelId: string, messages: Record<string, unknown>[], useTools: boolean, maxTokens = 1024) {
  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    temperature: 0.7,
    max_tokens: maxTokens,
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

async function callMaiaStream(
  modelId: string,
  messages: Record<string, unknown>[],
  onChunk: (accumulated: string) => void,
  maxTokens = 1024,
): Promise<string> {
  const body = {
    model: modelId,
    messages,
    temperature: 0.7,
    max_tokens: maxTokens,
    stream: true,
  };

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

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE lines from buffer
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          onChunk(accumulated);
        }
      } catch {
        // Skip unparseable chunks
      }
    }
  }

  return accumulated;
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
  const maxTokens = maxTokensMap[mode as keyof typeof maxTokensMap] || 1024;
  const memoriesContext = await fetchMemoriesContext();
  const systemInstruction = buildSystemInstruction(personality) + getModeInstruction(mode) + memoriesContext;
  log('SYSTEM', `instruction length=${systemInstruction.length}, useTools=${useTools}, mode=${mode}, maxTokens=${maxTokens}`);
  const historyLimit = mode === 'flash' ? 4 : mode === 'search' ? 8 : 10;
  const apiMessages = [
    { role: "system", content: systemInstruction },
    ...messages.slice(-historyLimit),
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
        const data = await callMaia(modelId, apiMessages, useTools, maxTokens);
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
                if (mode === 'flash') {
                  // Skip continuation check — prioritize speed
                  log('TOOL LOOP', `Round ${round}: Flash mode: skipping continuation check`);
                  break;
                }
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
                const checkData = await callMaia(modelId, toolCallMessages, useTools, maxTokens);
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
              const nextData = await callMaia(modelId, toolCallMessages, useTools, maxTokens);
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

        // --- STEP 5: Handle response with streaming ---
        const allToolCalls = [...toolResults, ...parsedActions];
        let finalContent = assistantMsg.content || "";
        let streamed = false;

        // Case 1: Content empty after tool calls — retry with streaming
        if (!finalContent.trim() && allToolCalls.length > 0) {
          log('EMPTY RESP', `Content empty after ${allToolCalls.length} tool calls. Retrying with stream...`);

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

            finalContent = await callMaiaStream(modelId, retryMessages, (accumulated) => {
              send({ type: "chunk", content: accumulated });
            }, maxTokens);
            streamed = true;
            log('EMPTY RESP', `Retry stream result: "${finalContent.substring(0, 100)}..."`);
          } catch (retryErr) {
            logError('EMPTY RESP', 'Retry stream failed:', retryErr);
          }
        }

        // Case 2: Has content from tool flow — re-stream for real streaming experience
        if (!streamed && finalContent.trim() && allToolCalls.length > 0) {
          send({ type: "status", text: "Generating response..." });
          try {
            const streamMessages = [...apiMessages];
            if (toolResults.length > 0) {
              const toolSummary = toolResults.map(tc => `${tc.name}: ${tc.result}`).join('\n');
              streamMessages.push({
                role: "user",
                content: `Kamu baru saja menjalankan tool berikut:\n${toolSummary}\n\nBerikan respons natural. JANGAN panggil tool.`
              });
            }
            const streamedContent = await callMaiaStream(modelId, streamMessages, (accumulated) => {
              send({ type: "chunk", content: accumulated });
            }, maxTokens);
            if (streamedContent.trim()) {
              finalContent = streamedContent;
            } else {
              send({ type: "chunk", content: finalContent });
            }
          } catch {
            send({ type: "chunk", content: finalContent });
          }
          streamed = true;
        }

        // Case 3: No content and no tools — direct stream from model
        if (!streamed && !finalContent.trim() && allToolCalls.length === 0) {
          log('EMPTY RESP', 'Content empty, no tools. Streaming directly...');
          try {
            finalContent = await callMaiaStream(modelId, apiMessages, (accumulated) => {
              send({ type: "chunk", content: accumulated });
            }, maxTokens);
            log('EMPTY RESP', `Direct stream result: "${finalContent.substring(0, 100)}..."`);
          } catch (retryErr) {
            logError('EMPTY RESP', 'Direct stream failed:', retryErr);
          }
          streamed = true;
        }

        // Case 4: Has content, no tools — re-stream for real TTFT
        if (!streamed && finalContent.trim() && allToolCalls.length === 0) {
          send({ type: "status", text: "Generating response..." });
          try {
            const streamedContent = await callMaiaStream(modelId, apiMessages, (accumulated) => {
              send({ type: "chunk", content: accumulated });
            }, maxTokens);
            if (streamedContent.trim()) {
              finalContent = streamedContent;
            } else {
              send({ type: "chunk", content: finalContent });
            }
          } catch {
            send({ type: "chunk", content: finalContent });
          }
          streamed = true;
        }

        // FINAL fallback — generate summary manually
        if (!finalContent.trim()) {
          logError('EMPTY RESP', 'All retries failed. Using manual fallback.');

          if (allToolCalls.length > 0) {
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

          // Send fallback content as final chunk
          send({ type: "chunk", content: finalContent });
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
        // Use last 6 messages for context (3 user + 3 assistant turns)
        const MEMORY_EXTRACTION_CONTEXT_SIZE = 6;
        extractMemories(messages.slice(-MEMORY_EXTRACTION_CONTEXT_SIZE), modelId).catch(err =>
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

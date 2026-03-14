import { NextRequest } from 'next/server';
import { tools } from '@/lib/tools';
import { executeTool } from '@/lib/tool-executor';
import { getModelById } from '@/lib/models';

// Vercel Serverless: max 30 detik (Hobby plan bisa sampai 60 detik)
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const SYSTEM_INSTRUCTION = `Kamu adalah Zhafran Hub AI, asisten personal Zhafran yang cerdas dan helpful.
Kamu bisa mengelola target/goals Zhafran menggunakan tools yang tersedia.
Selalu respond dalam Bahasa Indonesia yang casual dan friendly.
Saat user meminta aksi (buat target, update progress, dll), SELALU gunakan tools.
Saat user hanya ngobrol biasa, respond secara natural tanpa tools.
Jika user melaporkan progress tapi tidak menyebut angka spesifik, tanyakan dulu.
Setelah mengeksekusi tool, berikan respons yang informatif dan encouraging.`;

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
  const { messages, model: modelId } = await req.json();

  const model = getModelById(modelId);
  if (!model) {
    return new Response(
      JSON.stringify({ error: `Model "${modelId}" not found.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const useTools = model.supports_tools;
  const apiMessages = [
    { role: "system", content: SYSTEM_INSTRUCTION },
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

        // --- STEP 2: Handle tool calls (agentic loop) ---
        if (assistantMsg.tool_calls && useTools) {
          const toolCallMessages = [...apiMessages, assistantMsg];

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

          // --- STEP 3: Kirim tool results ke Maia untuk response final ---
          send({ type: "status", message: "✍️ Generating response..." });

          const data2 = await callMaia(modelId, toolCallMessages, useTools);
          assistantMsg = data2.choices[0].message;

          // Handle jika model memanggil tool lagi (rare tapi mungkin)
          if (assistantMsg.tool_calls && useTools) {
            for (const toolCall of assistantMsg.tool_calls) {
              const fnName = toolCall.function.name;
              const fnArgs = JSON.parse(toolCall.function.arguments);

              send({ type: "tool_start", name: fnName, args: fnArgs, message: `🔧 Executing: ${fnName}` });
              const result = await executeTool(fnName, fnArgs);
              toolResults.push({ name: fnName, args: fnArgs, result });
              send({ type: "tool_result", name: fnName, result });

              toolCallMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
              });
            }

            send({ type: "status", message: "✍️ Finalizing..." });
            const data3 = await callMaia(modelId, toolCallMessages, useTools);
            assistantMsg = data3.choices[0].message;
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
            } catch {}
          }
        }

        // --- STEP 5: Kirim response final ---
        const allToolCalls = [...toolResults, ...parsedActions];
        send({
          type: "done",
          content: assistantMsg.content || "Aksi berhasil dijalankan.",
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

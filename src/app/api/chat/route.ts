import { NextRequest, NextResponse } from 'next/server';
import { tools } from '@/lib/tools';
import { executeTool } from '@/lib/tool-executor';
import { getModelById } from '@/lib/models';

const SYSTEM_INSTRUCTION = `Kamu adalah Nimbus Brain AI, asisten personal yang cerdas dan helpful.
Kamu bisa mengelola target/goals menggunakan tools yang tersedia.
Selalu respond dalam Bahasa Indonesia yang casual dan friendly.
Saat user meminta aksi (buat target, update progress, dll), SELALU gunakan tools.
Saat user hanya ngobrol biasa, respond secara natural tanpa tools.
Jika user melaporkan progress tapi tidak menyebut angka spesifik, tanyakan dulu.
Setelah mengeksekusi tool, berikan respons yang informatif dan encouraging.`;

interface ChatRequestMessage {
  role: string;
  content: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

export async function POST(req: NextRequest) {
  const { messages, model: modelId } = await req.json() as {
    messages: ChatRequestMessage[];
    model: string;
  };

  const model = getModelById(modelId);
  if (!model) {
    return NextResponse.json({ error: `Model "${modelId}" not found.` }, { status: 400 });
  }

  const apiMessages: ChatRequestMessage[] = [
    { role: "system", content: SYSTEM_INSTRUCTION },
    ...messages.slice(-10)
  ];

  const useTools = model.supports_tools;

  try {
    const buildRequestBody = (msgs: ChatRequestMessage[]) => {
      const body: Record<string, unknown> = {
        model: modelId,
        messages: msgs,
        temperature: 0.7,
        max_tokens: 1024,
      };
      if (useTools) {
        body.tools = tools;
        body.tool_choice = "auto";
      }
      return body;
    };

    let response = await fetch(`${process.env.MAIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MAIA_API_KEY}`,
      },
      body: JSON.stringify(buildRequestBody(apiMessages)),
    });

    let data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'Maia API error' },
        { status: response.status }
      );
    }

    let assistantMessage = data.choices[0].message;
    const toolResults: { name: string; args: Record<string, unknown>; result: string }[] = [];

    while (assistantMessage.tool_calls && useTools) {
      const toolCallMessages = [...apiMessages, assistantMessage];

      for (const toolCall of assistantMessage.tool_calls) {
        const fnName: string = toolCall.function.name;
        const fnArgs: Record<string, unknown> = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(fnName, fnArgs);

        toolResults.push({ name: fnName, args: fnArgs, result });

        toolCallMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      response = await fetch(`${process.env.MAIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MAIA_API_KEY}`,
        },
        body: JSON.stringify(buildRequestBody(toolCallMessages)),
      });

      data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { error: data.error?.message || 'Maia API error' },
          { status: response.status }
        );
      }

      assistantMessage = data.choices[0].message;
    }

    // Fallback for non-tool models: parse JSON action from response
    const parsedActions: { name: string; args: Record<string, unknown>; result: string }[] = [];
    if (!useTools && assistantMessage.content) {
      const jsonMatch = assistantMessage.content.match(/```json\n?(\{[\s\S]*?\})\n?```/);
      if (jsonMatch) {
        try {
          const action = JSON.parse(jsonMatch[1]);
          if (action.action && action.params) {
            const result = await executeTool(action.action, action.params);
            parsedActions.push({ name: action.action, args: action.params, result });
            assistantMessage.content = assistantMessage.content
              .replace(/```json[\s\S]*?```/, '')
              .trim() + `\n\n✅ ${result}`;
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON action from model response:', parseError);
        }
      }
    }

    const finalContent = assistantMessage.content || "Aksi berhasil dijalankan.";
    const allToolCalls = [...toolResults, ...parsedActions];

    return NextResponse.json({
      content: finalContent,
      tool_calls: allToolCalls.length > 0 ? allToolCalls : undefined,
      model_used: modelId,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getProviderConfig, DEFAULT_MODEL_ID, DEFAULT_PROVIDER_ID } from '@/lib/models';
import type { ProviderId } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function log(tag: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}]`, ...args);
}

const NOTIFICATION_SYSTEM_PROMPT = `Generate a short notification reminder in Indonesian.

Context: User created a scheduled task earlier. Now it's time to remind them.

Output ONLY valid JSON with this exact structure:
{"title":"...","short_label":"...","message":"...","extra_line":"..."}

Rules for each field:

title:
- max 6 words, max 60 characters
- clear, human-sounding, no snake_case
- examples: "Waktunya masak", "Meeting sebentar lagi", "Fokus belajar dulu"

short_label:
- max 4 words, max 40 characters
- examples: "Meal prep moment", "Deep work time", "Quick reminder"

message:
- 1 sentence reminder, max 160 characters
- must reference the original user intent naturally

extra_line:
- optional short reinforcement, max 120 characters
- friendly, natural tone
- examples: "Kalau ditunda lagi, mie instan menang.", "Future you bakal berterima kasih."

Constraints:
- Do not mention AI, system, scheduling, tokens, or tools.
- Keep tone natural and helpful.
- Avoid cringe motivational phrases.
- Keep it short.
- Output ONLY the JSON object. No markdown, no explanation.`;

async function callProviderSimple(
  providerId: ProviderId,
  modelId: string,
  messages: Record<string, unknown>[],
): Promise<string> {
  const provider = getProviderConfig(providerId);
  if (!provider) throw new Error(`Provider "${providerId}" not found.`);

  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    temperature: 0.7,
    max_tokens: 300,
  };

  if (providerId === 'openrouter') {
    body.provider = { require_parameters: true };
    body.route = "fallback";
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: provider.getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

interface NotificationContent {
  title: string;
  short_label: string;
  message: string;
  extra_line: string;
}

function parseNotificationJSON(raw: string): NotificationContent | null {
  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) return null;

    const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    if (!parsed.title || !parsed.message) return null;

    return {
      title: String(parsed.title).slice(0, 60),
      short_label: String(parsed.short_label || '').slice(0, 40),
      message: String(parsed.message).slice(0, 160),
      extra_line: String(parsed.extra_line || '').slice(0, 120),
    };
  } catch {
    return null;
  }
}

function fallbackNotification(taskName: string, prompt: string): NotificationContent {
  return {
    title: `⏰ ${taskName}`.slice(0, 60),
    short_label: 'Reminder',
    message: prompt.slice(0, 160),
    extra_line: '',
  };
}

export async function GET(request: NextRequest) {
  // Support lookup by ID (new) or by name (legacy fallback)
  const taskId = request.nextUrl.searchParams.get('id');
  const taskName = request.nextUrl.searchParams.get('task');

  if (!taskId && !taskName) {
    return NextResponse.json({ error: 'Missing id or task parameter' }, { status: 400 });
  }

  log('SCHEDULER', `Received trigger — id: "${taskId}", name: "${taskName}"`);

  // Find matching task in database
  let query = supabase.from('scheduled_tasks').select('*').eq('status', 'active');
  if (taskId) {
    query = query.eq('id', taskId);
  } else {
    query = query.eq('name', taskName!);
  }
  const { data: task, error } = await query.single();

  if (error || !task) {
    log('SCHEDULER', `Task not found or inactive — id: "${taskId}", name: "${taskName}"`);
    return NextResponse.json({ error: `Task not found or inactive` }, { status: 404 });
  }

  log('SCHEDULER', `Executing task: "${task.name}" — prompt: "${task.prompt}" — run_once: ${task.run_once}`);

  // --- Generate notification content via AI ---
  const taskModelId: string = task.model_used || DEFAULT_MODEL_ID;
  const taskProviderId: ProviderId = (task.provider_used as ProviderId) || DEFAULT_PROVIDER_ID;

  let notifContent: NotificationContent;

  try {
    const userPrompt = `Task name: "${task.name}"\nOriginal user request: "${task.prompt}"\n\nGenerate the notification JSON now.`;

    log('SCHEDULER', `Generating AI notification — model: ${taskModelId}, provider: ${taskProviderId}`);

    const aiResult = await callProviderSimple(taskProviderId, taskModelId, [
      { role: 'system', content: NOTIFICATION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    log('SCHEDULER', `AI raw response: ${aiResult.substring(0, 200)}`);

    const parsed = parseNotificationJSON(aiResult);
    if (parsed) {
      notifContent = parsed;
      log('SCHEDULER', `AI notification parsed successfully`);
    } else {
      log('SCHEDULER', `Failed to parse AI response, trying fallback model...`);
      // Retry with default model if different
      if (taskModelId !== DEFAULT_MODEL_ID || taskProviderId !== DEFAULT_PROVIDER_ID) {
        const retryResult = await callProviderSimple(DEFAULT_PROVIDER_ID, DEFAULT_MODEL_ID, [
          { role: 'system', content: NOTIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ]);
        const retryParsed = parseNotificationJSON(retryResult);
        notifContent = retryParsed || fallbackNotification(task.name, task.prompt);
      } else {
        notifContent = fallbackNotification(task.name, task.prompt);
      }
    }
  } catch (aiErr) {
    log('SCHEDULER', `AI generation failed: ${aiErr instanceof Error ? aiErr.message : 'unknown'}`);
    // Fallback to default model
    try {
      if (taskModelId !== DEFAULT_MODEL_ID || taskProviderId !== DEFAULT_PROVIDER_ID) {
        const userPrompt = `Task name: "${task.name}"\nOriginal user request: "${task.prompt}"\n\nGenerate the notification JSON now.`;
        const fallbackResult = await callProviderSimple(DEFAULT_PROVIDER_ID, DEFAULT_MODEL_ID, [
          { role: 'system', content: NOTIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ]);
        const fallbackParsed = parseNotificationJSON(fallbackResult);
        notifContent = fallbackParsed || fallbackNotification(task.name, task.prompt);
        log('SCHEDULER', `Fallback model succeeded`);
      } else {
        notifContent = fallbackNotification(task.name, task.prompt);
      }
    } catch {
      notifContent = fallbackNotification(task.name, task.prompt);
      log('SCHEDULER', `All AI attempts failed, using static fallback`);
    }
  }

  // --- Insert notification with structured content ---
  let notificationCreated = false;
  const { error: err1 } = await supabase.from('notifications').insert({
    title: notifContent.title,
    message: notifContent.message,
    label: notifContent.short_label || null,
    extra_line: notifContent.extra_line || null,
    type: 'info',
    task_id: task.id,
  });
  if (err1) {
    log('SCHEDULER', `Insert with new columns failed (${err1.message}), retrying with basic columns...`);
    const { error: err2 } = await supabase.from('notifications').insert({
      title: notifContent.title,
      message: notifContent.message,
      type: 'info',
      task_id: task.id,
    });
    if (err2) {
      const { error: err3 } = await supabase.from('notifications').insert({
        title: notifContent.title,
        message: notifContent.message,
        type: 'info',
      });
      if (err3) {
        log('SCHEDULER', `Failed to create notification: ${err3.message}`);
      } else {
        notificationCreated = true;
      }
    } else {
      notificationCreated = true;
    }
  } else {
    notificationCreated = true;
  }

  if (notificationCreated) {
    log('SCHEDULER', `Notification created for task "${task.name}" — title: "${notifContent.title}"`);
  }

  // Handle one-time tasks: only mark completed if notification was created successfully
  let cleanedUp = false;
  if (task.run_once) {
    if (!notificationCreated) {
      log('SCHEDULER', `Skipping one-time task completion — notification insert failed for "${task.name}"`);
    } else {
      log('SCHEDULER', `One-time task "${task.name}" — marking completed and cleaning up EasyCron`);

      await supabase
        .from('scheduled_tasks')
        .update({ status: 'completed' })
        .eq('id', task.id);

      if (task.easycron_id) {
        const MAX_CRON_DELETE_RETRIES = 2;
        for (let attempt = 0; attempt < MAX_CRON_DELETE_RETRIES; attempt++) {
          try {
            const body = new URLSearchParams();
            body.append('token', process.env.EASYCRON_API_KEY || '');
            body.append('cron_job_id', task.easycron_id);

            const easycronRes = await fetch('https://www.easycron.com/rest/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: body.toString(),
            });
            const easycronData = await easycronRes.json();
            if (easycronData.status === 'success') {
              log('SCHEDULER', `EasyCron job ${task.easycron_id} deleted (attempt ${attempt + 1})`);
              cleanedUp = true;
              break;
            } else {
              log('SCHEDULER', `EasyCron delete attempt ${attempt + 1} failed: ${JSON.stringify(easycronData)}`);
            }
          } catch (err) {
            log('SCHEDULER', `EasyCron delete attempt ${attempt + 1} error: ${err instanceof Error ? err.message : 'unknown'}`);
          }
        }
      } else {
        cleanedUp = true;
      }
    }
  }

  return NextResponse.json({
    status: 'ok',
    task: task.name,
    task_id: task.id,
    notification: {
      title: notifContent.title,
      label: notifContent.short_label,
      message: notifContent.message,
      extra_line: notifContent.extra_line,
    },
    run_once: task.run_once,
    completed: task.run_once && notificationCreated,
    easycron_deleted: cleanedUp,
    notification_created: notificationCreated,
    executed_at: new Date().toISOString(),
  });
}

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

async function callProviderWithTimeout(
  providerId: ProviderId,
  modelId: string,
  messages: Record<string, unknown>[],
  timeoutMs = 12000,
): Promise<string> {
  const provider = getProviderConfig(providerId);
  if (!provider) throw new Error(`Provider "${providerId}" not found.`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
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
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

interface NotificationContent {
  title: string;
  short_label: string;
  message: string;
  extra_line: string;
}

function parseNotificationJSON(raw: string): NotificationContent | null {
  try {
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

function staticNotification(taskName: string, prompt: string): NotificationContent {
  return {
    title: `⏰ ${taskName}`.slice(0, 60),
    short_label: 'Reminder',
    message: prompt.slice(0, 160),
    extra_line: '',
  };
}

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('id');
  const taskName = request.nextUrl.searchParams.get('task');

  if (!taskId && !taskName) {
    return NextResponse.json({ error: 'Missing id or task parameter' }, { status: 400 });
  }

  log('SCHEDULER', `Received trigger — id: "${taskId}", name: "${taskName}"`);

  // ── STEP 1: Fetch task ──
  let query = supabase.from('scheduled_tasks').select('*');
  if (taskId) {
    query = query.eq('id', taskId);
  } else {
    query = query.eq('name', taskName!);
  }
  const { data: task, error } = await query.single();

  if (error || !task) {
    log('SCHEDULER', `Task not found — id: "${taskId}", name: "${taskName}"`);
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (task.status === 'completed') {
    log('SCHEDULER', `Task already completed — "${task.name}" (${task.id}), skipping`);
    return NextResponse.json({ status: 'skipped', reason: 'already completed', task: task.name, task_id: task.id });
  }

  log('SCHEDULER', `Executing task: "${task.name}" — status: ${task.status} — run_once: ${task.run_once}`);

  // ── STEP 2: Insert notification IMMEDIATELY with static content ──
  // This guarantees a notification exists regardless of AI success/timeout
  const staticContent = staticNotification(task.name, task.prompt);

  const { data: notifRow, error: insertErr } = await supabase
    .from('notifications')
    .insert({
      title: staticContent.title,
      message: staticContent.message,
      label: staticContent.short_label,
      extra_line: null,
      type: 'info',
      task_id: task.id,
    })
    .select('id')
    .single();

  if (insertErr) {
    log('SCHEDULER', `Notification insert failed: ${insertErr.message}`);
    return NextResponse.json({
      status: 'error',
      task: task.name,
      task_id: task.id,
      error: `Notification insert failed: ${insertErr.message}`,
    }, { status: 500 });
  }

  const notifId: string = notifRow.id;
  log('SCHEDULER', `Static notification created (${notifId}) for task "${task.name}"`);

  // ── STEP 3: Try AI upgrade (best-effort, with timeout) ──
  const taskModelId: string = task.model_used || DEFAULT_MODEL_ID;
  const taskProviderId: ProviderId = (task.provider_used as ProviderId) || DEFAULT_PROVIDER_ID;
  const userPrompt = `Task name: "${task.name}"\nOriginal user request: "${task.prompt}"\n\nGenerate the notification JSON now.`;

  let aiUpgraded = false;

  try {
    log('SCHEDULER', `AI generation — model: ${taskModelId}, provider: ${taskProviderId}`);

    const aiResult = await callProviderWithTimeout(taskProviderId, taskModelId, [
      { role: 'system', content: NOTIFICATION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    let parsed = parseNotificationJSON(aiResult);

    // Retry with default model if parse failed and using a different model
    if (!parsed && (taskModelId !== DEFAULT_MODEL_ID || taskProviderId !== DEFAULT_PROVIDER_ID)) {
      log('SCHEDULER', `AI parse failed, retrying with default model...`);
      const retryResult = await callProviderWithTimeout(DEFAULT_PROVIDER_ID, DEFAULT_MODEL_ID, [
        { role: 'system', content: NOTIFICATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);
      parsed = parseNotificationJSON(retryResult);
    }

    if (parsed) {
      // Update the already-created notification with AI content
      const { error: updateErr } = await supabase
        .from('notifications')
        .update({
          title: parsed.title,
          message: parsed.message,
          label: parsed.short_label || null,
          extra_line: parsed.extra_line || null,
        })
        .eq('id', notifId);

      if (!updateErr) {
        aiUpgraded = true;
        log('SCHEDULER', `Notification upgraded with AI content`);
      } else {
        log('SCHEDULER', `AI update failed: ${updateErr.message} — static content preserved`);
      }
    } else {
      log('SCHEDULER', `AI parse failed — static content preserved`);
    }
  } catch (aiErr) {
    const msg = aiErr instanceof Error ? aiErr.message : 'unknown';
    log('SCHEDULER', `AI generation failed: ${msg} — static content preserved`);
  }

  // ── STEP 4: Handle one-time tasks ──
  let cleanedUp = false;
  if (task.run_once) {
    log('SCHEDULER', `One-time task "${task.name}" — marking completed`);

    const { error: updateErr } = await supabase
      .from('scheduled_tasks')
      .update({ status: 'completed' })
      .eq('id', task.id);

    if (updateErr) {
      log('SCHEDULER', `Failed to mark task completed: ${updateErr.message}`);
    }

    if (task.easycron_id) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const body = new URLSearchParams();
          body.append('token', process.env.EASYCRON_API_KEY || '');
          body.append('cron_job_id', task.easycron_id);

          const res = await fetch('https://www.easycron.com/rest/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
          });
          const data = await res.json();
          if (data.status === 'success') {
            log('SCHEDULER', `EasyCron job ${task.easycron_id} deleted (attempt ${attempt + 1})`);
            cleanedUp = true;
            break;
          }
          log('SCHEDULER', `EasyCron delete attempt ${attempt + 1} failed: ${JSON.stringify(data)}`);
        } catch (err) {
          log('SCHEDULER', `EasyCron delete attempt ${attempt + 1} error: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    } else {
      cleanedUp = true;
    }
  }

  // ── STEP 5: Return response ──
  return NextResponse.json({
    status: 'ok',
    task: task.name,
    task_id: task.id,
    notification_id: notifId,
    ai_upgraded: aiUpgraded,
    run_once: task.run_once,
    completed: task.run_once,
    easycron_deleted: cleanedUp,
    executed_at: new Date().toISOString(),
  });
}

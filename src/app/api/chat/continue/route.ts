import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/continue
 * 
 * Creates a new conversation thread to continue a truncated AI notification.
 * Returns the conversation ID and pre-populated messages so the frontend
 * can navigate to the chat page and trigger the AI to continue.
 * 
 * Body: { notification_id, title, message, original_prompt, extra_line? }
 */
export async function POST(req: NextRequest) {
  const correlationId = logger.createCorrelationId();
  
  try {
    const body = await req.json();
    const { notification_id, title, message, original_prompt, extra_line } = body;

    if (!notification_id || !message || !original_prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: notification_id, message, original_prompt' },
        { status: 400 }
      );
    }

    logger.info('AI', 'Continue conversation requested', {
      notification_id,
      original_prompt_len: original_prompt?.length,
      message_len: message?.length,
    }, correlationId);

    // Create a new conversation
    const convTitle = `📝 Lanjutan: ${(title || message).slice(0, 30)}...`;
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .insert({ title: convTitle })
      .select()
      .single();

    if (convErr || !conversation) {
      logger.error('DB', 'Failed to create continuation conversation', {
        code: 'CONV_CREATE_FAILED',
        error: convErr?.message || 'No data returned',
        correlationId,
      });
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      );
    }

    // Build the continuation prompt that will be the "user" message
    // Sanitize inputs: limit length and strip potential prompt injection markers
    const sanitize = (s: string, maxLen: number) => 
      String(s || '').slice(0, maxLen).replace(/```/g, '').trim();
    
    const safePrompt = sanitize(original_prompt, 2000);
    const safeMessage = sanitize(message, 1000);
    const safeExtra = extra_line ? sanitize(extra_line, 200) : '';
    const truncatedContent = [safeMessage, safeExtra].filter(Boolean).join('\n');
    
    const continuationPrompt = `Lanjutkan teks berikut ini secara presisi dari titik terakhir. Jangan mengulang apa yang sudah ada, langsung lanjutkan.

Konteks permintaan awal user:
"${safePrompt}"

Teks yang terpotong (lanjutkan dari sini):
---
${truncatedContent}
---

Lanjutkan teks di atas dengan tepat dan lengkap. Gunakan bahasa Indonesia.`;

    // Note: We do NOT save the user message here. The chat page's handleSend()
    // will create and save the user message when it auto-sends the continuation prompt.
    // This avoids duplicate messages in the conversation.

    // Mark notification as read
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification_id);

    logger.info('AI', 'Continuation conversation created', {
      conversation_id: conversation.id,
      notification_id,
    }, correlationId);

    return NextResponse.json({
      success: true,
      conversation_id: conversation.id,
      continuation_prompt: continuationPrompt,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('AI', 'Continue conversation failed', {
      code: 'CONTINUE_FAILED',
      error: msg,
      correlationId,
    });
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}

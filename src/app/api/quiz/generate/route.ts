export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface GenerateBody {
  topic: string;
  numQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface RawQuestion {
  question?: string;
  options?: string[];
  correct?: number;
  explanation?: string;
}

interface ValidatedQuestion {
  id: number;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export async function POST(req: NextRequest) {
  const correlationId = logger.createCorrelationId();
  const start = Date.now();
  try {
    const body: GenerateBody = await req.json();
    const { topic, numQuestions: rawNum, difficulty: rawDiff } = body;

    logger.ai('Quiz generation started', { topic, numQuestions: rawNum, difficulty: rawDiff }, correlationId);

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json(
        { error: 'Topic is required.' },
        { status: 400 }
      );
    }

    const numQuestions = Math.min(20, Math.max(3, Number(rawNum) || 5));
    const difficulty: 'easy' | 'medium' | 'hard' = (['easy', 'medium', 'hard'] as const).includes(rawDiff as 'easy' | 'medium' | 'hard') ? rawDiff! : 'medium';

    // Generate quiz questions using AI
    const quizPrompt = `Generate ${numQuestions} multiple choice questions tentang "${topic.trim()}", difficulty: ${difficulty}.

IMPORTANT: Langsung generate valid JSON array ONLY, tanpa penjelasan atau teks tambahan apa pun. Setiap question object harus punya:
- question (string): pertanyaan dalam Bahasa Indonesia
- options (array of 4 strings): 4 pilihan jawaban dalam Bahasa Indonesia
- correct (number 0-3): index jawaban benar
- explanation (string): penjelasan singkat kenapa jawaban itu benar dalam Bahasa Indonesia

Format EXACT yang diharapkan:
[
  {
    "question": "Pertanyaan di sini?",
    "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
    "correct": 1,
    "explanation": "Penjelasan jawaban benar."
  }
]

JSON ARRAY ONLY. NO other text before or after.`;

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: 'You are a quiz generator. Langsung keluarkan valid JSON array saja. No markdown, no explanation, no additional text.' },
          { role: 'user', content: quizPrompt }
        ],
        temperature: 0.7,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      logger.error('AI', 'Quiz AI generation failed', { code: 'AI_GENERATION_FAIL', data: { status: response.status }, correlationId });
      return NextResponse.json(
        { error: `Gagal generate quiz (${response.status})` },
        { status: 502 }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || '';

    // Clean up potential markdown code blocks
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse JSON
    let questions;
    try {
      questions = JSON.parse(content);
    } catch {
      // Try to extract JSON array from content
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json(
          { error: 'Gagal parse quiz questions dari AI response.' },
          { status: 502 }
        );
      }
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'AI tidak menghasilkan questions yang valid.' },
        { status: 502 }
      );
    }

    // Validate and number questions
    const validatedQuestions: ValidatedQuestion[] = questions.map((q: RawQuestion, idx: number) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 ||
          typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3 || !q.explanation) {
        throw new Error(`Invalid question format at index ${idx}`);
      }
      return {
        id: idx + 1,
        question: q.question,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation,
      };
    });

    // Save to database
    const { data: quiz, error: dbError } = await supabase
      .from('quizzes')
      .insert({
        topic: topic.trim(),
        difficulty,
        questions: validatedQuestions,
        total_questions: validatedQuestions.length,
      })
      .select()
      .single();

    if (dbError) {
      logger.error('AI', 'Failed to save quiz to DB', { code: 'DB_SAVE_FAIL', error: dbError.message, correlationId });
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Return quiz data without correct answers/explanations for client
    const clientQuestions = validatedQuestions.map((q: ValidatedQuestion) => ({
      id: q.id,
      question: q.question,
      options: q.options,
    }));

    logger.ai('Quiz generated successfully', { quizId: quiz.id, topic: topic.trim(), difficulty, total_questions: validatedQuestions.length, durationMs: Date.now() - start }, correlationId);

    return NextResponse.json({
      id: quiz.id,
      topic: topic.trim(),
      difficulty,
      total_questions: validatedQuestions.length,
      questions: clientQuestions,
      created_at: quiz.created_at,
    });
  } catch (error) {
    logger.error('AI', 'Error generating quiz', { code: 'QUIZ_GENERATE_ERROR', error: error instanceof Error ? error : String(error), correlationId, durationMs: Date.now() - start });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

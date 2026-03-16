import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface GenerateBody {
  topic: string;
  numQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateBody = await req.json();
    const { topic, numQuestions: rawNum, difficulty: rawDiff } = body;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json(
        { error: 'Topic is required.' },
        { status: 400 }
      );
    }

    const numQuestions = Math.min(20, Math.max(3, Number(rawNum) || 5));
    const difficulty = (['easy', 'medium', 'hard'].includes(rawDiff || '') ? rawDiff : 'medium') as string;

    // Generate quiz questions using AI
    const quizPrompt = `Generate ${numQuestions} multiple choice questions tentang "${topic.trim()}", difficulty: ${difficulty}.

IMPORTANT: Output HARUS berupa valid JSON array ONLY, tanpa teks lain. Setiap question object harus punya:
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

    const response = await fetch(`${process.env.MAIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MAIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'zai/glm-4.5-flash',
        messages: [
          { role: 'system', content: 'You are a quiz generator. Output valid JSON only. No markdown, no explanation, just pure JSON array.' },
          { role: 'user', content: quizPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('Quiz AI generation failed:', response.status);
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
    const validatedQuestions = questions.map((q: { question?: string; options?: string[]; correct?: number; explanation?: string }, idx: number) => {
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
      console.error('Failed to save quiz:', dbError);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Return quiz data without correct answers/explanations for client
    const clientQuestions = validatedQuestions.map((q: { id: number; question: string; options: string[] }) => ({
      id: q.id,
      question: q.question,
      options: q.options,
    }));

    return NextResponse.json({
      id: quiz.id,
      topic: topic.trim(),
      difficulty,
      total_questions: validatedQuestions.length,
      questions: clientQuestions,
      created_at: quiz.created_at,
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

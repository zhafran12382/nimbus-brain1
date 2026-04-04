import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface SubmitBody {
  quizId: string;
  answers: number[];
}

export async function POST(req: NextRequest) {
  const correlationId = logger.createCorrelationId();
  try {
    const body: SubmitBody = await req.json();
    const { quizId, answers } = body;

    logger.ai('Quiz submission started', { quizId, answerCount: answers?.length }, correlationId);

    if (!quizId || !answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'Invalid request body. Required: quizId, answers' },
        { status: 400 }
      );
    }

    // Fetch quiz from database
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: 'Quiz not found' },
        { status: 404 }
      );
    }

    const questions: QuizQuestion[] = quiz.questions;

    if (answers.length !== questions.length) {
      return NextResponse.json(
        { error: `Expected ${questions.length} answers, got ${answers.length}` },
        { status: 400 }
      );
    }

    // Calculate score and build results
    let score = 0;
    const results = questions.map((q, idx) => {
      const userAnswer = answers[idx];
      const correct = userAnswer === q.correct;
      if (correct) score++;

      return {
        questionId: q.id,
        question: q.question,
        userAnswer,
        correctAnswer: q.correct,
        correct,
        explanation: q.explanation,
        options: q.options,
      };
    });

    // Save attempt to database
    const { error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: quizId,
        score,
        total: questions.length,
        answers,
      });

    if (attemptError) {
      logger.error('AI', 'Failed to save quiz attempt', { code: 'QUIZ_ATTEMPT_SAVE_FAIL', error: attemptError.message, correlationId });
      // Include warning in response but don't fail the request
      // User experience is prioritized over data consistency
    }

    logger.ai('Quiz submitted successfully', { quizId, score, total: questions.length, attemptSaved: !attemptError }, correlationId);

    return NextResponse.json({
      score,
      total: questions.length,
      results,
      attemptSaved: !attemptError,
    });
  } catch (error) {
    logger.error('AI', 'Error submitting quiz', { code: 'QUIZ_SUBMIT_ERROR', error: error instanceof Error ? error : String(error), correlationId });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

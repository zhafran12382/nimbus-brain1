"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, X, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
}

interface QuizData {
  id: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  total_questions: number;
  questions: QuizQuestion[];
}

interface QuizResult {
  score: number;
  total: number;
  results: {
    questionId: number;
    question: string;
    userAnswer: number;
    correctAnswer: number;
    correct: boolean;
    explanation: string;
    options: string[];
  }[];
}

interface QuizCardProps {
  quizData: QuizData;
}

const difficultyConfig = {
  easy: { label: "Easy", bgClass: "bg-emerald-500/15", textClass: "text-emerald-400", borderClass: "border-emerald-500/30" },
  medium: { label: "Medium", bgClass: "bg-amber-500/15", textClass: "text-amber-400", borderClass: "border-amber-500/30" },
  hard: { label: "Hard", bgClass: "bg-rose-500/15", textClass: "text-rose-400", borderClass: "border-rose-500/30" },
};

export function QuizCard({ quizData }: QuizCardProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    new Array(quizData.total_questions).fill(null)
  );
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const difficulty = difficultyConfig[quizData.difficulty];
  const progress = ((currentQuestionIndex + 1) / quizData.total_questions) * 100;
  const allAnswered = answers.every((a) => a !== null);

  // Animate score
  useEffect(() => {
    if (result && isSubmitted) {
      const targetScore = Math.round((result.score / result.total) * 100);
      const duration = 1000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimatedScore(Math.round(targetScore * eased));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();

      // Confetti for perfect score
      if (result.score === result.total) {
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        }, 500);
      }
    }
  }, [result, isSubmitted]);

  const handleSelectOption = (optionIndex: number) => {
    if (isSubmitted) return;
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < quizData.total_questions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!allAnswered || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quizData.id,
          answers: answers,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit quiz");
      }

      const data = await response.json();
      setResult(data);
      setIsSubmitted(true);
    } catch (error) {
      console.error("Error submitting quiz:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCurrentQuestionIndex(0);
    setAnswers(new Array(quizData.total_questions).fill(null));
    setIsSubmitted(false);
    setResult(null);
    setAnimatedScore(0);
    setExpandedQuestion(null);
  };

  const getScoreColor = (pct: number) => {
    if (pct >= 70) return "text-emerald-400";
    if (pct >= 40) return "text-amber-400";
    return "text-rose-400";
  };

  const getScoreBgColor = (pct: number) => {
    if (pct >= 70) return "from-emerald-500/20 to-emerald-500/5";
    if (pct >= 40) return "from-amber-500/20 to-amber-500/5";
    return "from-rose-500/20 to-rose-500/5";
  };

  // Results View
  if (isSubmitted && result) {
    const scorePct = Math.round((result.score / result.total) * 100);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-[hsl(0_0%_100%_/_0.08)] bg-[hsl(0_0%_6%)] p-5 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <span className="font-medium text-[hsl(0_0%_93%)]">{quizData.topic}</span>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", difficulty.bgClass, difficulty.textClass)}>
            {difficulty.label}
          </span>
        </div>

        {/* Score Display */}
        <div className={cn("rounded-xl p-6 bg-gradient-to-br", getScoreBgColor(scorePct))}>
          <div className="flex flex-col items-center">
            {/* Circular Score */}
            <div className="relative w-24 h-24 mb-3">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  fill="none"
                  stroke="hsl(0 0% 20%)"
                  strokeWidth="8"
                />
                <motion.circle
                  cx="48"
                  cy="48"
                  r="42"
                  fill="none"
                  stroke={scorePct >= 70 ? "hsl(142 76% 36%)" : scorePct >= 40 ? "hsl(43 96% 56%)" : "hsl(0 84% 60%)"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "264", strokeDashoffset: "264" }}
                  animate={{ strokeDashoffset: 264 - (264 * animatedScore) / 100 }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("text-2xl font-bold", getScoreColor(scorePct))}>
                  {animatedScore}%
                </span>
              </div>
            </div>

            <p className={cn("text-3xl font-bold", getScoreColor(scorePct))}>
              {result.score}/{result.total}
            </p>
            <p className="text-sm text-[hsl(0_0%_50%)] mt-1">
              {scorePct >= 70 ? "Excellent! 🎉" : scorePct >= 40 ? "Good effort! 💪" : "Keep practicing! 📚"}
            </p>
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-[hsl(0_0%_50%)] uppercase tracking-wider">Detail Jawaban</p>
          {result.results.map((r, idx) => (
            <div key={idx} className="rounded-xl border border-[hsl(0_0%_100%_/_0.06)] overflow-hidden">
              <button
                onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-[hsl(0_0%_100%_/_0.02)] transition-colors"
              >
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  r.correct ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                )}>
                  {r.correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
                <span className="flex-1 text-sm text-[hsl(0_0%_85%)] line-clamp-1">
                  {r.question}
                </span>
                <ChevronRight className={cn(
                  "h-4 w-4 text-[hsl(0_0%_40%)] transition-transform",
                  expandedQuestion === idx && "rotate-90"
                )} />
              </button>

              <AnimatePresence>
                {expandedQuestion === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-2 border-t border-[hsl(0_0%_100%_/_0.04)] pt-3">
                      {r.options.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className={cn(
                            "rounded-lg px-3 py-2 text-xs",
                            optIdx === r.correctAnswer
                              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                              : optIdx === r.userAnswer && !r.correct
                                ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                                : "bg-[hsl(0_0%_8%)] text-[hsl(0_0%_60%)]"
                          )}
                        >
                          <span className="font-medium mr-2">{String.fromCharCode(65 + optIdx)}.</span>
                          {opt}
                          {optIdx === r.correctAnswer && <Check className="inline h-3 w-3 ml-2" />}
                          {optIdx === r.userAnswer && !r.correct && <X className="inline h-3 w-3 ml-2" />}
                        </div>
                      ))}
                      <div className="rounded-lg bg-[hsl(217_91%_60%_/_0.1)] border border-[hsl(217_91%_60%_/_0.2)] px-3 py-2 mt-2">
                        <p className="text-xs text-[hsl(217_91%_60%)]">
                          <Sparkles className="inline h-3 w-3 mr-1" />
                          {r.explanation}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={handleReset} className="flex-1 gap-2">
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </motion.div>
    );
  }

  // Quiz View
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[hsl(0_0%_100%_/_0.08)] bg-[hsl(0_0%_6%)] overflow-hidden"
    >
      {/* Progress Bar */}
      <div className="h-1 bg-[hsl(0_0%_10%)]">
        <motion.div
          className="h-full bg-[hsl(217_91%_60%)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <span className="font-medium text-[hsl(0_0%_93%)]">{quizData.topic}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", difficulty.bgClass, difficulty.textClass)}>
              {difficulty.label}
            </span>
            <span className="text-xs text-[hsl(0_0%_50%)]">
              {currentQuestionIndex + 1}/{quizData.total_questions}
            </span>
          </div>
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-[15px] text-[hsl(0_0%_93%)] leading-relaxed mb-4">
              <span className="text-[hsl(217_91%_60%)] font-semibold mr-2">Q{currentQuestion.id}.</span>
              {currentQuestion.question}
            </p>

            {/* Options */}
            <div className="space-y-2">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = answers[currentQuestionIndex] === idx;
                return (
                  <motion.button
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left text-sm transition-all",
                      isSelected
                        ? "bg-[hsl(217_91%_60%_/_0.15)] border-[hsl(217_91%_60%_/_0.5)] text-[hsl(217_91%_60%)]"
                        : "bg-transparent border-[hsl(0_0%_100%_/_0.06)] text-[hsl(0_0%_70%)] hover:border-[hsl(0_0%_100%_/_0.12)] hover:bg-[hsl(0_0%_100%_/_0.02)]"
                    )}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                    {option}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>

          {/* Question dots */}
          <div className="flex gap-1">
            {quizData.questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  idx === currentQuestionIndex
                    ? "bg-[hsl(217_91%_60%)] w-4"
                    : answers[idx] !== null
                      ? "bg-[hsl(217_91%_60%_/_0.5)]"
                      : "bg-[hsl(0_0%_20%)]"
                )}
              />
            ))}
          </div>

          {currentQuestionIndex === quizData.total_questions - 1 ? (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!allAnswered || isSubmitting}
              className="gap-1"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
              <Check className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

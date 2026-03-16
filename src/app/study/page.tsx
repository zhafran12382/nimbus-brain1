"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Plus, ChevronRight, Check, X, Sparkles, RotateCcw } from "lucide-react";
import { Quiz, QuizAttempt } from "@/types";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { staggerItem } from "@/lib/animations";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

const difficultyConfig = {
  easy: { label: "Easy", bgClass: "bg-emerald-500/15", textClass: "text-emerald-400", borderClass: "border-emerald-500/30" },
  medium: { label: "Medium", bgClass: "bg-amber-500/15", textClass: "text-amber-400", borderClass: "border-amber-500/30" },
  hard: { label: "Hard", bgClass: "bg-rose-500/15", textClass: "text-rose-400", borderClass: "border-rose-500/30" },
};

type TabType = "new" | "history";

interface QuizWithAttempts extends Quiz {
  bestAttempt?: QuizAttempt;
}

interface QuizStats {
  totalQuizzes: number;
  avgScore: number;
  bestTopic: string | null;
}

export default function StudyPage() {
  const [tab, setTab] = useState<TabType>("new");
  const [quizzes, setQuizzes] = useState<QuizWithAttempts[]>([]);
  const [stats, setStats] = useState<QuizStats>({ totalQuizzes: 0, avgScore: 0, bestTopic: null });
  const [loading, setLoading] = useState(true);

  // Quiz creation form
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<Quiz | null>(null);

  // Quiz taking state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<{
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
  } | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch quizzes
    const { data: quizzesData } = await supabase
      .from("quizzes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch attempts
    const { data: attemptsData } = await supabase
      .from("quiz_attempts")
      .select("*")
      .order("completed_at", { ascending: false });

    const attempts = attemptsData || [];
    const quizzesWithAttempts: QuizWithAttempts[] = (quizzesData || []).map((quiz: Quiz) => {
      const quizAttempts = attempts.filter((a: QuizAttempt) => a.quiz_id === quiz.id);
      const bestAttempt = quizAttempts.length > 0
        ? quizAttempts.reduce((best: QuizAttempt, curr: QuizAttempt) => (curr.score / curr.total) > (best.score / best.total) ? curr : best)
        : undefined;
      return { ...quiz, bestAttempt };
    });

    setQuizzes(quizzesWithAttempts);

    // Calculate stats
    if (attempts.length > 0) {
      const totalScore = attempts.reduce((sum: number, a: QuizAttempt) => sum + a.score, 0);
      const totalQuestions = attempts.reduce((sum: number, a: QuizAttempt) => sum + a.total, 0);
      const avgScore = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

      // Find best topic
      const topicScores: Record<string, { correct: number; total: number }> = {};
      for (const att of attempts) {
        const quiz = quizzesData?.find((q: Quiz) => q.id === att.quiz_id);
        if (quiz) {
          if (!topicScores[quiz.topic]) topicScores[quiz.topic] = { correct: 0, total: 0 };
          topicScores[quiz.topic].correct += att.score;
          topicScores[quiz.topic].total += att.total;
        }
      }

      const topicEntries = Object.entries(topicScores);
      let bestTopic: string | null = null;
      let bestScore = 0;
      for (const [topic, data] of topicEntries) {
        const score = data.correct / data.total;
        if (score > bestScore) {
          bestScore = score;
          bestTopic = topic;
        }
      }

      setStats({ totalQuizzes: attempts.length, avgScore, bestTopic });
    } else {
      setStats({ totalQuizzes: 0, avgScore: 0, bestTopic: null });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Animate score
  useEffect(() => {
    if (quizResult && isSubmitted) {
      const targetScore = Math.round((quizResult.score / quizResult.total) * 100);
      const duration = 1000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimatedScore(Math.round(targetScore * eased));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();

      // Confetti for perfect score
      if (quizResult.score === quizResult.total) {
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        }, 500);
      }
    }
  }, [quizResult, isSubmitted]);

  const handleGenerateQuiz = async () => {
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      // Generate quiz using the API (via chat endpoint with a direct tool call)
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: `Buat quiz tentang ${topic} ${numQuestions} soal difficulty ${difficulty}` }
          ],
          model: "gpt-4o-mini",
          mode: "flash",
        }),
      });

      if (!response.ok) throw new Error("Failed to generate quiz");

      // Parse SSE response to get quiz data
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let quizData: Quiz | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(trimmed.slice(6));
            if (event.type === "done" && event.content) {
              // Check for QUIZ_DATA in content
              const match = event.content.match(/QUIZ_DATA::([^:]+)::({[\s\S]*})/);
              if (match) {
                quizData = JSON.parse(match[2]) as Quiz;
              }
            }
          } catch {
            // Skip malformed events
          }
        }
      }

      if (quizData) {
        setGeneratedQuiz(quizData);
        setAnswers(new Array(quizData.total_questions).fill(null));
        setCurrentQuestionIndex(0);
        setIsSubmitted(false);
        setQuizResult(null);
        fetchData(); // Refresh quiz list
      }
    } catch (error) {
      console.error("Error generating quiz:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectOption = (optionIndex: number) => {
    if (isSubmitted || !generatedQuiz) return;
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmitQuiz = async () => {
    if (!generatedQuiz || answers.some((a) => a === null)) return;

    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: generatedQuiz.id,
          answers,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit quiz");

      const result = await response.json();
      setQuizResult(result);
      setIsSubmitted(true);
      fetchData(); // Refresh stats
    } catch (error) {
      console.error("Error submitting quiz:", error);
    }
  };

  const handleResetQuiz = () => {
    if (generatedQuiz) {
      setAnswers(new Array(generatedQuiz.total_questions).fill(null));
      setCurrentQuestionIndex(0);
      setIsSubmitted(false);
      setQuizResult(null);
      setAnimatedScore(0);
      setExpandedQuestion(null);
    }
  };

  const handleNewQuiz = () => {
    setGeneratedQuiz(null);
    setTopic("");
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setIsSubmitted(false);
    setQuizResult(null);
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

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <Header title="">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-400">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-text-primary">Study</span>
        </div>
      </Header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-text-muted mb-1">📝 Total Quiz</p>
              <p className="text-lg font-bold text-text-primary">
                {stats.totalQuizzes}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-text-muted mb-1">📊 Avg Score</p>
              <p className={cn("text-lg font-bold", getScoreColor(stats.avgScore))}>
                {stats.avgScore}%
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-text-muted mb-1">🏆 Best Topic</p>
              <p className="text-sm font-medium text-text-primary truncate">
                {stats.bestTopic || "-"}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 glass-card rounded-xl w-fit">
            {(["new", "history"] as TabType[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                  tab === t
                    ? "bg-[hsl(217_91%_60%)] text-white"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {t === "new" ? "✨ New Quiz" : "📚 History"}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {tab === "new" && (
            <div className="space-y-6">
              {/* Quiz Creation Form or Active Quiz */}
              {!generatedQuiz ? (
                <div className="glass-card rounded-2xl p-6 space-y-5">
                  <h3 className="text-lg font-semibold text-text-primary">Generate Quiz Baru</h3>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="topic" className="text-text-secondary text-sm">
                        Topik
                      </Label>
                      <Input
                        id="topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="contoh: Fisika Hukum Newton"
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label className="text-text-secondary text-sm">
                        Jumlah Soal: {numQuestions}
                      </Label>
                      <input
                        type="range"
                        min={3}
                        max={20}
                        value={numQuestions}
                        onChange={(e) => setNumQuestions(Number(e.target.value))}
                        className="w-full mt-2 accent-[hsl(217_91%_60%)]"
                      />
                      <div className="flex justify-between text-xs text-text-muted mt-1">
                        <span>3</span>
                        <span>20</span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-text-secondary text-sm mb-2 block">
                        Difficulty
                      </Label>
                      <div className="flex gap-2">
                        {(["easy", "medium", "hard"] as const).map((d) => {
                          const config = difficultyConfig[d];
                          return (
                            <button
                              key={d}
                              onClick={() => setDifficulty(d)}
                              className={cn(
                                "flex-1 py-2 rounded-lg text-sm font-medium transition-all border",
                                difficulty === d
                                  ? cn(config.bgClass, config.textClass, config.borderClass)
                                  : "border-[hsl(0_0%_100%_/_0.06)] text-text-muted hover:text-text-secondary"
                              )}
                            >
                              {config.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateQuiz}
                    disabled={!topic.trim() || isGenerating}
                    className="w-full gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Generate Quiz
                      </>
                    )}
                  </Button>
                </div>
              ) : isSubmitted && quizResult ? (
                // Quiz Results
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card rounded-2xl p-6 space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📝</span>
                      <span className="font-medium text-text-primary">{generatedQuiz.topic}</span>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", difficultyConfig[generatedQuiz.difficulty].bgClass, difficultyConfig[generatedQuiz.difficulty].textClass)}>
                      {difficultyConfig[generatedQuiz.difficulty].label}
                    </span>
                  </div>

                  {/* Score Display */}
                  <div className={cn("rounded-xl p-6 bg-gradient-to-br", getScoreBgColor(Math.round((quizResult.score / quizResult.total) * 100)))}>
                    <div className="flex flex-col items-center">
                      <div className="relative w-24 h-24 mb-3">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="48" cy="48" r="42" fill="none" stroke="hsl(0 0% 20%)" strokeWidth="8" />
                          <motion.circle
                            cx="48"
                            cy="48"
                            r="42"
                            fill="none"
                            stroke={animatedScore >= 70 ? "hsl(142 76% 36%)" : animatedScore >= 40 ? "hsl(43 96% 56%)" : "hsl(0 84% 60%)"}
                            strokeWidth="8"
                            strokeLinecap="round"
                            initial={{ strokeDasharray: "264", strokeDashoffset: "264" }}
                            animate={{ strokeDashoffset: 264 - (264 * animatedScore) / 100 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={cn("text-2xl font-bold", getScoreColor(animatedScore))}>
                            {animatedScore}%
                          </span>
                        </div>
                      </div>
                      <p className={cn("text-3xl font-bold", getScoreColor(Math.round((quizResult.score / quizResult.total) * 100)))}>
                        {quizResult.score}/{quizResult.total}
                      </p>
                      <p className="text-sm text-text-muted mt-1">
                        {Math.round((quizResult.score / quizResult.total) * 100) >= 70 ? "Excellent! 🎉" : Math.round((quizResult.score / quizResult.total) * 100) >= 40 ? "Good effort! 💪" : "Keep practicing! 📚"}
                      </p>
                    </div>
                  </div>

                  {/* Results List */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Detail Jawaban</p>
                    {quizResult.results.map((r, idx) => (
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
                          <span className="flex-1 text-sm text-text-secondary line-clamp-1">{r.question}</span>
                          <ChevronRight className={cn("h-4 w-4 text-text-muted transition-transform", expandedQuestion === idx && "rotate-90")} />
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
                                          : "bg-[hsl(0_0%_8%)] text-text-muted"
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
                    <Button variant="outline" onClick={handleResetQuiz} className="flex-1 gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Try Again
                    </Button>
                    <Button onClick={handleNewQuiz} className="flex-1 gap-2">
                      <Plus className="h-4 w-4" />
                      New Quiz
                    </Button>
                  </div>
                </motion.div>
              ) : (
                // Quiz Taking
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl overflow-hidden"
                >
                  {/* Progress Bar */}
                  <div className="h-1 bg-[hsl(0_0%_10%)]">
                    <motion.div
                      className="h-full bg-[hsl(217_91%_60%)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentQuestionIndex + 1) / generatedQuiz.total_questions) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📝</span>
                        <span className="font-medium text-text-primary">{generatedQuiz.topic}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", difficultyConfig[generatedQuiz.difficulty].bgClass, difficultyConfig[generatedQuiz.difficulty].textClass)}>
                          {difficultyConfig[generatedQuiz.difficulty].label}
                        </span>
                        <span className="text-xs text-text-muted">
                          {currentQuestionIndex + 1}/{generatedQuiz.total_questions}
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
                        <p className="text-[15px] text-text-primary leading-relaxed mb-4">
                          <span className="text-[hsl(217_91%_60%)] font-semibold mr-2">
                            Q{generatedQuiz.questions[currentQuestionIndex].id}.
                          </span>
                          {generatedQuiz.questions[currentQuestionIndex].question}
                        </p>

                        {/* Options */}
                        <div className="space-y-2">
                          {generatedQuiz.questions[currentQuestionIndex].options.map((option, idx) => {
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
                                    : "bg-transparent border-[hsl(0_0%_100%_/_0.06)] text-text-secondary hover:border-[hsl(0_0%_100%_/_0.12)] hover:bg-[hsl(0_0%_100%_/_0.02)]"
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
                        onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                        disabled={currentQuestionIndex === 0}
                        className="gap-1"
                      >
                        <ChevronRight className="h-4 w-4 rotate-180" />
                        Prev
                      </Button>

                      {/* Question dots */}
                      <div className="flex gap-1">
                        {generatedQuiz.questions.map((_, idx) => (
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

                      {currentQuestionIndex === generatedQuiz.total_questions - 1 ? (
                        <Button
                          size="sm"
                          onClick={handleSubmitQuiz}
                          disabled={answers.some((a) => a === null)}
                          className="gap-1"
                        >
                          Submit
                          <Check className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentQuestionIndex(Math.min(generatedQuiz.total_questions - 1, currentQuestionIndex + 1))}
                          className="gap-1"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-2">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-20 rounded bg-[hsl(0_0%_15%)]" />
                        <div className="flex-1 h-4 rounded bg-[hsl(0_0%_15%)]" />
                        <div className="h-4 w-24 rounded bg-[hsl(0_0%_15%)]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : quizzes.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Belum ada riwayat quiz</p>
                </div>
              ) : (
                <AnimatePresence>
                  {quizzes.map((quiz) => {
                    const config = difficultyConfig[quiz.difficulty];
                    const bestPct = quiz.bestAttempt
                      ? Math.round((quiz.bestAttempt.score / quiz.bestAttempt.total) * 100)
                      : null;

                    return (
                      <motion.div
                        key={quiz.id}
                        variants={staggerItem}
                        initial="hidden"
                        animate="show"
                        exit={{ opacity: 0, x: -20 }}
                        className="glass-card rounded-xl px-4 py-3 flex items-center gap-3"
                      >
                        <span className="text-sm">📝</span>
                        <span className="flex-1 min-w-0 truncate text-sm text-text-primary">
                          {quiz.topic}
                        </span>
                        <span className={cn("shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", config.bgClass, config.textClass)}>
                          {config.label}
                        </span>
                        <span className="text-xs text-text-muted shrink-0">
                          {quiz.total_questions} soal
                        </span>
                        {bestPct !== null ? (
                          <span className={cn("text-sm font-semibold shrink-0", getScoreColor(bestPct))}>
                            {bestPct}%
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted shrink-0">
                            Belum dikerjakan
                          </span>
                        )}
                        <span className="text-[10px] text-text-muted shrink-0">
                          {new Date(quiz.created_at).toLocaleDateString("id-ID")}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

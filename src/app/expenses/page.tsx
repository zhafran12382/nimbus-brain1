"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Plus, Trash2 } from "lucide-react";
import { Expense } from "@/types";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { staggerItem } from "@/lib/animations";

const categoryConfig: Record<string, { emoji: string; color: string; bgClass: string; textClass: string }> = {
  food: { emoji: "🍔", color: "orange", bgClass: "bg-orange-500/15", textClass: "text-orange-400" },
  transport: { emoji: "🚗", color: "blue", bgClass: "bg-blue-500/15", textClass: "text-blue-400" },
  shopping: { emoji: "🛍️", color: "pink", bgClass: "bg-pink-500/15", textClass: "text-pink-400" },
  entertainment: { emoji: "🎮", color: "purple", bgClass: "bg-purple-500/15", textClass: "text-purple-400" },
  health: { emoji: "💊", color: "emerald", bgClass: "bg-emerald-500/15", textClass: "text-emerald-400" },
  education: { emoji: "📚", color: "cyan", bgClass: "bg-cyan-500/15", textClass: "text-cyan-400" },
  bills: { emoji: "📄", color: "red", bgClass: "bg-red-500/15", textClass: "text-red-400" },
  other: { emoji: "📦", color: "gray", bgClass: "bg-zinc-500/15", textClass: "text-zinc-400" },
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState("this_month");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (periodFilter === "this_week") {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      startDate = monday.toISOString().split("T")[0];
      endDate = now.toISOString().split("T")[0];
    } else if (periodFilter === "this_month") {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      endDate = now.toISOString().split("T")[0];
    } else if (periodFilter === "last_month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = lastMonth.toISOString().split("T")[0];
      endDate = lastDay.toISOString().split("T")[0];
    }

    let query = supabase.from("expenses").select("*").order("date", { ascending: false });
    if (startDate) query = query.gte("date", startDate);
    if (endDate) query = query.lte("date", endDate);
    if (categoryFilter !== "all") query = query.eq("category", categoryFilter);

    const { data } = await query;
    setExpenses((data as Expense[]) || []);
    setLoading(false);
  }, [periodFilter, categoryFilter]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleDelete = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    fetchExpenses();
  };

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const transactionCount = expenses.length;

  // Category summary for chart
  const categoryTotals: Record<string, number> = {};
  for (const e of expenses) {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
  }
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCategories[0];

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <Header title="">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-400">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-text-primary">Expenses</span>
        </div>
        <Button
          size="sm"
          onClick={() => setFormOpen(true)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Expense</span>
        </Button>
      </Header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-text-muted mb-1">Total</p>
              <p className="text-xl font-bold text-text-primary">
                Rp {total.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-text-muted mb-1">Transaksi</p>
              <p className="text-xl font-bold text-text-primary">
                {transactionCount}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-text-muted mb-1">Kategori Tertinggi</p>
              <p className="text-xl font-bold text-text-primary">
                {topCategory
                  ? `${categoryConfig[topCategory[0]]?.emoji || "📦"} ${topCategory[0]}`
                  : "-"}
              </p>
            </div>
          </div>

          {/* Category Bar Chart */}
          {sortedCategories.length > 0 && (
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs font-medium text-text-muted mb-3">Per Kategori</p>
              <div className="space-y-2">
                {sortedCategories.map(([cat, catTotal]) => {
                  const pct = total > 0 ? (catTotal / total) * 100 : 0;
                  const config = categoryConfig[cat] || categoryConfig.other;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="w-20 text-xs text-text-secondary truncate">
                        {config.emoji} {cat}
                      </span>
                      <div className="flex-1 h-5 rounded-full bg-[hsl(0_0%_10%)] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${config.bgClass} flex items-center justify-end pr-2`}
                          style={{ width: `${Math.max(pct, 3)}%`, transition: "width 0.5s ease" }}
                        >
                          {pct > 15 && (
                            <span className={`text-[10px] font-medium ${config.textClass}`}>
                              {pct.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-text-secondary w-24 text-right">
                        Rp {catTotal.toLocaleString("id-ID")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-2">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(categoryConfig).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.emoji} {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expense List */}
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
          ) : expenses.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada pengeluaran</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {expenses.map((expense) => {
                  const config = categoryConfig[expense.category] || categoryConfig.other;
                  return (
                    <motion.div
                      key={expense.id}
                      variants={staggerItem}
                      initial="hidden"
                      animate="show"
                      exit={{ opacity: 0, x: -20 }}
                      className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 group"
                    >
                      <span className="text-xs font-mono text-text-muted w-20 shrink-0">
                        {expense.date}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-sm text-text-primary">
                        {expense.title}
                      </span>
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bgClass} ${config.textClass}`}>
                        {config.emoji} {expense.category}
                      </span>
                      <span className="text-sm font-semibold text-text-primary text-right w-28 shrink-0">
                        Rp {Number(expense.amount).toLocaleString("id-ID")}
                      </span>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:text-red-400 transition-all shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <ExpenseForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) fetchExpenses();
        }}
      />
    </div>
  );
}

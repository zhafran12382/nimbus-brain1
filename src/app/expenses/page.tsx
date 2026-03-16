"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Plus, Trash2 } from "lucide-react";
import { Expense, Income } from "@/types";
import { supabase } from "@/lib/supabase";

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

const expenseCategoryConfig: Record<string, { emoji: string; bgClass: string; textClass: string }> = {
  food: { emoji: "🍔", bgClass: "bg-orange-500/15", textClass: "text-orange-400" },
  transport: { emoji: "🚗", bgClass: "bg-blue-500/15", textClass: "text-blue-400" },
  shopping: { emoji: "🛍️", bgClass: "bg-pink-500/15", textClass: "text-pink-400" },
  entertainment: { emoji: "🎮", bgClass: "bg-purple-500/15", textClass: "text-purple-400" },
  health: { emoji: "💊", bgClass: "bg-emerald-500/15", textClass: "text-emerald-400" },
  education: { emoji: "📚", bgClass: "bg-cyan-500/15", textClass: "text-cyan-400" },
  bills: { emoji: "📄", bgClass: "bg-red-500/15", textClass: "text-red-400" },
  other: { emoji: "📦", bgClass: "bg-zinc-500/15", textClass: "text-zinc-400" },
};

const incomeCategoryConfig: Record<string, { emoji: string; bgClass: string; textClass: string }> = {
  salary: { emoji: "💼", bgClass: "bg-emerald-500/15", textClass: "text-emerald-400" },
  transfer: { emoji: "🔄", bgClass: "bg-blue-500/15", textClass: "text-blue-400" },
  freelance: { emoji: "💻", bgClass: "bg-violet-500/15", textClass: "text-violet-400" },
  gift: { emoji: "🎁", bgClass: "bg-pink-500/15", textClass: "text-pink-400" },
  investment: { emoji: "📈", bgClass: "bg-amber-500/15", textClass: "text-amber-400" },
  refund: { emoji: "↩️", bgClass: "bg-cyan-500/15", textClass: "text-cyan-400" },
  other: { emoji: "📦", bgClass: "bg-zinc-500/15", textClass: "text-zinc-400" },
};

type TabFilter = "all" | "income" | "expenses";

interface FinanceItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes?: string | null;
  created_at: string;
  type: "income" | "expense";
}

export default function FinancesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState("this_month");
  const [tabFilter, setTabFilter] = useState<TabFilter>("all");

  const getDateRange = useCallback(() => {
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
    return { startDate, endDate };
  }, [periodFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { startDate, endDate } = getDateRange();

    let expQuery = supabase.from("expenses").select("*").order("date", { ascending: false });
    if (startDate) expQuery = expQuery.gte("date", startDate);
    if (endDate) expQuery = expQuery.lte("date", endDate);

    let incQuery = supabase.from("incomes").select("*").order("date", { ascending: false });
    if (startDate) incQuery = incQuery.gte("date", startDate);
    if (endDate) incQuery = incQuery.lte("date", endDate);

    const [{ data: expData }, { data: incData }] = await Promise.all([expQuery, incQuery]);
    setExpenses((expData as Expense[]) || []);
    setIncomes((incData as Income[]) || []);
    setLoading(false);
  }, [getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string, type: "income" | "expense") => {
    const table = type === "income" ? "incomes" : "expenses";
    await supabase.from(table).delete().eq("id", id);
    fetchData();
  };

  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const incomeTotal = incomes.reduce((sum, e) => sum + Number(e.amount), 0);
  const netBalance = incomeTotal - expenseTotal;
  const totalTransactions = expenses.length + incomes.length;

  // Build combined list
  const allItems: FinanceItem[] = [
    ...expenses.map((e) => ({ ...e, type: "expense" as const, notes: e.notes ?? null })),
    ...incomes.map((e) => ({ ...e, type: "income" as const, notes: e.notes ?? null })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredItems = tabFilter === "all"
    ? allItems
    : allItems.filter((item) => item.type === (tabFilter === "income" ? "income" : "expense"));

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6 border-b border-[hsl(0_0%_100%_/_0.04)]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-400">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <h1 className="font-semibold text-text-primary">Finances</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setFormOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Transaction</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-emerald-400/70 mb-1">💰 Income</p>
              <p className="text-lg font-bold text-emerald-400">
                Rp {incomeTotal.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-rose-400/70 mb-1">💸 Expenses</p>
              <p className="text-lg font-bold text-rose-400">
                Rp {expenseTotal.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-text-muted mb-1">💎 Net Balance</p>
              <p className={`text-lg font-bold ${netBalance >= 0 ? "text-blue-400" : "text-rose-400"}`}>
                {netBalance >= 0 ? "+" : "-"}Rp {Math.abs(netBalance).toLocaleString("id-ID")}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-text-muted mb-1">📊 Transaksi</p>
              <p className="text-lg font-bold text-text-primary">
                {totalTransactions}
              </p>
            </div>
          </div>

          {/* Period Filter */}
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
          </div>

          {/* Tab Toggle */}
          <div className="flex gap-1 p-1 glass-card rounded-xl w-fit">
            {(["all", "income", "expenses"] as TabFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setTabFilter(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tabFilter === tab
                    ? "bg-[hsl(217_91%_60%)] text-white"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {tab === "all" ? "All" : tab === "income" ? "💰 Income" : "💸 Expenses"}
              </button>
            ))}
          </div>

          {/* Transaction List */}
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
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada transaksi</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {filteredItems.map((item) => {
                  const isIncome = item.type === "income";
                  const catConfig = isIncome
                    ? (incomeCategoryConfig[item.category] || incomeCategoryConfig.other)
                    : (expenseCategoryConfig[item.category] || expenseCategoryConfig.other);
                  return (
                    <motion.div
                      key={`${item.type}-${item.id}`}
                      variants={staggerItem}
                      initial="hidden"
                      animate="show"
                      exit={{ opacity: 0, x: -20 }}
                      className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 group"
                    >
                      <span className="text-xs font-mono text-text-muted w-20 shrink-0">
                        {item.date}
                      </span>
                      <span className={`text-sm shrink-0 ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                        {isIncome ? "💰" : "💸"}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-sm text-text-primary">
                        {item.title}
                      </span>
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${catConfig.bgClass} ${catConfig.textClass}`}>
                        {catConfig.emoji} {item.category}
                      </span>
                      <span className={`text-sm font-semibold text-right w-28 shrink-0 ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                        {isIncome ? "+" : "-"}Rp {Number(item.amount).toLocaleString("id-ID")}
                      </span>
                      <button
                        onClick={() => handleDelete(item.id, item.type)}
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
          if (!open) fetchData();
        }}
      />
    </div>
  );
}

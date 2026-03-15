"use client";

import { useState, useEffect } from "react";
import { Expense, Income } from "@/types";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editExpense?: Expense | null;
  editIncome?: Income | null;
}

const expenseCategories = [
  { value: "food", label: "🍔 Food" },
  { value: "transport", label: "🚗 Transport" },
  { value: "shopping", label: "🛍️ Shopping" },
  { value: "entertainment", label: "🎮 Entertainment" },
  { value: "health", label: "💊 Health" },
  { value: "education", label: "📚 Education" },
  { value: "bills", label: "📄 Bills" },
  { value: "other", label: "📦 Other" },
];

const incomeCategories = [
  { value: "salary", label: "💼 Salary" },
  { value: "transfer", label: "🔄 Transfer" },
  { value: "freelance", label: "💻 Freelance" },
  { value: "gift", label: "🎁 Gift" },
  { value: "investment", label: "📈 Investment" },
  { value: "refund", label: "↩️ Refund" },
  { value: "other", label: "📦 Other" },
];

type FormType = "expense" | "income";

export function ExpenseForm({ open, onOpenChange, editExpense, editIncome }: ExpenseFormProps) {
  const [formType, setFormType] = useState<FormType>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editExpense) {
      setFormType("expense");
      setTitle(editExpense.title);
      setAmount(String(editExpense.amount));
      setCategory(editExpense.category);
      setDate(editExpense.date);
      setNotes(editExpense.notes || "");
    } else if (editIncome) {
      setFormType("income");
      setTitle(editIncome.title);
      setAmount(String(editIncome.amount));
      setCategory(editIncome.category);
      setDate(editIncome.date);
      setNotes(editIncome.notes || "");
    } else {
      setTitle("");
      setAmount("");
      setCategory("other");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
    }
  }, [editExpense, editIncome, open]);

  const handleTypeChange = (type: FormType) => {
    setFormType(type);
    setCategory("other");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;

    setSaving(true);
    const payload = {
      title: title.trim(),
      amount: parseFloat(amount),
      category,
      date,
      notes: notes.trim() || null,
    };

    const table = formType === "income" ? "incomes" : "expenses";
    const editItem = formType === "income" ? editIncome : editExpense;

    if (editItem) {
      const { error } = await supabase.from(table).update(payload).eq("id", editItem.id);
      if (error) { setSaving(false); return; }
    } else {
      const { error } = await supabase.from(table).insert(payload);
      if (error) { setSaving(false); return; }
    }

    setSaving(false);
    onOpenChange(false);
  };

  const categories = formType === "income" ? incomeCategories : expenseCategories;
  const isEditing = editExpense || editIncome;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border-subtle sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-text-primary">
            {isEditing
              ? (formType === "income" ? "Edit Pemasukan" : "Edit Pengeluaran")
              : "Tambah Transaksi"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Toggle */}
          {!isEditing && (
            <div className="flex gap-1 p-1 glass rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeChange("expense")}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  formType === "expense"
                    ? "bg-rose-500/20 text-rose-400"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                💸 Expense
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("income")}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  formType === "income"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                💰 Income
              </button>
            </div>
          )}
          <div>
            <Label htmlFor="title">Deskripsi</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={formType === "income" ? "Transfer dari ortu" : "Makan siang di warteg"}
              required
            />
          </div>
          <div>
            <Label htmlFor="amount">Jumlah (Rp)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="25000"
              required
            />
          </div>
          <div>
            <Label htmlFor="category">Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="date">Tanggal</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="notes">Catatan (opsional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan..."
              rows={2}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

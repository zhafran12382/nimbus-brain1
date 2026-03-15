"use client";

import { useState, useEffect } from "react";
import { Expense } from "@/types";
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
}

const categories = [
  { value: "food", label: "🍔 Food" },
  { value: "transport", label: "🚗 Transport" },
  { value: "shopping", label: "🛍️ Shopping" },
  { value: "entertainment", label: "🎮 Entertainment" },
  { value: "health", label: "💊 Health" },
  { value: "education", label: "📚 Education" },
  { value: "bills", label: "📄 Bills" },
  { value: "other", label: "📦 Other" },
];

export function ExpenseForm({ open, onOpenChange, editExpense }: ExpenseFormProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editExpense) {
      setTitle(editExpense.title);
      setAmount(String(editExpense.amount));
      setCategory(editExpense.category);
      setDate(editExpense.date);
      setNotes(editExpense.notes || "");
    } else {
      setTitle("");
      setAmount("");
      setCategory("other");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
    }
  }, [editExpense, open]);

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

    if (editExpense) {
      await supabase.from("expenses").update(payload).eq("id", editExpense.id);
    } else {
      await supabase.from("expenses").insert(payload);
    }

    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border-subtle sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-text-primary">
            {editExpense ? "Edit Pengeluaran" : "Tambah Pengeluaran"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Deskripsi</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Makan siang di warteg"
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

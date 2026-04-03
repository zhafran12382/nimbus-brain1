"use client";

import { useState, useEffect } from "react";
import { Target } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

interface TargetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget?: Target | null;
}

export function TargetForm({ open, onOpenChange, editTarget }: TargetFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("custom");
  const [description, setDescription] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [unit, setUnit] = useState("%");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setTitle(editTarget.title);
        setCategory(editTarget.category);
        setDescription(editTarget.description || "");
        setTargetValue(String(editTarget.target_value));
        setCurrentValue(String(editTarget.current_value));
        setUnit(editTarget.unit);
        setDeadline(editTarget.deadline || "");
        setStatus(editTarget.status);
      } else {
        setTitle("");
        setCategory("custom");
        setDescription("");
        setTargetValue("");
        setCurrentValue("");
        setUnit("%");
        setDeadline("");
        setStatus("active");
      }
    }
  }, [editTarget, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const data = {
      title,
      category,
      description: description || null,
      target_value: parseFloat(targetValue),
      current_value: parseFloat(currentValue) || 0,
      unit,
      deadline: deadline || null,
      status,
    };

    if (editTarget) {
      await supabase.from("targets").update(data).eq("id", editTarget.id);
    } else {
      await supabase.from("targets").insert(data);
    }

    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editTarget ? "Edit Target" : "Tambah Target Baru"}</DialogTitle>
          <DialogDescription>
            {editTarget ? "Update detail target kamu." : "Buat target baru untuk dilacak."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bench Press 60kg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="study">📚 Study</SelectItem>
                  <SelectItem value="fitness">💪 Fitness</SelectItem>
                  <SelectItem value="finance">💰 Finance</SelectItem>
                  <SelectItem value="project">🚀 Project</SelectItem>
                  <SelectItem value="custom">📌 Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editTarget && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi target..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target_value">Target</Label>
              <Input
                id="target_value"
                type="number"
                step="any"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="60"
                required
              />
            </div>
            {editTarget && (
              <div className="space-y-2">
                <Label htmlFor="current_value">Progress</Label>
                <Input
                  id="current_value"
                  type="number"
                  step="any"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="unit">Satuan</Label>
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline (opsional)</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : editTarget ? "Simpan" : "Buat Target"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

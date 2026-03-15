export const tools = [
  {
    type: "function" as const,
    function: {
      name: "create_target",
      description: "Buat target baru. Gunakan saat user ingin menambah goal/target baru.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Judul target" },
          category: {
            type: "string",
            enum: ["study", "fitness", "finance", "project", "custom"],
            description: "Kategori target"
          },
          description: { type: "string", description: "Deskripsi opsional" },
          target_value: { type: "number", description: "Nilai target yang ingin dicapai" },
          unit: { type: "string", description: "Satuan (contoh: kg, pages, Rp, %, reps, km)" },
          deadline: { type: "string", description: "Deadline format YYYY-MM-DD" }
        },
        required: ["title", "category", "target_value", "unit"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "update_target_progress",
      description: "Update progress dari target yang sudah ada.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Judul target (partial match)" },
          new_value: { type: "number", description: "Nilai current_value baru (total, bukan increment)" },
          set_status: { type: "string", enum: ["active", "completed", "failed", "paused"], description: "Opsional: ubah status" }
        },
        required: ["title", "new_value"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_targets",
      description: "Ambil daftar target.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "completed", "failed", "paused", "all"], description: "Filter status. Default: all" },
          category: { type: "string", enum: ["study", "fitness", "finance", "project", "custom", "all"], description: "Filter kategori. Default: all" }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "delete_target",
      description: "Hapus target tertentu.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Judul target yang dihapus (partial match)" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_target_summary",
      description: "Ringkasan semua target aktif + progress.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description: "Search the web for current, real-time information. Use when user asks about recent events, news, people, current facts, or anything beyond your training data. Always cite sources from results.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "create_expense",
      description: "Record a new expense/spending. Use when user mentions spending money or buying something.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Deskripsi pengeluaran" },
          amount: { type: "number", description: "Jumlah dalam Rupiah" },
          category: {
            type: "string",
            enum: ["food", "transport", "shopping", "entertainment", "health", "education", "bills", "other"],
            description: "Kategori pengeluaran"
          },
          date: { type: "string", description: "Tanggal format YYYY-MM-DD, default hari ini" },
          notes: { type: "string", description: "Catatan tambahan (opsional)" }
        },
        required: ["title", "amount", "category"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_expenses",
      description: "Get list of expenses. Can filter by date range or category.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Filter dari tanggal YYYY-MM-DD" },
          end_date: { type: "string", description: "Filter sampai tanggal YYYY-MM-DD" },
          category: { type: "string", enum: ["food", "transport", "shopping", "entertainment", "health", "education", "bills", "other"], description: "Filter kategori" },
          limit: { type: "number", description: "Jumlah maksimal hasil, default 20" }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_expense_summary",
      description: "Get spending summary with totals per category and overall. Use when user asks about spending habits, totals, or analysis.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "this_week", "this_month", "last_month", "all"],
            description: "Periode ringkasan"
          }
        },
        required: ["period"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "delete_expense",
      description: "Delete an expense record by ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID pengeluaran yang akan dihapus" }
        },
        required: ["id"]
      }
    }
  }
];

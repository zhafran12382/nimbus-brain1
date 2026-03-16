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
      description: "Record money SPENT / pengeluaran. Use ONLY when user SPENDS money: buying things, paying bills, eating out, transportation cost, etc. Keywords: beli, bayar, habis, keluar, buat beli, jajan. Do NOT use this for incoming money — use create_income instead.",
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
      description: "Get spending/expense summary with totals per category. Use when user asks specifically about spending, pengeluaran, or expenses.",
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
  },
  {
    type: "function" as const,
    function: {
      name: "create_income",
      description: "Record incoming money / pemasukan. Use when user RECEIVES money: salary, transfer from someone, freelance payment, gift, investment returns, refund, etc. Keywords: gaji, transfer masuk, dikasih, terima, dapat, TF dari, income, pemasukan.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Deskripsi pemasukan" },
          amount: { type: "number", description: "Jumlah dalam Rupiah" },
          category: {
            type: "string",
            enum: ["salary", "transfer", "freelance", "gift", "investment", "refund", "other"],
            description: "Kategori pemasukan"
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
      name: "get_incomes",
      description: "Get list of income records. Filter by date range or category.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Filter dari tanggal YYYY-MM-DD" },
          end_date: { type: "string", description: "Filter sampai tanggal YYYY-MM-DD" },
          category: { type: "string", enum: ["salary", "transfer", "freelance", "gift", "investment", "refund", "other"], description: "Filter kategori" },
          limit: { type: "number", description: "Jumlah maksimal hasil, default 20" }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_income_summary",
      description: "Get income summary with totals per category. Use when user asks about earnings or income analysis.",
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
      name: "delete_income",
      description: "Delete an income record.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID pemasukan yang akan dihapus" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_financial_summary",
      description: "Get complete financial overview: total income, total expenses, and net balance. Use when user asks about overall finances, balance, 'uang saya berapa', 'sisa berapa', or financial health.",
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
      name: "save_memory",
      description: "Save important information about the user to long-term memory. Use this when: 1) User explicitly asks to remember something ('inget ini', 'remember this', 'catat ya'), 2) User shares a significant personal fact (allergy, birthday, school, preference), 3) User states a strong preference or dislike. Do NOT save trivial conversation, greetings, or temporary information.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Informasi yang disimpan, tulis sebagai fakta ringkas" },
          category: {
            type: "string",
            enum: ["preference", "fact", "goal", "routine", "relationship", "general"],
            description: "Kategori memory"
          },
          importance: { type: "number", description: "Seberapa penting info ini (1-10, default 5)" }
        },
        required: ["content", "category"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_memories",
      description: "HANYA panggil tool ini jika user SECARA EKSPLISIT bertanya tentang memory. Contoh trigger: 'apa yang lu inget tentang gw?', 'coba inget', 'lu tau gak gw suka apa?', 'apa aja yang lu simpan?'. JANGAN panggil untuk: chat biasa, sapaan, pertanyaan umum, buat target/expense/income, web search. Memory sudah otomatis tersedia di context — TIDAK PERLU fetch ulang kecuali user explicitly minta.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keyword filter untuk search memory" },
          category: {
            type: "string",
            enum: ["preference", "fact", "goal", "routine", "relationship", "general"],
            description: "Filter by category"
          },
          limit: { type: "number", description: "Jumlah maksimal hasil, default 10" }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "delete_memory",
      description: "Delete a specific memory by ID. Use when user asks to forget something.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID memory yang akan dihapus" }
        },
        required: ["id"]
      }
    }
  }
];

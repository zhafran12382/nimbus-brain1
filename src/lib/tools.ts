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
      name: "get_information",
      description: "Ambil informasi web terstruktur untuk native citations. Gunakan untuk pertanyaan faktual agar jawaban bisa menggunakan inline citation dari sumber yang valid.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Kata kunci pencarian yang relevan" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description: "PENTING: Gunakan tool ini HANYA JIKA user bertanya info terkini, berita realtime, profil seseorang, kejadian terbaru, atau info yang tidak kamu ketahui. WAJIB kutip sumber",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Kata kunci pencarian yang relevan" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "create_expense",
      description: "PENTING: Gunakan tool ini HANYA JIKA user MENGELUARKAN uang (membayar, beli, jajan, habis bayar cicilan). JANGAN gunakan untuk pemasukan.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Deskripsi pengeluaran yang jelas" },
          amount: { type: "number", description: "Jumlah pengeluaran dalam angka mutlak Rupiah" },
          category: {
            type: "string",
            enum: ["food", "transport", "shopping", "entertainment", "health", "education", "bills", "other"],
            description: "Kategori pengeluaran. Default ke other jika bingung"
          },
          date: { type: "string", description: "Opsional. Tanggal format YYYY-MM-DD. Kosongkan jika hari ini." },
          notes: { type: "string", description: "Catatan ekstra." }
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
      description: "PENTING: Gunakan tool ini HANYA JIKA user MENERIMA uang (gajian, dikasih, dapat hadiah, hasil investasi). JANGAN gunakan untuk pengeluaran.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Deskripsi pemasukan yang jelas" },
          amount: { type: "number", description: "Jumlah pemasukan dalam Rupiah" },
          category: {
            type: "string",
            enum: ["salary", "transfer", "freelance", "gift", "investment", "refund", "other"],
            description: "Kategori pemasukan"
          },
          date: { type: "string", description: "Opsional. Tanggal YYYY-MM-DD" },
          notes: { type: "string", description: "Catatan opsional" }
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
      description: "PENTING: Simpan fakta kunci/jangka panjang tentang user. JANGAN simpan obrolan remeh. Hanya gunakan jika ada fakta krusial (sekolah, alergi, hobi, tujuan, atau user secara eksplisit memintamu mengingat hal spesifik).",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Deskripsi fakta yang dicatat untuk masa depan" },
          category: {
            type: "string",
            enum: ["preference", "fact", "goal", "routine", "relationship", "general"],
            description: "Pilih kategori memory yang cocok"
          },
          importance: { type: "number", description: "Skala 1 - 10 seberapa penting ingatan ini bergantung pada permintaannya / krusialitasnya." }
        },
        required: ["content", "category"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_memories",
      description: "HANYA panggil jika user EKSPLISIT minta recall memory, contoh: 'apa yang lu inget?', 'lu tau gak gw suka apa?', 'apa aja yang lu simpan?'. JANGAN panggil untuk chat biasa/sapaan/pertanyaan umum — memory sudah otomatis di-inject ke context.",
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
  },
  {
    type: "function" as const,
    function: {
      name: "create_quiz",
      description: "Buat kuis atau tes soal latihan interaktif seputar topik apa saja untuk user belajar.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Topik spesifik kuis" },
          num_questions: { type: "number", description: "Jumlah pertanyaan ganda (cth: 5)" },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
            description: "Level kesulitan yang dipesan user."
          }
        },
        required: ["topic"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_quiz_history",
      description: "Get user's quiz history and stats. Use when user asks about past quizzes, scores, or study progress.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Jumlah maksimal quiz yang ditampilkan (default 10)" }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_quiz_stats",
      description: "Get study statistics: average score, total quizzes taken, strongest/weakest topics. Use when user asks about study performance or progress.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

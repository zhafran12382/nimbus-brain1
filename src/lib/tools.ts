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
      description: "PENTING: Gunakan tool ini untuk pertanyaan faktual, info terkini, berita realtime, profil seseorang, kejadian terbaru, atau info yang tidak kamu ketahui. WAJIB kutip sumber. STRATEGI DINAMIS: Untuk topik NICHE/JARANG/TABU → lakukan 5-7 search dengan query sangat bervariasi (target 15+ sumber). Untuk topik UMUM/TRENDING → cukup 2-3 search (target 5-10 sumber). Jika ragu, default ke intensitas tinggi. Gunakan variasi: sinonim, bahasa berbeda (ID + EN), phrasing alternatif.",
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
      name: "run_python",
      description: "Eksekusi kode Python untuk kalkulasi matematika, analisis data, atau komputasi yang membutuhkan akurasi. Gunakan tool ini WAJIB saat user bertanya soal matematika, perhitungan, konversi, statistik, atau hal yang butuh komputasi presisi. Tulis kode Python yang bersih dan gunakan print() untuk output hasil.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Kode Python yang akan dieksekusi. WAJIB gunakan print() untuk menampilkan hasil." },
          description: { type: "string", description: "Deskripsi singkat apa yang dilakukan kode ini" }
        },
        required: ["code"]
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
  },
  {
    type: "function" as const,
    function: {
      name: "send_notification",
      description: "Kirim notifikasi ke user. Gunakan untuk menginformasikan sesuatu yang penting, konfirmasi aksi, atau peringatan.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Judul notifikasi (singkat)" },
          message: { type: "string", description: "Isi pesan notifikasi" },
          type: {
            type: "string",
            enum: ["info", "success", "warning", "error"],
            description: "Tipe notifikasi. Default: info"
          }
        },
        required: ["title", "message"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "create_scheduled_task",
      description: "Buat scheduled task baru. Konversi jadwal user ke format cron expression. Contoh: harian jam 7 pagi = '0 7 * * *', setiap Senin jam 9 = '0 9 * * 1'. Untuk one-time task (misal 'ingatkan 20 menit lagi', 'besok jam 7'), set run_once=true dan buat cron expression yang spesifik ke waktu tersebut.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nama task (unik, untuk identifikasi)" },
          prompt: { type: "string", description: "Prompt/perintah yang akan dieksekusi saat waktunya tiba" },
          cron_expression: { type: "string", description: "Cron expression (5 field: menit jam tanggal bulan hari). Contoh: '0 7 * * *' = setiap hari jam 7:00, '*/30 * * * *' = setiap 30 menit, '30 14 28 3 *' = 28 Maret jam 14:30 (one-time)" },
          run_once: { type: "boolean", description: "Set true untuk task sekali jalan (reminder, alarm). Task akan otomatis selesai setelah dieksekusi. Default: false (recurring)" }
        },
        required: ["name", "prompt", "cron_expression"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_scheduled_tasks",
      description: "Ambil daftar scheduled tasks.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "running", "done", "failed", "paused", "cancelled", "all"],
            description: "Filter status. Default: all"
          }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "update_scheduled_task",
      description: "Update jadwal scheduled task yang sudah ada.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "ID task (UUID dari database)" },
          cron_expression: { type: "string", description: "Cron expression baru (5 field: menit jam tanggal bulan hari)" }
        },
        required: ["task_id", "cron_expression"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "delete_scheduled_task",
      description: "Hapus scheduled task dari database.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "ID task (UUID dari database)" }
        },
        required: ["task_id"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "reset_finance",
      description: "BAHAYA: Hapus SEMUA data keuangan (expenses + incomes). Gunakan HANYA jika user secara eksplisit dan tegas meminta reset seluruh data keuangan. WAJIB confirm: true.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "WAJIB true untuk konfirmasi. Tanpa ini, reset tidak akan dijalankan." }
        },
        required: ["confirm"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "delete_all_threads",
      description: "BAHAYA: Hapus SEMUA percakapan dan pesan chat. Gunakan HANYA jika user secara eksplisit dan tegas meminta hapus semua thread. WAJIB confirm: true. TIDAK BISA di-undo.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "WAJIB true untuk konfirmasi. Tanpa ini, penghapusan tidak akan dijalankan." }
        },
        required: ["confirm"]
      }
    }
  }
];

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
      description: "Search the web for current, real-time information. Use this when the user asks about recent events, news, people, facts, or anything that requires up-to-date knowledge beyond your training data.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" }
        },
        required: ["query"]
      }
    }
  }
];

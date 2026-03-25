import { NextRequest } from 'next/server';
import { tools } from '@/lib/tools';
import { executeTool } from '@/lib/tool-executor';
import { getModelById, getModelByIdAndProvider, getProviderConfig, DEFAULT_MODEL_ID, DEFAULT_PROVIDER_ID } from '@/lib/models';
import { supabase } from '@/lib/supabase';
import type { GroqRateLimit, ProviderId } from '@/types';

// Vercel Serverless: max 180 detik
export const maxDuration = 180;
export const dynamic = 'force-dynamic';

function log(tag: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}]`, ...args);
}

function logError(tag: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${tag}]`, ...args);
}

const toolLabels: Record<string, string> = {
  web_search: "🔍 Searching the web...",
  get_information: "📚 Retrieving cited sources...",
  create_target: "🎯 Creating target...",
  update_target: "🔄 Updating target...",
  update_target_progress: "🔄 Updating target...",
  delete_target: "🗑️ Deleting target...",
  get_targets: "📋 Fetching targets...",
  get_target_summary: "📊 Analyzing targets...",
  create_expense: "💸 Recording expense...",
  get_expenses: "📋 Fetching expenses...",
  get_expense_summary: "📊 Analyzing expenses...",
  delete_expense: "🗑️ Deleting expense...",
  create_income: "💰 Recording income...",
  get_incomes: "📋 Fetching income...",
  get_income_summary: "📊 Analyzing income...",
  delete_income: "🗑️ Deleting income...",
  get_financial_summary: "📊 Analyzing finances...",
  save_memory: "🧠 Remembering...",
  get_memories: "🧠 Recalling memories...",
  delete_memory: "🧠 Forgetting...",
  create_quiz: "📝 Generating quiz...",
  get_quiz_history: "📚 Fetching quiz history...",
  get_quiz_stats: "📊 Analyzing study stats...",
};

interface CitationSourceEntry {
  url: string;
  title: string;
  domain: string;
}

function buildCitationSourceMap(toolResult: string): Record<string, CitationSourceEntry> {
  try {
    const parsed = JSON.parse(toolResult) as Record<string, { url?: string; title?: string }>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const map: Record<string, CitationSourceEntry> = {};
    for (const [rawId, source] of Object.entries(parsed)) {
      if (!source || typeof source !== 'object') continue;
      const url = source.url;
      if (typeof url !== 'string') continue;
      try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) continue;
        const key = String(rawId);
        map[key] = {
          url,
          title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : parsedUrl.hostname,
          domain: parsedUrl.hostname.replace(/^www\./, ''),
        };
      } catch {
        continue;
      }
    }
    return map;
  } catch {
    return {};
  }
}

function renderMistralContent(content: unknown, citationSources?: Record<string, CitationSourceEntry>): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return renderMistralContent([content], citationSources);
  }
  if (!Array.isArray(content)) return '';

  let rendered = '';

  for (const chunk of content) {
    if (!chunk || typeof chunk !== 'object') continue;
    const typedChunk = chunk as { type?: string; text?: string; reference_ids?: Array<string | number> };
    const chunkType = typeof typedChunk.type === 'string' ? typedChunk.type.toLowerCase() : '';

    if ((chunkType === 'text' || chunkType === 'textchunk' || chunkType === 'text_chunk') && typeof typedChunk.text === 'string') {
      rendered += typedChunk.text;
      continue;
    }

    if ((chunkType === 'reference' || chunkType === 'referencechunk' || chunkType === 'reference_chunk') && Array.isArray(typedChunk.reference_ids)) {
      const refs = typedChunk.reference_ids
        .map((referenceId, idx) => {
          const key = String(referenceId);
          const parsedNumber = Number(referenceId);
          const displayNumber = Number.isFinite(parsedNumber) ? parsedNumber + 1 : idx + 1;
          const source = citationSources?.[key];
          return source ? ` [${displayNumber}](${source.url})` : ` [${displayNumber}]`;
        })
        .join('');
      rendered += refs;
      continue;
    }

    if (typeof typedChunk.text === 'string' && !chunkType) {
      rendered += typedChunk.text;
    }
  }

  return rendered;
}

const BASE_SYSTEM_INSTRUCTION = `[IDENTITY]
Lu adalah AI assistant yang smart, santai, dan gaya ngomongnya natural kayak anak jaksel.
Bahasa fleksibel, casual, ga kaku, tapi tetap jelas dan enak dibaca.
Boleh witty sedikit, tapi jangan lebay.

[PRIORITAS UTAMA]
Akurasi lebih penting daripada keliatan pintar.
Kalau informasi tidak tersedia, bilang tidak tahu.
Jangan pernah mengarang fakta.

[ATURAN PANJANG JAWABAN]
- Untuk obrolan ringan/sapaan: jawab singkat dan natural.
- Untuk pertanyaan faktual/topik kompleks: target MINIMAL 200-400 kata.
- Jelaskan konteks, kronologi, dan poin penting secara detail.
- Tambahkan detail relevan dari sumber yang tersedia.
- Hindari jawaban 1 paragraf pendek untuk topik yang butuh penjelasan.
- Kalau detail dari sumber terbatas, bilang kalau detailnya belum lengkap tapi tetap jelaskan konteks yang relevan.
- Jangan menambah konteks/kronologi yang tidak tertulis jelas di sumber.

[ATURAN PENGGUNAAN SEARCH TOOL]
Kalau menggunakan web search (Tavily atau tool lain):

STRATEGI SEARCH:
- Gunakan minimal 2-3 query berbeda untuk satu topik.
- Gunakan sinonim dan variasi phrasing.
- Gunakan variasi bahasa (Indonesia dan Inggris) jika relevan.
- Contoh variasi: jika user tanya tentang kasus viral, coba query seperti:
  "kasus [topik] terbaru"
  "[topik] viral berita"
  "[topik] news latest"

Gunakan HANYA informasi yang secara eksplisit muncul di hasil search.

DILARANG:
- mengarang berita
- mengarang kronologi kejadian
- mengarang nama orang
- mengarang lokasi spesifik
- mengarang institusi
- mengarang kutipan
- menyebut sumber yang tidak ada di hasil search
- menggabungkan beberapa artikel berbeda menjadi cerita baru tanpa bukti jelas

Jika hasil search kosong, lemah, atau tidak relevan:
jawab jujur dengan gaya santai:
"gue ga nemu sumber kredibel soal ini"
atau
"info validnya belum ada nih"

Jangan mengisi detail yang tidak ada di sumber.

[TRANSPARANSI SUMBER]
Jika menyampaikan fakta dari search:
sebut sumber secara natural.

contoh:
"menurut artikel dari Detik..."
"berdasarkan info yang gue temuin di Kompas..."

Jika sumber tidak jelas atau tidak kredibel:
katakan bahwa informasinya belum terverifikasi.

Jangan pernah menyebut nama media jika tidak muncul di hasil search.

[VERIFIKASI FAKTA]
- Bandingkan fakta antar sumber jika ada beberapa hasil search.
- Gunakan informasi yang konsisten di beberapa sumber.
- Jika ada perbedaan informasi antar sumber, sebutkan perbedaannya.
- Gunakan kata "diduga", "menurut laporan", "berdasarkan sumber" jika informasi belum pasti.
- Jangan membuat klaim medis atau hukum tanpa sumber eksplisit.

[BATAS INTERPRETASI]
Jangan menarik kesimpulan yang tidak tertulis jelas di sumber.
Jangan menebak motif, identitas, atau kronologi tanpa bukti eksplisit.

Kalau informasinya masih terbatas:
jelaskan bahwa detailnya belum lengkap.

[PENGGUNAAN PYTHON]
Untuk pertanyaan MATEMATIKA, KALKULASI, KONVERSI, STATISTIK, atau KOMPUTASI:
- WAJIB gunakan tool run_python untuk menjalankan kode Python.
- Tulis kode Python yang bersih dan gunakan print() untuk output hasil.
- Contoh: "berapa 15% dari 2.450.000?" → Python: print(0.15 * 2450000)
- Contoh: "bunga 5% per tahun selama 3 tahun dari 10 juta" → tulis Python compound interest.
- Contoh: "konversi 100 USD ke IDR kurs 15.800" → Python: print(100 * 15800)
- JANGAN pernah hitung manual di kepala — selalu gunakan Python untuk akurasi.
- Setelah dapat hasil dari Python, jelaskan hasilnya secara natural dan mudah dipahami ke user.

[MEMORY SAFETY]
Jika menyimpan memory:
hanya simpan fakta eksplisit dari percakapan user.
jangan menyimpan asumsi atau interpretasi.

Jangan membuat memory dari informasi yang tidak pasti.

[GAYA KOMUNIKASI]
Tetap santai dan natural.
Tidak terlalu formal.
Tidak terlalu banyak emoji.
Tidak lebay.

Contoh tone:
singkat, clear, chill, slightly witty.

TOOLS:
- Target/goals, expense, income, web search → SELALU gunakan tools saat diminta aksi.
- Obrolan biasa → respond natural tanpa tools.
- Setelah tool execution → SELALU beri respons informatif.
- JANGAN panggil get_memories kecuali user SECARA EKSPLISIT bertanya tentang hal yang pernah disimpan (contoh: "apa yang lu inget?", "lu tau gak gw suka apa?"). Memory sudah otomatis di-inject ke context di bawah — kamu TIDAK PERLU fetch ulang.

KEUANGAN (CRITICAL):
- PEMASUKAN (create_income): "di TF ortu", "gajian", "dapat cashback", "dikasih", "terima"
- PENGELUARAN (create_expense): "beli", "bayar", "jajan", "habis buat"
- AMBIGU → tanya dulu, JANGAN langsung eksekusi.

MULTI-AKSI: Jika user minta 2+ aksi sekaligus, jalankan SEMUA satu per satu. Jangan skip.

[TUJUAN]
Memberikan jawaban yang komprehensif, akurat, jujur, dan tetap enak dibaca tanpa mengorbankan fakta.
Prioritaskan kelengkapan informasi — lebih baik jawaban lengkap dengan sumber jelas daripada jawaban pendek.
Lebih baik mengakui keterbatasan informasi daripada membuat detail palsu.

[PARAMETER RESPONS]
- Untuk topik kompleks/faktual: jawaban WAJIB panjang, detail, dan informatif.
- Gunakan struktur yang jelas: heading, bullet points, kronologi jika relevan.
- Jangan potong jawaban di tengah. Selesaikan semua poin penting.
- Jika informasi dari sumber banyak, rangkum SEMUA yang relevan, jangan hanya sebagian.`;

function buildSystemInstruction(personality?: Record<string, string | undefined>): string {
  // Dynamic date in WIB (UTC+7)
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibDate = new Date(now.getTime() + wibOffset);
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dayName = dayNames[wibDate.getUTCDay()];
  const date = wibDate.getUTCDate();
  const month = monthNames[wibDate.getUTCMonth()];
  const year = wibDate.getUTCFullYear();
  const hours = String(wibDate.getUTCHours()).padStart(2, '0');
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, '0');

  let instruction = '';

  // Inject personality if provided (compact format)
  if (personality && personality.preset) {
    instruction += `[P] ${personality.preset}`;
    if (personality.language) instruction += ` | lang:${personality.language}`;
    if (personality.responseStyle) instruction += ` | style:${personality.responseStyle}`;
    if (personality.userName) instruction += ` | name:${personality.userName}`;
    if (personality.customInstructions) instruction += `\n${personality.customInstructions}`;
    instruction += '\n\n';
  }

  instruction += `[SYSTEM]\nHari ini adalah ${dayName}, ${date} ${month} ${year}. Waktu: ${hours}:${minutes} WIB.\n\n${BASE_SYSTEM_INSTRUCTION}\n[/SYSTEM]`;

  return instruction;
}

function getModeInstruction(mode: string): string {
  switch (mode) {
    case 'search':
      return '\n\n[MODE: SEARCH]\nDalam mode ini, SELALU gunakan web_search atau get_information terlebih dahulu sebelum menjawab pertanyaan faktual. Skip search HANYA untuk sapaan ringan atau perintah tool (buat target, catat expense, dll).\n\nSTRATEGI SEARCH DINAMIS:\nSesuaikan intensitas search berdasarkan tingkat familiaritas topik:\n\nTOPIK NICHE / JARANG / TABU / TIDAK UMUM (contoh: kasus lokal, figur tidak terkenal, topik teknis spesifik, berita daerah, isu kontroversial, topik yang kamu tidak yakin):\n- Lakukan 5-7 web_search dengan query SANGAT BERVARIASI\n- Gunakan variasi: bahasa Indonesia, bahasa Inggris, nama lengkap, singkatan, sinonim, frasa berita, frasa teknis\n- Target: kumpulkan 15+ sumber berbeda\n- Contoh variasi: "kasus [x] [kota]", "[x] berita terbaru", "[x] news latest", "[x] kronologi", "[x] viral"\n\nTOPIK UMUM / TRENDING / WELL-KNOWN (contoh: berita viral nasional, tokoh sangat terkenal, topik mainstream yang sedang ramai):\n- Lakukan 2-3 web_search dengan query berbeda\n- Target: 5-10 sumber\n- Variasi bahasa (ID + EN) dan phrasing alternatif sudah cukup\n\nCARA MENENTUKAN INTENSITAS:\n- Jika kamu YAKIN topik ini umum dan well-known → intensitas rendah (2-3 search)\n- Jika kamu TIDAK YAKIN atau topik terasa niche → intensitas tinggi (5+ search)\n- Jika hasil search pertama SEDIKIT atau TIDAK RELEVAN → otomatis tingkatkan intensitas, lakukan search tambahan\n- DEFAULT ke intensitas TINGGI jika ragu\n\nATURAN WAJIB SAAT MENJAWAB DENGAN SEARCH RESULTS:\n1. HANYA nyatakan fakta yang SECARA EKSPLISIT tertulis di search results.\n2. Jika search results saling bertentangan, tampilkan SEMUA versi beserta sumbernya.\n3. Jika search results kosong, lemah, atau tidak relevan, jawab jujur: "gue ga nemu sumber kredibel soal ini" atau "info validnya belum ada nih".\n4. Jangan pernah mengatakan sesuatu "sudah resmi" kecuali search results SECARA EKSPLISIT menyatakan demikian.\n5. DILARANG KERAS: mengarang berita, kronologi, nama orang, lokasi, institusi, kutipan, atau sumber yang tidak ada di hasil search.\n6. Jangan menggabungkan beberapa artikel berbeda menjadi cerita baru tanpa bukti jelas.\n7. Sebut sumber secara natural (contoh: "menurut artikel dari Detik..."). Jangan menyebut nama media yang tidak muncul di hasil search.\n8. Jangan menarik kesimpulan atau menebak motif/identitas/kronologi tanpa bukti eksplisit dari search results.\n9. Kalau data terbatas, jelaskan bahwa detailnya belum lengkap. Jangan isi bagian yang kosong dengan tebakan.\n\nVERIFIKASI LINTAS SUMBER:\n- Bandingkan fakta antar sumber. Gunakan informasi yang konsisten.\n- Jika ada perbedaan informasi, sebutkan perbedaannya secara eksplisit.\n- Gunakan kata "diduga", "menurut laporan", "berdasarkan sumber" untuk info yang belum pasti.\n\nFORMAT OUTPUT SEARCH:\n- Jawaban harus jelas, natural, dan fokus pada fakta yang tersedia.\n- Panjang jawaban fleksibel mengikuti kelengkapan data.\n- Jangan memaksa jawaban panjang jika sumbernya tipis.\n\nATURAN CITATION:\nNative citation (TextChunk + ReferenceChunk) saat ini hanya dipakai untuk provider mistral. Untuk provider lain, WAJIB sertakan sumber di akhir response menggunakan format:\n---sources---\nJudul Artikel | URL\nJudul Artikel | URL\n---end-sources---\n[/MODE]';
    case 'think':
      return '\n\n[MODE: THINK]\nDalam mode ini, lakukan penalaran mendalam. Kamu WAJIB menuliskan seluruh proses berpikirmu sebelum memberikan jawaban final menggunakan format berikut:\n---thinking---\n[isi proses berpikir AI di sini, bisa multi-paragraph]\n---end-thinking---\n\n[jawaban final di sini]\n[/MODE]';
    case 'search+think': {
      const searchInst = '\n\n[MODE: SEARCH]\nDalam mode ini, SELALU gunakan web_search atau get_information terlebih dahulu sebelum menjawab pertanyaan faktual. Skip search HANYA untuk sapaan ringan atau perintah tool (buat target, catat expense, dll).\n\nSTRATEGI SEARCH DINAMIS:\nSesuaikan intensitas search berdasarkan tingkat familiaritas topik:\n\nTOPIK NICHE / JARANG / TABU / TIDAK UMUM (contoh: kasus lokal, figur tidak terkenal, topik teknis spesifik, berita daerah, isu kontroversial, topik yang kamu tidak yakin):\n- Lakukan 5-7 web_search dengan query SANGAT BERVARIASI\n- Gunakan variasi: bahasa Indonesia, bahasa Inggris, nama lengkap, singkatan, sinonim, frasa berita, frasa teknis\n- Target: kumpulkan 15+ sumber berbeda\n- Contoh variasi: "kasus [x] [kota]", "[x] berita terbaru", "[x] news latest", "[x] kronologi", "[x] viral"\n\nTOPIK UMUM / TRENDING / WELL-KNOWN (contoh: berita viral nasional, tokoh sangat terkenal, topik mainstream yang sedang ramai):\n- Lakukan 2-3 web_search dengan query berbeda\n- Target: 5-10 sumber\n- Variasi bahasa (ID + EN) dan phrasing alternatif sudah cukup\n\nCARA MENENTUKAN INTENSITAS:\n- Jika kamu YAKIN topik ini umum dan well-known → intensitas rendah (2-3 search)\n- Jika kamu TIDAK YAKIN atau topik terasa niche → intensitas tinggi (5+ search)\n- Jika hasil search pertama SEDIKIT atau TIDAK RELEVAN → otomatis tingkatkan intensitas, lakukan search tambahan\n- DEFAULT ke intensitas TINGGI jika ragu\n\nATURAN WAJIB SAAT MENJAWAB DENGAN SEARCH RESULTS:\n1. HANYA nyatakan fakta yang SECARA EKSPLISIT tertulis di search results.\n2. Jika search results saling bertentangan, tampilkan SEMUA versi beserta sumbernya.\n3. Jika search results kosong, lemah, atau tidak relevan, jawab jujur: "gue ga nemu sumber kredibel soal ini" atau "info validnya belum ada nih".\n4. Jangan pernah mengatakan sesuatu "sudah resmi" kecuali search results SECARA EKSPLISIT menyatakan demikian.\n5. DILARANG KERAS: mengarang berita, kronologi, nama orang, lokasi, institusi, kutipan, atau sumber yang tidak ada di hasil search.\n6. Jangan menggabungkan beberapa artikel berbeda menjadi cerita baru tanpa bukti jelas.\n7. Sebut sumber secara natural (contoh: "menurut artikel dari Detik..."). Jangan menyebut nama media yang tidak muncul di hasil search.\n8. Jangan menarik kesimpulan atau menebak motif/identitas/kronologi tanpa bukti eksplisit dari search results.\n9. Kalau data terbatas, jelaskan bahwa detailnya belum lengkap. Jangan isi bagian yang kosong dengan tebakan.\n\nVERIFIKASI LINTAS SUMBER:\n- Bandingkan fakta antar sumber. Gunakan informasi yang konsisten.\n- Jika ada perbedaan informasi, sebutkan perbedaannya secara eksplisit.\n- Gunakan kata "diduga", "menurut laporan", "berdasarkan sumber" untuk info yang belum pasti.\n\nFORMAT OUTPUT SEARCH:\n- Jawaban harus jelas, natural, dan fokus pada fakta yang tersedia.\n- Panjang jawaban fleksibel mengikuti kelengkapan data.\n- Jangan memaksa jawaban panjang jika sumbernya tipis.\n\nATURAN CITATION:\nNative citation (TextChunk + ReferenceChunk) saat ini hanya dipakai untuk provider mistral. Untuk provider lain, WAJIB sertakan sumber di akhir response menggunakan format:\n---sources---\nJudul Artikel | URL\nJudul Artikel | URL\n---end-sources---\n[/MODE]';
      const thinkInst = '\n\n[MODE: THINK]\nDalam mode ini, lakukan penalaran mendalam. Kamu WAJIB menuliskan seluruh proses berpikirmu sebelum memberikan jawaban final menggunakan format berikut:\n---thinking---\n[isi proses berpikir AI di sini, bisa multi-paragraph]\n---end-thinking---\n\n[jawaban final di sini]\n[/MODE]';
      return searchInst + thinkInst;
    }
    case 'flash':
      return '\n\n[MODE: FLASH]\nDalam mode ini, jawab CEPAT dan SINGKAT. Langsung ke inti. Maksimal 2-3 kalimat kecuali diminta lebih. Tidak perlu intro atau outro.\n[/MODE]';
    default:
      return '';
  }
}

async function fetchMemoriesContext(): Promise<string> {
  try {
    const { data } = await supabase
      .from('memories')
      .select('*')
      .order('importance', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return '';

    const lines = data.map(m => `- ${m.content} (${m.category}, importance: ${m.importance})`);
    return `\n\n[MEMORY]\nBerikut hal-hal yang kamu ingat tentang user:\n${lines.join('\n')}\n[/MEMORY]`;
  } catch (err) {
    logError('MEMORY', 'Failed to fetch memories:', err);
    return '';
  }
}

async function extractMemories(recentMessages: Record<string, unknown>[], modelId: string, pId: ProviderId) {
  const extractPrompt = [
    {
      role: "system",
      content: `Analisis percakapan berikut. Apakah ada FAKTA PENTING tentang user yang perlu diingat untuk percakapan di masa depan?

Rules:
- Hanya extract fakta yang SIGNIFIKAN dan PERMANEN (bukan hal sementara)
- Contoh SIMPAN: preferensi, alergi, birthday, sekolah, hobi, goals jangka panjang, kebiasaan
- Contoh JANGAN SIMPAN: "hari ini capek", "lagi bosen", percakapan biasa, pertanyaan umum
- Jika TIDAK ADA fakta penting, respond dengan tepat: "NO_MEMORY"
- Jika ADA, respond HANYA dalam format JSON array:
[{"content": "fakta ringkas", "category": "fact|preference|goal|routine|relationship|general", "importance": 1-10}]

HANYA JSON array atau "NO_MEMORY". Tidak ada teks lain.`
    },
    ...recentMessages
  ];

  const data = await callProvider(pId, modelId, extractPrompt, false);
  const result = data.choices[0]?.message?.content?.trim();

  if (!result || result === "NO_MEMORY") return;

  try {
    const memories = JSON.parse(result);
    if (!Array.isArray(memories)) return;

    for (const mem of memories) {
      if (!mem.content || typeof mem.content !== 'string') continue;

      // Check for duplicates
      const { data: existing } = await supabase
        .from('memories')
        .select('id')
        .ilike('content', `%${mem.content.substring(0, 30)}%`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from('memories').insert({
        content: mem.content,
        category: mem.category || 'general',
        importance: Math.min(10, Math.max(1, mem.importance || 5)),
        source: 'auto',
      });

      log('MEMORY', `Auto-saved: "${mem.content}"`);
    }
  } catch {
    log('MEMORY', 'No extractable memories from this conversation');
  }
}

const maxTokensMap: Record<string, number> = { flash: 8000, search: 32000, think: 16000, 'search+think': 32000 };
const GEMINI_MODEL_ID = 'gemini-2.5-flash-lite';

function formatProviderError(message: string): string {
  if (message.includes('is not a valid model ID') || message.includes('not a valid model')) {
    return '⚠️ Model tidak tersedia. Silakan pilih model lain.';
  }
  if (message.includes('Provider returned error')) {
    return '⚠️ Provider sedang bermasalah. Coba lagi atau pilih model lain.';
  }
  if (message.includes('rate limit') || message.includes('429') || message.toLowerCase().includes('rate_limit')) {
    return '⚠️ Batas penggunaan tercapai. Coba lagi nanti.';
  }
  return `⚠️ Terjadi kesalahan: ${message}`;
}

function validateGeminiRequest(providerId: ProviderId, modelId: string): string | null {
  if (providerId !== 'gemini') return null;

  if (modelId !== GEMINI_MODEL_ID) {
    return `Model tidak valid untuk provider Gemini. Gunakan "${GEMINI_MODEL_ID}".`;
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return 'API key tidak valid atau belum disetel.';
  }

  return null;
}

function parseGroqRateLimitHeaders(headers: Headers): GroqRateLimit | null {
  const limitRequests = headers.get('x-ratelimit-limit-requests');
  const remainingRequests = headers.get('x-ratelimit-remaining-requests');
  const limitTokens = headers.get('x-ratelimit-limit-tokens');
  const remainingTokens = headers.get('x-ratelimit-remaining-tokens');
  const resetRequests = headers.get('x-ratelimit-reset-requests');
  const resetTokens = headers.get('x-ratelimit-reset-tokens');

  if (!limitRequests && !remainingRequests && !limitTokens && !remainingTokens && !resetRequests && !resetTokens) {
    return null;
  }

  const toNum = (value: string | null): number | undefined => {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    limitRequests: toNum(limitRequests),
    remainingRequests: toNum(remainingRequests),
    limitTokens: toNum(limitTokens),
    remainingTokens: toNum(remainingTokens),
    resetRequests: resetRequests || undefined,
    resetTokens: resetTokens || undefined,
  };
}

const MAX_RATE_LIMIT_RETRIES = 3;

async function callProvider(
  providerId: ProviderId,
  modelId: string,
  messages: Record<string, unknown>[],
  useTools: boolean,
  maxTokens = 1024,
  temperature = 0.7,
  signal?: AbortSignal,
  onRateLimit?: (rateLimit: GroqRateLimit) => void,
  onStatus?: (text: string) => void,
  _retryCount = 0,
) {
  const provider = getProviderConfig(providerId);
  if (!provider) throw new Error(`Provider "${providerId}" not found.`);

  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    temperature: (providerId === 'mistral' && useTools) ? 0.1 : temperature,
    max_tokens: maxTokens,
  };
  if (useTools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  // === PROVIDER ROUTING CONTROL ===
  if (providerId === 'openrouter-paid') {
    body.provider = { order: ["DeepInfra"], require_parameters: true };
  }
  if (providerId === 'openrouter') {
    // Disable auto-routing: only allow providers that support the exact model requested
    body.provider = { require_parameters: true };
    body.route = "fallback";
  }

  log('PROVIDER ROUTING', `provider=${providerId}, model=${modelId}, routing=${JSON.stringify(body.provider || 'none')}, route=${body.route || 'default'}`);

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: provider.getHeaders(),
    body: JSON.stringify(body),
    signal,
  });

  if (providerId === 'groq' && onRateLimit) {
    const rateLimit = parseGroqRateLimitHeaders(response.headers);
    if (rateLimit) onRateLimit(rateLimit);
  }

  if (!response.ok) {
    if (response.status === 429 && providerId === 'mistral') {
      if (_retryCount >= MAX_RATE_LIMIT_RETRIES) {
        throw new Error('⚠️ Mistral rate limit exceeded. Terlalu banyak retry. Coba lagi nanti.');
      }
      const resetDelayStr = response.headers.get('ratelimit-reset') || response.headers.get('retry-after') || "10";
      const waitTimeSec = parseInt(resetDelayStr, 10) || 10;
      if (waitTimeSec < 150) {
        if (onStatus) onStatus(`⏳ Rate limited (${_retryCount + 1}/${MAX_RATE_LIMIT_RETRIES}). Menunggu ${waitTimeSec}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTimeSec * 1000));
        return callProvider(providerId, modelId, messages, useTools, maxTokens, temperature, signal, onRateLimit, onStatus, _retryCount + 1);
      }
    }
    const err = await response.json().catch(() => ({}));
    const rawMessage = err.error?.message || `${provider.name} API error: ${response.status}`;
    throw new Error(formatProviderError(rawMessage));
  }

  const data = await response.json();

  // === MODEL ASSERTION: verify provider didn't swap to a different model ===
  if (data.model && data.model !== modelId) {
    logError('MODEL MISMATCH', `REQUESTED: "${modelId}" → ACTUAL: "${data.model}" (provider: ${providerId})`);
  }

  // Check for error in response body (some providers return 200 with error payload)
  if (data.type === 'error' || data.error) {
    const rawMessage = data.message || data.error?.message || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)) || 'Unknown provider error';
    throw new Error(formatProviderError(rawMessage));
  }

  return data;
}

async function callProviderStream(
  providerId: ProviderId,
  modelId: string,
  messages: Record<string, unknown>[],
  onChunk: (accumulated: string) => void,
  onThinkingChunk?: (thinking: string) => void,
  maxTokens = 1024,
  temperature = 0.7,
  signal?: AbortSignal,
  onRateLimit?: (rateLimit: GroqRateLimit) => void,
  onStatus?: (text: string) => void,
  citationSources?: Record<string, CitationSourceEntry>,
  _retryCount = 0,
  mode?: string,
): Promise<string> {
  const provider = getProviderConfig(providerId);
  if (!provider) throw new Error(`Provider "${providerId}" not found.`);

  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  // === PROVIDER ROUTING CONTROL ===
  if (providerId === 'openrouter-paid') {
    body.provider = { order: ["DeepInfra"], require_parameters: true };
  }
  if (providerId === 'openrouter') {
    body.provider = { require_parameters: true };
    body.route = "fallback";
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: provider.getHeaders(),
    body: JSON.stringify(body),
    signal,
  });

  if (providerId === 'groq' && onRateLimit) {
    const rateLimit = parseGroqRateLimitHeaders(response.headers);
    if (rateLimit) onRateLimit(rateLimit);
  }

  if (!response.ok) {
    if (response.status === 429 && providerId === 'mistral') {
      if (_retryCount >= MAX_RATE_LIMIT_RETRIES) {
        throw new Error('⚠️ Mistral rate limit exceeded. Terlalu banyak retry. Coba lagi nanti.');
      }
      const resetDelayStr = response.headers.get('ratelimit-reset') || response.headers.get('retry-after') || "10";
      const waitTimeSec = parseInt(resetDelayStr, 10) || 10;
      if (waitTimeSec < 150) {
        if (onStatus) onStatus(`⏳ Rate limited (${_retryCount + 1}/${MAX_RATE_LIMIT_RETRIES}). Menunggu ${waitTimeSec}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTimeSec * 1000));
        return callProviderStream(providerId, modelId, messages, onChunk, onThinkingChunk, maxTokens, temperature, signal, onRateLimit, onStatus, citationSources, _retryCount + 1, mode);
      }
    }
    const err = await response.json().catch(() => ({}));
    const rawMessage = err.error?.message || `${provider.name} API error: ${response.status}`;
    throw new Error(formatProviderError(rawMessage));
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let accumulatedThinking = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE lines from buffer
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (!trimmed.startsWith('data:')) continue;

      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);

        // Check for error in SSE chunk
        if (parsed.type === 'error' || parsed.error) {
          const rawMessage = parsed.message || parsed.error?.message || (typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error)) || 'Unknown provider error';
          throw new Error(formatProviderError(rawMessage));
        }

        const content = parsed.choices?.[0]?.delta?.content;
        // Only extract reasoning tokens when user has enabled think mode
        const isThinkMode = mode === 'think' || mode === 'search+think';
        const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || parsed.choices?.[0]?.delta?.reasoning;
        if (isThinkMode && typeof reasoning === 'string' && reasoning.trim()) {
          accumulatedThinking += reasoning;
          onThinkingChunk?.(accumulatedThinking);
        }
        const renderedContent = renderMistralContent(content, citationSources);
        if (renderedContent) {
          accumulated += renderedContent;
          onChunk(accumulated);
        }
      } catch (e) {
        // Re-throw formatted provider errors
        if (e instanceof Error && e.message.startsWith('⚠️')) {
          throw e;
        }
        console.log('[SSE Parse Error]', data, e);
      }
    }
  }

  return accumulated;
}

export async function POST(req: NextRequest) {
  const { messages, model: modelId = DEFAULT_MODEL_ID, personality, conversationId: incomingConvId, mode = 'flash', provider: incomingProvider } = await req.json();
  const signal = req.signal;

  // === PROVIDER RESOLUTION: prefer frontend provider, validate match ===
  let providerId: ProviderId;
  let model;

  if (incomingProvider) {
    providerId = incomingProvider as ProviderId;
    model = getModelByIdAndProvider(modelId, providerId);
    if (!model) {
      // Model not found in the selected provider — reject, don't silently fallback
      logError('VALIDATION', `Model "${modelId}" not found in provider "${providerId}". Rejecting.`);
      return new Response(
        JSON.stringify({ error: `Model "${modelId}" tidak tersedia di provider ${providerId}. Pilih model yang sesuai.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } else {
    // Fallback: resolve from model config (legacy, less safe)
    log('WARN', `No provider sent from frontend for model=${modelId}. Using model config fallback.`);
    model = getModelById(modelId);
    providerId = model?.providerId || DEFAULT_PROVIDER_ID;
  }

  log('REQUEST', `provider=${providerId}, model=${modelId}, providerSource=${incomingProvider ? 'frontend' : 'fallback'}, messages=${messages.length}, convId=${incomingConvId || 'new'}, mode=${mode}`);

  const geminiValidationError = validateGeminiRequest(providerId, modelId);
  if (geminiValidationError) {
    return new Response(
      JSON.stringify({ error: geminiValidationError }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!model) {
    return new Response(
      JSON.stringify({ error: `Model "${modelId}" not found.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // --- Resolve or create conversation ---
  let conversationId: string | null = incomingConvId || null;
  if (!conversationId) {
    const userContent = messages[messages.length - 1]?.content || '';
    const title = userContent.slice(0, 35) + (userContent.length > 35 ? '...' : '');
    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({ title })
      .select()
      .single();
    if (convErr) {
      logError('DB ERROR', 'Failed to create conversation:', convErr.message);
    }
    if (newConv) {
      conversationId = newConv.id;
    }
  }
  log('CONV', `conversationId=${conversationId}, isNew=${!incomingConvId}`);

  // --- Save user message server-side ---
  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg && lastUserMsg.role === 'user' && conversationId) {
    const { error: userMsgErr } = await supabase.from('chat_messages').insert({
      role: 'user',
      content: lastUserMsg.content,
      conversation_id: conversationId,
    });
    if (userMsgErr) {
      logError('DB ERROR', 'Failed to save user message:', userMsgErr.message);
    } else {
      log('DB SAVE', `User message saved to conv ${conversationId}`);
    }
  }

  const useTools = model.supports_tools;
  const hasSearch = mode === 'search' || mode === 'search+think';
  const isThinkMode = mode === 'think' || mode === 'search+think';
  const isFlash = mode === 'flash';
  const maxTokens = maxTokensMap[mode as keyof typeof maxTokensMap] || 16000;
  const memoriesContext = await fetchMemoriesContext();
  let systemInstruction = buildSystemInstruction(personality) + getModeInstruction(mode) + memoriesContext;
  
  if (providerId === 'mistral' && useTools) {
    systemInstruction += '\n\nINSTRUKSI KRITIS: Jika kamu memutuskan untuk menggunakan sebuah tool/fungsi, kamu WAJIB HANYA mengeluarkan objek JSON mentah untuk pemanggilan tool tersebut. JANGAN sertakan teks percakapan, sapaan, penjelasan, atau format markdown (seperti ```json) sebelum atau sesudah JSON tersebut.';
  }

  log('SYSTEM', `instruction length=${systemInstruction.length}, useTools=${useTools}, mode=${mode}, maxTokens=${maxTokens}`);
  log('MODE', `mode=${mode}, isThinkMode=${isThinkMode}, hasSearch=${hasSearch}, isFlash=${isFlash}, provider=${providerId}, model=${modelId}`);
  const historyLimit = isFlash ? 4 : 10;
  const targetTemperature = hasSearch ? 0.3 : 0.7;
  const apiMessages = [
    { role: "system", content: systemInstruction },
    ...messages.slice(-historyLimit),
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const sendRateLimit = (rateLimit: GroqRateLimit) => {
        send({ type: "rate_limit", rate_limit: rateLimit });
      };

      try {
        // --- STEP 1: Kirim ke Provider ---
        const thinkingStartAt = Date.now();
        let thinkingContent = "";
        send({ type: "status", text: "Thinking..." });

        log('API CALL', `provider=${providerId}, Sending ${apiMessages.length} messages, useTools=${useTools}`);
        const data = await callProvider(providerId, modelId, apiMessages, useTools, maxTokens, targetTemperature, signal, sendRateLimit, (text) => send({ type: "status", text }));
        let assistantMsg = data.choices[0].message;
        log('API RESP', `hasContent=${!!assistantMsg.content?.trim()}, hasToolCalls=${!!assistantMsg.tool_calls}, toolCount=${assistantMsg.tool_calls?.length || 0}`);

        const toolResults: { name: string; args: Record<string, unknown>; result: string }[] = [];
        let citationSources: Record<string, CitationSourceEntry> = {};

        // --- STEP 2: Handle tool calls (agentic loop, max 5 rounds) ---
        if (assistantMsg.tool_calls && useTools) {
          const toolCallMessages: Record<string, unknown>[] = [...apiMessages];
          // Max rounds to support multi-action prompts. Search mode needs more rounds for 3+ search queries + continuation check.
          const MAX_TOOL_ROUNDS = hasSearch ? 12 : 5;
          let continuationChecked = false;

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            if (!assistantMsg.tool_calls) {
              // Model tidak mau call tool lagi
              // Tapi cek apakah kita sudah lakukan continuation check
              if (!continuationChecked && toolResults.length > 0) {
                if (isFlash) {
                  // Skip continuation check — prioritize speed
                  log('TOOL LOOP', `Round ${round}: Flash mode: skipping continuation check`);
                  break;
                }
                continuationChecked = true;

                log('TOOL LOOP', `Round ${round}: No more tool_calls. Running continuation check...`);

                // Append current assistant response
                toolCallMessages.push(assistantMsg);

                // Ask model to check if there are remaining actions
                const continuationPrompt = hasSearch
                  ? "Evaluasi pencarian yang sudah dilakukan. Pertimbangkan: (1) Apakah topik ini NICHE/JARANG yang butuh 5+ search, atau UMUM yang cukup 2-3 search? (2) Apakah jumlah search sudah CUKUP untuk topik ini? (3) Apakah sumber sudah BERAGAM dan hasil search sudah RELEVAN? Jika topik niche dan search masih kurang, atau jika sumber masih sedikit/tidak relevan, lakukan search tambahan dengan variasi query (sinonim, bahasa berbeda, phrasing alternatif). Jika sudah cukup, berikan respons final yang LENGKAP dan DETAIL berdasarkan SEMUA hasil search."
                  : "Periksa kembali pesan user sebelumnya. Apakah ada permintaan atau aksi lain yang BELUM kamu jalankan? Jika ya, jalankan tool-nya sekarang. Jika semua sudah selesai, berikan respons final.";
                toolCallMessages.push({
                  role: "user",
                  content: continuationPrompt
                });

                log('API CALL', `Continuation check with ${toolCallMessages.length} messages`);
                const checkData = await callProvider(providerId, modelId, toolCallMessages, useTools, maxTokens, targetTemperature, signal, sendRateLimit, (text) => send({ type: "status", text }));
                assistantMsg = checkData.choices[0].message;

                log('TOOL LOOP', `Continuation check result: ${assistantMsg.tool_calls ? 'More tools needed' : 'All done'}`);

                if (assistantMsg.tool_calls) {
                  // Ada tool lagi yang perlu dijalankan, continue loop
                  continue;
                } else {
                  // Semua selesai
                  break;
                }
              } else {
                break;
              }
            }

            // Append assistant message with tool_calls
            toolCallMessages.push(assistantMsg);

            log('TOOL LOOP', `Round ${round}: Processing ${assistantMsg.tool_calls.length} tool call(s)`);

            for (const toolCall of assistantMsg.tool_calls) {
              const fnName = toolCall.function.name;
              let fnArgs: Record<string, unknown>;

              try {
                fnArgs = JSON.parse(toolCall.function.arguments);
              } catch (parseErr) {
                logError('PARSE ERROR', `Failed to parse arguments for ${fnName}:`, toolCall.function.arguments, parseErr);
                toolCallMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: `Error: Invalid arguments for ${fnName} — ${parseErr}`,
                });
                continue;
              }

              log('TOOL EXEC', `Executing: ${fnName}`, JSON.stringify(fnArgs));

              send({
                type: "tool_start",
                name: fnName,
                args: fnArgs,
                text: toolLabels[fnName] || `🔧 Executing ${fnName}...`,
              });

              try {
                const result = await executeTool(fnName, fnArgs);
                log('TOOL EXEC', `${fnName} result:`, result.substring(0, 200));

                if (fnName === 'get_information') {
                  citationSources = buildCitationSourceMap(result);
                }

                toolResults.push({ name: fnName, args: fnArgs, result });
                send({ type: "tool_result", name: fnName, result });

                toolCallMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: result,
                });
              } catch (execErr) {
                const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
                logError('TOOL ERROR', `${fnName} execution failed:`, errMsg);

                toolCallMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: `Error executing ${fnName}: ${errMsg}`,
                });

                send({ type: "tool_result", name: fnName, result: `❌ Error: ${errMsg}` });
              }
            }

            // Send tool results back to model
            const statusText = round < MAX_TOOL_ROUNDS - 1 ? "Generating response..." : "Finalizing...";
            send({ type: "status", text: statusText });

            log('API CALL', `Sending ${toolCallMessages.length} messages back to model...`);

            try {
              const nextData = await callProvider(providerId, modelId, toolCallMessages, useTools, maxTokens, targetTemperature, signal, sendRateLimit, (text) => send({ type: "status", text }));
              assistantMsg = nextData.choices[0].message;
              log('API RESP', `hasContent=${!!assistantMsg.content?.trim()}, hasToolCalls=${!!assistantMsg.tool_calls}, toolCount=${assistantMsg.tool_calls?.length || 0}`);
            } catch (apiErr) {
              logError('API ERROR', `Failed to get response after tool round ${round}:`, apiErr);
              break;
            }
          }
        }

        // --- STEP 4: Handle non-tool models (JSON fallback) ---
        const parsedActions: { name: string; args: Record<string, unknown>; result: string }[] = [];
        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
          const assistantContentAsText = renderMistralContent(assistantMsg.content, citationSources);
          if (assistantContentAsText.includes('{') && assistantContentAsText.includes('}')) {
            try {
              const cleanedContent = assistantContentAsText.replace(/```json\n?/ig, '').replace(/```\n?/g, '').trim();
              const firstBrace = cleanedContent.indexOf('{');
              const lastBrace = cleanedContent.lastIndexOf('}');
              
              if (firstBrace !== -1 && lastBrace !== -1) {
                const pureJson = cleanedContent.substring(firstBrace, lastBrace + 1);
                const actionObj = JSON.parse(pureJson);
                
                const fnName = actionObj.action || actionObj.name;
                const fnArgs = actionObj.params || actionObj.arguments || actionObj;
                
                if (fnName && typeof fnName === 'string' && toolLabels[fnName]) {
                  log('FALLBACK', `Extracted leaked JSON for function: ${fnName}`);
                  send({
                    type: "tool_start",
                    name: fnName,
                    args: fnArgs,
                    text: toolLabels[fnName] || `🔧 Executing ${fnName}...`,
                  });
                  const result = await executeTool(fnName, fnArgs);
                  parsedActions.push({ name: fnName, args: fnArgs, result });
                  send({ type: "tool_result", name: fnName, result });
                  
                  assistantMsg.content = assistantContentAsText.replace(cleanedContent.substring(firstBrace, lastBrace + 1), '').trim();
                }
              }
            } catch (parseError) {
              logError('PARSE ERROR', 'Failed to extract JSON from assistant content:', parseError);
            }
          }
        }

        // --- STEP 5: Handle response with streaming ---
        const allToolCalls = [...toolResults, ...parsedActions];
        let finalContent = renderMistralContent(assistantMsg.content, citationSources);
        let streamed = false;
        const hasMistralNativeCitations = providerId === 'mistral' && Object.keys(citationSources).length > 0 && /\[[0-9]+\]\(/.test(finalContent);

        if (hasMistralNativeCitations) {
          send({ type: "chunk", content: finalContent });
          streamed = true;
        }

        // Case 1: Content empty after tool calls — retry with streaming
        if (!finalContent.trim() && allToolCalls.length > 0) {
          log('EMPTY RESP', `Content empty after ${allToolCalls.length} tool calls. Retrying with stream...`);

          try {
            const toolSummary = allToolCalls.map(tc => `${tc.name}: ${tc.result}`).join('\n');
            const hasSearchTools = allToolCalls.some(tc => tc.name === 'web_search' || tc.name === 'get_information');
            const retryPrompt = hasSearchTools
              ? `Kamu baru saja menjalankan search berikut:\n${toolSummary}\n\nBerdasarkan SEMUA hasil search di atas, berikan jawaban yang LENGKAP, DETAIL, dan KOMPREHENSIF. Target minimal 200-400 kata. Gunakan format: JUDUL, RINGKASAN, PENJELASAN LENGKAP (dengan kronologi jika relevan), FAKTA PENTING (bullet points), dan CATATAN (perbedaan info jika ada). Kutip sumber secara natural. Sertakan semua sumber menggunakan format ---sources--- di akhir. JANGAN panggil tool lagi.`
              : `Kamu baru saja menjalankan tool berikut:\n${toolSummary}\n\nBerikan konfirmasi santai, ramah, dan natural (basa-basi) kepada user bahwa aksi telah berhasil dilakukan berdasarkan hasil di atas. Hindari respons seperti robot atau laporan formal. JANGAN panggil tool lagi.`;
            const retryMessages = [
              { role: "system", content: systemInstruction },
              ...messages.slice(-5),
              {
                role: "user",
                content: retryPrompt
              }
            ];

            finalContent = await callProviderStream(
              providerId,
              modelId,
              retryMessages,
              (accumulated) => {
                send({ type: "chunk", content: accumulated });
              },
              (thinking) => {
                thinkingContent = thinking;
                send({
                  type: "thinking",
                  thinking_content: thinkingContent,
                  thinking_duration_ms: Date.now() - thinkingStartAt,
                });
              },
              maxTokens,
              targetTemperature,
              signal,
              sendRateLimit,
              (text) => send({ type: "status", text }),
              citationSources,
              undefined,
              mode,
            );
            streamed = true;
            log('EMPTY RESP', `Retry stream result: "${finalContent.substring(0, 100)}..."`);
          } catch (retryErr) {
            logError('EMPTY RESP', 'Retry stream failed:', retryErr);
          }
        }

        // Case 2: Has content from tool flow — re-stream for real streaming experience
        if (!streamed && finalContent.trim() && allToolCalls.length > 0) {
          send({ type: "status", text: "Generating response..." });
          try {
            const streamMessages = [...apiMessages];
            if (toolResults.length > 0) {
              const toolSummary = toolResults.map(tc => `${tc.name}: ${tc.result}`).join('\n');
              const hasSearchTools2 = toolResults.some(tc => tc.name === 'web_search' || tc.name === 'get_information');
              const streamPrompt = hasSearchTools2
                ? `Kamu baru saja menjalankan search berikut:\n${toolSummary}\n\nBerdasarkan SEMUA hasil search di atas, berikan jawaban yang LENGKAP, DETAIL, dan KOMPREHENSIF. Target minimal 200-400 kata. Gunakan format: JUDUL, RINGKASAN, PENJELASAN LENGKAP (dengan kronologi jika relevan), FAKTA PENTING (bullet points), dan CATATAN (perbedaan info jika ada). Kutip sumber secara natural. Sertakan semua sumber menggunakan format ---sources--- di akhir. JANGAN panggil tool lagi.`
                : `Kamu baru saja menjalankan tool berikut:\n${toolSummary}\n\nBerikan konfirmasi santai, ramah, dan natural (basa-basi) kepada user bahwa aksi telah berhasil dilakukan berdasarkan hasil di atas. Hindari respons seperti robot atau laporan formal. JANGAN panggil tool lagi.`;
              streamMessages.push({
                role: "user",
                content: streamPrompt
              });
            }
            const streamedContent = await callProviderStream(
              providerId,
              modelId,
              streamMessages,
              (accumulated) => {
                send({ type: "chunk", content: accumulated });
              },
              (thinking) => {
                thinkingContent = thinking;
                send({
                  type: "thinking",
                  thinking_content: thinkingContent,
                  thinking_duration_ms: Date.now() - thinkingStartAt,
                });
              },
              maxTokens,
              targetTemperature,
              signal,
              sendRateLimit,
              (text) => send({ type: "status", text }),
              citationSources,
              undefined,
              mode,
            );
            if (streamedContent.trim()) {
              finalContent = streamedContent;
            } else {
              send({ type: "chunk", content: finalContent });
            }
          } catch {
            send({ type: "chunk", content: finalContent });
          }
          streamed = true;
        }

        // Case 3: No content and no tools — direct stream from model
        if (!streamed && !finalContent.trim() && allToolCalls.length === 0) {
          log('EMPTY RESP', 'Content empty, no tools. Streaming directly...');
          try {
            finalContent = await callProviderStream(
              providerId,
              modelId,
              apiMessages,
              (accumulated) => {
                send({ type: "chunk", content: accumulated });
              },
              (thinking) => {
                thinkingContent = thinking;
                send({
                  type: "thinking",
                  thinking_content: thinkingContent,
                  thinking_duration_ms: Date.now() - thinkingStartAt,
                });
              },
              maxTokens,
              targetTemperature,
              signal,
              sendRateLimit,
              (text) => send({ type: "status", text }),
              citationSources,
              undefined,
              mode,
            );
            log('EMPTY RESP', `Direct stream result: "${finalContent.substring(0, 100)}..."`);
          } catch (retryErr) {
            logError('EMPTY RESP', 'Direct stream failed:', retryErr);
          }
          streamed = true;
        }

        // Case 4: Has content, no tools — send existing content directly
        // DO NOT re-request from provider — wastes tokens and can trigger auto-routing
        if (!streamed && finalContent.trim() && allToolCalls.length === 0) {
          send({ type: "chunk", content: finalContent });
          streamed = true;
          log('STREAM', 'Sent existing content directly (no re-request to save tokens)');
        }

        // FINAL fallback — generate summary manually
        if (!finalContent.trim()) {
          logError('EMPTY RESP', 'All retries failed. Using manual fallback.');

          if (allToolCalls.length > 0) {
            const summaryParts = allToolCalls.map(tc => {
              if (tc.result.startsWith('✅')) return tc.result;
              if (tc.result.startsWith('🗑️')) return tc.result;
              if (tc.result.startsWith('📊')) return tc.result;
              if (tc.result.startsWith('📋')) return tc.result;
              if (tc.result.startsWith('💰')) return tc.result;
              if (tc.result.startsWith('💸')) return tc.result;
              return `${tc.name}: ${tc.result}`;
            });
            finalContent = summaryParts.join('\n\n');
          } else {
            finalContent = "⚠️ Model tidak menghasilkan respons. Coba kirim ulang.";
          }

          // Send fallback content as final chunk
          send({ type: "chunk", content: finalContent });
        }

        if (isThinkMode && (thinkingContent || /---thinking---/i.test(finalContent)) && !/---thinking-duration-ms---/i.test(finalContent)) {
          finalContent = `${finalContent}\n\n---thinking-duration-ms---\n${Date.now() - thinkingStartAt}\n---end-thinking-duration-ms---`;
        }

        // --- STEP 6: Save assistant message to DB (server-side) ---
        if (conversationId) {
          const { error: asstMsgErr } = await supabase.from('chat_messages').insert({
            role: 'assistant',
            content: finalContent,
            tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
            model_used: modelId,
            conversation_id: conversationId,
          });
          if (asstMsgErr) {
            logError('DB ERROR', 'Failed to save assistant message:', asstMsgErr.message);
          } else {
            log('DB SAVE', `Assistant message saved. Length: ${finalContent.length} chars`);
          }

          // Update conversation timestamp
          const { error: convUpdateErr } = await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
          if (convUpdateErr) {
            logError('DB ERROR', 'Failed to update conversation timestamp:', convUpdateErr.message);
          }
        }

        log('DONE', `Tools: ${allToolCalls.length}, Content: ${finalContent.length} chars, ConvId: ${conversationId}`);

        send({
          type: "done",
          content: finalContent,
          tool_calls: allToolCalls.length > 0 ? allToolCalls : undefined,
          model_used: modelId,
          provider_used: providerId,
          thinking_content: isThinkMode ? (thinkingContent || undefined) : undefined,
          thinking_duration_ms: isThinkMode ? (Date.now() - thinkingStartAt) : undefined,
          conversationId: conversationId || undefined,
        });

        // --- STEP 7: Auto-extract memories (background, non-blocking) ---
        // Use Maia Router (internal, free) instead of user's model to avoid
        // extra OpenRouter usage and potential auto-routing to unwanted models
        const MEMORY_EXTRACTION_CONTEXT_SIZE = 6;
        const MEMORY_MODEL_ID = 'zai/glm-4.5-flash';
        const MEMORY_PROVIDER_ID: ProviderId = 'maia';
        extractMemories(messages.slice(-MEMORY_EXTRACTION_CONTEXT_SIZE), MEMORY_MODEL_ID, MEMORY_PROVIDER_ID).catch(err =>
          logError('MEMORY', 'Auto-extract failed:', err)
        );

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
        logError('REQUEST', 'Unhandled error:', message);
        send({
          type: "error",
          message,
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

import { supabase } from './supabase';
import { QUIZ_DATA_PREFIX } from './constants';

interface SearchResult {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
}

function truncateSearchResults(results: SearchResult[], maxTotalChars = 10000, maxSnippetChars = 800): { title: string; url: string; snippet: string }[] {
  let totalChars = 0;
  const truncated: { title: string; url: string; snippet: string }[] = [];

  for (const r of results) {
    if (totalChars >= maxTotalChars) break;
    const snippet = (r.snippet || r.content || '').slice(0, maxSnippetChars);
    totalChars += snippet.length + (r.title?.length || 0) + (r.url?.length || 0);
    truncated.push({
      title: r.title || 'Untitled',
      url: r.url || '',
      snippet,
    });
  }

  return truncated;
}

function getPeriodDateRange(period: string): { startDate: string | null; endDate: string | null; periodLabel: string } {
  const now = new Date();
  let startDate: string | null = null;
  let endDate: string | null = null;
  let periodLabel = '';

  if (period === 'today') {
    startDate = now.toISOString().split('T')[0];
    endDate = startDate;
    periodLabel = 'Hari Ini';
  } else if (period === 'this_week') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    startDate = monday.toISOString().split('T')[0];
    endDate = now.toISOString().split('T')[0];
    periodLabel = 'Minggu Ini';
  } else if (period === 'this_month') {
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    endDate = now.toISOString().split('T')[0];
    periodLabel = 'Bulan Ini';
  } else if (period === 'last_month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    startDate = lastMonth.toISOString().split('T')[0];
    endDate = lastDay.toISOString().split('T')[0];
    periodLabel = 'Bulan Lalu';
  } else {
    periodLabel = 'Semua Waktu';
  }

  return { startDate, endDate, periodLabel };
}

async function insertNotification(title: string, message: string, type: string = 'info'): Promise<void> {
  await supabase.from('notifications').insert({ title, message, type });
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'create_target': {
      const { data, error } = await supabase
        .from('targets')
        .insert({
          title: args.title,
          category: args.category || 'custom',
          description: args.description || null,
          target_value: args.target_value,
          unit: args.unit,
          deadline: args.deadline || null,
        })
        .select()
        .single();
      if (error) return `Error: ${error.message}`;
      return `Target "${data.title}" berhasil dibuat! Target: ${data.target_value} ${data.unit}${data.deadline ? `, deadline: ${data.deadline}` : ''}`;
    }

    case 'update_target_progress': {
      const { data: targets } = await supabase
        .from('targets')
        .select('*')
        .ilike('title', `%${String(args.title)}%`)
        .eq('status', 'active')
        .limit(1);

      if (!targets?.length) return `Target "${args.title}" tidak ditemukan.`;

      const target = targets[0];
      const updateData: Record<string, unknown> = { current_value: args.new_value };
      const newValue = Number(args.new_value);

      if (!isNaN(newValue) && newValue >= target.target_value && !args.set_status) {
        updateData.status = 'completed';
      } else if (args.set_status) {
        updateData.status = args.set_status;
      }

      const { data, error } = await supabase
        .from('targets')
        .update(updateData)
        .eq('id', target.id)
        .select()
        .single();

      if (error) return `Error: ${error.message}`;
      const pct = ((data.current_value / data.target_value) * 100).toFixed(1);
      return `Target "${data.title}" diupdate: ${data.current_value}/${data.target_value} ${data.unit} (${pct}%)${data.status === 'completed' ? ' 🎉 TARGET TERCAPAI!' : ''}`;
    }

    case 'get_targets': {
      let query = supabase.from('targets').select('*').order('created_at', { ascending: false });
      if (args.status && args.status !== 'all') query = query.eq('status', args.status as string);
      if (args.category && args.category !== 'all') query = query.eq('category', args.category as string);

      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return 'Belum ada target.';

      return data.map(t => {
        const pct = ((t.current_value / t.target_value) * 100).toFixed(1);
        return `• ${t.title} [${t.category}] — ${t.current_value}/${t.target_value} ${t.unit} (${pct}%) | Status: ${t.status}${t.deadline ? ` | Deadline: ${t.deadline}` : ''}`;
      }).join('\n');
    }

    case 'delete_target': {
      const { data: targets } = await supabase
        .from('targets')
        .select('*')
        .ilike('title', `%${String(args.title)}%`)
        .limit(1);

      if (!targets?.length) return `Target "${args.title}" tidak ditemukan.`;

      const { error } = await supabase.from('targets').delete().eq('id', targets[0].id);
      if (error) return `Error: ${error.message}`;
      return `Target "${targets[0].title}" berhasil dihapus.`;
    }

    case 'get_target_summary': {
      const { data } = await supabase.from('targets').select('*').eq('status', 'active');
      if (!data?.length) return 'Tidak ada target aktif saat ini.';

      const total = data.length;
      const avgProgress = data.reduce((sum, t) => sum + (t.current_value / t.target_value) * 100, 0) / total;
      const nearDeadline = data.filter(t => {
        if (!t.deadline) return false;
        const diff = new Date(t.deadline).getTime() - Date.now();
        return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
      });

      let summary = `📊 Total target aktif: ${total}\n📈 Rata-rata progress: ${avgProgress.toFixed(1)}%\n`;
      if (nearDeadline.length) {
        summary += `⚠️ Deadline minggu ini:\n${nearDeadline.map(t => `  • ${t.title} (deadline: ${t.deadline})`).join('\n')}`;
      }
      summary += `\n\nDetail:\n${data.map(t => `• ${t.title}: ${t.current_value}/${t.target_value} ${t.unit} (${((t.current_value / t.target_value) * 100).toFixed(1)}%)`).join('\n')}`;
      return summary;
    }

    case 'web_search': {
      const query = String(args.query);
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        return 'Web search tidak tersedia: TAVILY_API_KEY belum dikonfigurasi.';
      }
      try {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: 20,
            search_depth: 'advanced',
            include_answer: true,
          }),
        });
        if (!tavilyRes.ok) {
          return `Gagal melakukan pencarian web untuk "${query}" (status ${tavilyRes.status}).`;
        }
        const data = await tavilyRes.json();
        let output = `Web Search Results for "${query}":\n\n`;
        if (data.answer) {
          output += `Answer: ${data.answer.slice(0, 2000)}\n\n`;
        }
        if (data.results && Array.isArray(data.results)) {
          const truncated = truncateSearchResults(data.results);
          truncated.forEach((r: { title: string; url: string; snippet: string }, i: number) => {
            output += `${i + 1}. ${r.title} — ${r.url}\n   ${r.snippet}\n\n`;
          });
        }
        if (output === `Web Search Results for "${query}":\n\n`) {
          return `Pencarian untuk "${query}" tidak menemukan hasil yang relevan.`;
        }
        return output.trim();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return `Error saat web search: ${msg}`;
      }
    }

    case 'get_information': {
      const query = String(args.query);
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        return JSON.stringify({});
      }
      try {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: 20,
            search_depth: 'advanced',
            include_answer: false,
          }),
        });
        if (!tavilyRes.ok) {
          return JSON.stringify({});
        }
        const data = await tavilyRes.json();
        if (!data.results || !Array.isArray(data.results)) {
          return JSON.stringify({});
        }

        const truncated = truncateSearchResults(data.results);
        const formatted = truncated.reduce<Record<string, { url: string; title: string; snippets: string[][] }>>((acc, result, index) => {
          if (!result.url) return acc;
          acc[String(index)] = {
            url: result.url,
            title: result.title || 'Untitled',
            snippets: [[result.snippet || ""]],
          };
          return acc;
        }, {});

        return JSON.stringify(formatted);
      } catch {
        return JSON.stringify({});
      }
    }

    case 'run_python': {
      const code = String(args.code);
      const description = args.description ? String(args.description) : '';

      const endpoint = process.env.PYTHON_RUNTIME_ENDPOINT;
      const apiKey = process.env.PYTHON_RUNTIME_API_KEY;

      console.log('[PYTHON] env loaded:', !!apiKey);
      console.log('[PYTHON] endpoint:', endpoint);

      if (!endpoint || !apiKey) {
        return 'Error: Python runtime belum dikonfigurasi (PYTHON_RUNTIME_ENDPOINT / PYTHON_RUNTIME_API_KEY tidak tersedia).';
      }

      const MAX_ATTEMPTS = 2;
      let lastError = '';

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        console.log('[PYTHON] attempt:', attempt);

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': apiKey,
            },
            body: JSON.stringify({ code }),
            signal: controller.signal,
          });

          clearTimeout(timeout);
          console.log('[PYTHON] status:', res.status);

          if (res.status === 401) {
            console.log('[PYTHON] 401 unauthorized — terminal error, no retry');
            return 'Error: Python runtime unauthorized (401). Periksa PYTHON_RUNTIME_API_KEY.';
          }

          if (!res.ok) {
            return `Error: Python execution failed (status ${res.status}).`;
          }

          const data = await res.json();
          const stdout = data.run?.stdout?.trim() || data.stdout?.trim() || '';
          const stderr = data.run?.stderr?.trim() || data.stderr?.trim() || '';

          console.log('[PYTHON] output injected:', !!stdout);

          if (stderr && !stdout) {
            return `Python Error:\n\`\`\`\n${stderr.slice(0, 2000)}\n\`\`\``;
          }

          let output = '';
          if (description) output += `${description}\n\n`;
          output += `Code:\n\`\`\`python\n${code}\n\`\`\`\n\n`;
          output += `Output:\n\`\`\`\n${stdout.slice(0, 5000)}\n\`\`\``;
          if (stderr) output += `\n\nWarnings:\n\`\`\`\n${stderr.slice(0, 1000)}\n\`\`\``;

          return output;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            lastError = 'Python execution timed out (15s limit).';
          } else {
            lastError = error instanceof Error ? error.message : 'Unknown error';
          }
          console.log('[PYTHON] retry:', attempt, 'error:', lastError);

          if (attempt < MAX_ATTEMPTS) {
            continue;
          }
        }
      }

      return `Error executing Python: ${lastError}`;
    }

    case 'create_expense': {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          title: args.title,
          amount: args.amount,
          category: args.category || 'other',
          date: args.date || today,
          notes: args.notes || null,
        })
        .select()
        .single();
      if (error) return `Error: ${error.message}`;
      const amt = Number(data.amount).toLocaleString('id-ID');
      return `✅ Pengeluaran dicatat: ${data.title} — Rp ${amt} (${data.category}, ${data.date})`;
    }

    case 'get_expenses': {
      const limit = Number(args.limit) || 20;
      let query = supabase.from('expenses').select('*').order('date', { ascending: false }).limit(limit);
      if (args.start_date) query = query.gte('date', args.start_date as string);
      if (args.end_date) query = query.lte('date', args.end_date as string);
      if (args.category) query = query.eq('category', args.category as string);

      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return 'Belum ada pengeluaran tercatat.';

      const total = data.reduce((sum, e) => sum + Number(e.amount), 0);
      let output = `📋 Pengeluaran (menampilkan ${data.length} data):\n`;
      data.forEach((e, i) => {
        output += `${i + 1}. ${e.date} — ${e.title} — Rp ${Number(e.amount).toLocaleString('id-ID')} (${e.category})\n`;
      });
      output += `\nTotal: Rp ${total.toLocaleString('id-ID')}`;
      return output;
    }

    case 'get_expense_summary': {
      const { startDate, endDate, periodLabel } = getPeriodDateRange(String(args.period || 'this_month'));

      let query = supabase.from('expenses').select('*');
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return `Tidak ada pengeluaran untuk periode ${periodLabel}.`;

      const total = data.reduce((sum, e) => sum + Number(e.amount), 0);
      const categoryMap: Record<string, { total: number; count: number }> = {};
      for (const e of data) {
        if (!categoryMap[e.category]) categoryMap[e.category] = { total: 0, count: 0 };
        categoryMap[e.category].total += Number(e.amount);
        categoryMap[e.category].count += 1;
      }

      const categoryEmoji: Record<string, string> = {
        food: '🍔', transport: '🚗', shopping: '🛍️', entertainment: '🎮',
        health: '💊', education: '📚', bills: '📄', other: '📦'
      };

      let output = `📊 Ringkasan Pengeluaran ${periodLabel}:\nTotal: Rp ${total.toLocaleString('id-ID')} (${data.length} transaksi)\n\nPer Kategori:\n`;

      const sorted = Object.entries(categoryMap).sort((a, b) => b[1].total - a[1].total);
      for (const [cat, info] of sorted) {
        const pct = ((info.total / total) * 100).toFixed(1);
        output += `${categoryEmoji[cat] || '📦'} ${cat}: Rp ${info.total.toLocaleString('id-ID')} (${info.count} transaksi, ${pct}%)\n`;
      }

      if (sorted.length > 0) {
        const biggest = sorted[0];
        const bigPct = ((biggest[1].total / total) * 100).toFixed(1);
        output += `\nTerbesar: ${biggest[0]} (${bigPct}%)`;
      }

      return output;
    }

    case 'delete_expense': {
      const { error } = await supabase.from('expenses').delete().eq('id', args.id as string);
      if (error) return `Error: ${error.message}`;
      return '🗑️ Pengeluaran berhasil dihapus.';
    }

    case 'create_income': {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('incomes')
        .insert({
          title: args.title,
          amount: args.amount,
          category: args.category || 'other',
          date: args.date || today,
          notes: args.notes || null,
        })
        .select()
        .single();
      if (error) return `Error: ${error.message}`;
      const amt = Number(data.amount).toLocaleString('id-ID');
      return `✅ Pemasukan dicatat: ${data.title} — Rp ${amt} (${data.category}, ${data.date})`;
    }

    case 'get_incomes': {
      const limit = Number(args.limit) || 20;
      let query = supabase.from('incomes').select('*').order('date', { ascending: false }).limit(limit);
      if (args.start_date) query = query.gte('date', args.start_date as string);
      if (args.end_date) query = query.lte('date', args.end_date as string);
      if (args.category) query = query.eq('category', args.category as string);

      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return 'Belum ada pemasukan tercatat.';

      const total = data.reduce((sum, e) => sum + Number(e.amount), 0);
      let output = `💰 Pemasukan (${data.length} records):\n`;
      data.forEach((e, i) => {
        output += `${i + 1}. ${e.date} — ${e.title} — Rp ${Number(e.amount).toLocaleString('id-ID')} (${e.category})\n`;
      });
      output += `\nTotal: Rp ${total.toLocaleString('id-ID')}`;
      return output;
    }

    case 'get_income_summary': {
      const { startDate, endDate, periodLabel } = getPeriodDateRange(String(args.period || 'this_month'));

      let query = supabase.from('incomes').select('*');
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return `Tidak ada pemasukan untuk periode ${periodLabel}.`;

      const total = data.reduce((sum, e) => sum + Number(e.amount), 0);
      const categoryMap: Record<string, { total: number; count: number }> = {};
      for (const e of data) {
        if (!categoryMap[e.category]) categoryMap[e.category] = { total: 0, count: 0 };
        categoryMap[e.category].total += Number(e.amount);
        categoryMap[e.category].count += 1;
      }

      const categoryEmoji: Record<string, string> = {
        salary: '💼', transfer: '🔄', freelance: '💻', gift: '🎁',
        investment: '📈', refund: '↩️', other: '📦'
      };

      let output = `💰 Ringkasan Pemasukan ${periodLabel}:\nTotal: Rp ${total.toLocaleString('id-ID')} (${data.length} transaksi)\n\nPer Kategori:\n`;

      const sorted = Object.entries(categoryMap).sort((a, b) => b[1].total - a[1].total);
      for (const [cat, info] of sorted) {
        const pct = ((info.total / total) * 100).toFixed(1);
        output += `${categoryEmoji[cat] || '📦'} ${cat}: Rp ${info.total.toLocaleString('id-ID')} (${info.count} transaksi, ${pct}%)\n`;
      }

      return output;
    }

    case 'delete_income': {
      const { error } = await supabase.from('incomes').delete().eq('id', args.id as string);
      if (error) return `Error: ${error.message}`;
      return '🗑️ Record pemasukan berhasil dihapus.';
    }

    case 'get_financial_summary': {
      const { startDate, endDate, periodLabel } = getPeriodDateRange(String(args.period || 'this_month'));

      // Query expenses
      let expQuery = supabase.from('expenses').select('*');
      if (startDate) expQuery = expQuery.gte('date', startDate);
      if (endDate) expQuery = expQuery.lte('date', endDate);
      const { data: expData } = await expQuery;

      // Query incomes
      let incQuery = supabase.from('incomes').select('*');
      if (startDate) incQuery = incQuery.gte('date', startDate);
      if (endDate) incQuery = incQuery.lte('date', endDate);
      const { data: incData } = await incQuery;

      const expenseTotal = (expData || []).reduce((sum, e) => sum + Number(e.amount), 0);
      const incomeTotal = (incData || []).reduce((sum, e) => sum + Number(e.amount), 0);
      const net = incomeTotal - expenseTotal;

      // Top categories
      const expCatMap: Record<string, number> = {};
      for (const e of (expData || [])) {
        expCatMap[e.category] = (expCatMap[e.category] || 0) + Number(e.amount);
      }
      const topExpCat = Object.entries(expCatMap).sort((a, b) => b[1] - a[1])[0];

      const incCatMap: Record<string, number> = {};
      for (const e of (incData || [])) {
        incCatMap[e.category] = (incCatMap[e.category] || 0) + Number(e.amount);
      }
      const topIncCat = Object.entries(incCatMap).sort((a, b) => b[1] - a[1])[0];

      let output = `📊 Ringkasan Keuangan ${periodLabel}:\n\n`;
      output += `💰 Total Pemasukan: Rp ${incomeTotal.toLocaleString('id-ID')}\n`;
      output += `💸 Total Pengeluaran: Rp ${expenseTotal.toLocaleString('id-ID')}\n`;
      output += `━━━━━━━━━━━━━━━━━━\n`;
      output += `💎 Saldo Bersih: Rp ${Math.abs(net).toLocaleString('id-ID')} (${net >= 0 ? 'surplus' : 'defisit'})\n`;

      if (topExpCat) {
        output += `\nTop Pengeluaran: ${topExpCat[0]} (Rp ${topExpCat[1].toLocaleString('id-ID')})`;
      }
      if (topIncCat) {
        output += `\nTop Pemasukan: ${topIncCat[0]} (Rp ${topIncCat[1].toLocaleString('id-ID')})`;
      }

      return output;
    }

    case 'save_memory': {
      const content = String(args.content);
      const category = String(args.category || 'general');
      const rawImportance = Number(args.importance);
      const importance = isNaN(rawImportance) ? 5 : Math.min(10, Math.max(1, rawImportance));

      const { error } = await supabase
        .from('memories')
        .insert({
          content,
          category,
          importance,
          source: 'manual',
        });
      if (error) return `Error: ${error.message}`;
      return `🧠 Diingat: ${content}`;
    }

    case 'get_memories': {
      const limit = Number(args.limit) || 10;
      let query = supabase
        .from('memories')
        .select('*')
        .order('importance', { ascending: false })
        .order('last_used_at', { ascending: false })
        .limit(limit);

      if (args.query) {
        query = query.ilike('content', `%${String(args.query)}%`);
      }
      if (args.category) {
        query = query.eq('category', args.category as string);
      }

      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return '🧠 Belum ada memory tersimpan.';

      // Update last_used_at for retrieved memories
      const ids = data.map(m => m.id);
      await supabase
        .from('memories')
        .update({ last_used_at: new Date().toISOString() })
        .in('id', ids);

      let output = `🧠 Memories (${data.length} found):\n`;
      data.forEach((m, i) => {
        output += `${i + 1}. ${m.content} (${m.category}, importance: ${m.importance}/10)\n`;
      });
      return output.trim();
    }

    case 'delete_memory': {
      const { error } = await supabase.from('memories').delete().eq('id', args.id as string);
      if (error) return `Error: ${error.message}`;
      return '🧠 Memory dihapus.';
    }

    case 'create_quiz': {
      const topic = String(args.topic);
      const numQuestions = Math.min(20, Math.max(3, Number(args.num_questions) || 5));
      const difficulty = (args.difficulty as string) || 'medium';

      // Generate quiz questions using AI
      const quizPrompt = `Generate ${numQuestions} multiple choice questions tentang "${topic}", difficulty: ${difficulty}.

IMPORTANT: Output HARUS berupa valid JSON array ONLY, tanpa teks lain. Setiap question object harus punya:
- question (string): pertanyaan dalam Bahasa Indonesia
- options (array of 4 strings): 4 pilihan jawaban dalam Bahasa Indonesia
- correct (number 0-3): index jawaban benar
- explanation (string): penjelasan singkat kenapa jawaban itu benar dalam Bahasa Indonesia

Format EXACT yang diharapkan:
[
  {
    "question": "Pertanyaan di sini?",
    "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
    "correct": 1,
    "explanation": "Penjelasan jawaban benar."
  }
]

JSON ARRAY ONLY. NO other text before or after.`;

      try {
        const response = await fetch(`${process.env.MAIA_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MAIA_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a quiz generator. Output valid JSON only. No markdown, no explanation, just pure JSON array.' },
              { role: 'user', content: quizPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          return `Error: Gagal generate quiz (${response.status})`;
        }

        const data = await response.json();
        let content = data.choices[0]?.message?.content?.trim() || '';

        // Clean up potential markdown code blocks
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parse JSON
        let questions;
        try {
          questions = JSON.parse(content);
        } catch {
          // Try to extract JSON array from content
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            questions = JSON.parse(jsonMatch[0]);
          } else {
            return 'Error: Gagal parse quiz questions dari AI response.';
          }
        }

        if (!Array.isArray(questions) || questions.length === 0) {
          return 'Error: AI tidak menghasilkan questions yang valid.';
        }

        // Validate and number questions
        const validatedQuestions = questions.map((q: { question?: string; options?: string[]; correct?: number; explanation?: string }, idx: number) => {
          if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 ||
              typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3 || !q.explanation) {
            throw new Error(`Invalid question format at index ${idx}`);
          }
          return {
            id: idx + 1,
            question: q.question,
            options: q.options,
            correct: q.correct,
            explanation: q.explanation,
          };
        });

        // Save to database
        const { data: quiz, error } = await supabase
          .from('quizzes')
          .insert({
            topic,
            difficulty,
            questions: validatedQuestions,
            total_questions: validatedQuestions.length,
          })
          .select()
          .single();

        if (error) return `Error: ${error.message}`;

        // Return quiz data in special format for frontend to render as interactive UI
        // We remove correct answers and explanations from client-side data
        const clientQuestions = validatedQuestions.map((q: { id: number; question: string; options: string[] }) => ({
          id: q.id,
          question: q.question,
          options: q.options,
        }));

        return `${QUIZ_DATA_PREFIX}${quiz.id}::${JSON.stringify({
          id: quiz.id,
          topic,
          difficulty,
          total_questions: validatedQuestions.length,
          questions: clientQuestions,
        })}`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return `Error generate quiz: ${msg}`;
      }
    }

    case 'get_quiz_history': {
      const limit = Number(args.limit) || 10;

      // Get quizzes with their attempts
      const { data: quizzes, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return `Error: ${error.message}`;
      if (!quizzes?.length) return '📚 Belum ada riwayat quiz.';

      // Get attempts for these quizzes
      const quizIds = quizzes.map(q => q.id);
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('*')
        .in('quiz_id', quizIds)
        .order('completed_at', { ascending: false });

      const attemptsMap: Record<string, { score: number; total: number; completed_at: string }[]> = {};
      for (const att of (attempts || [])) {
        if (!attemptsMap[att.quiz_id]) attemptsMap[att.quiz_id] = [];
        attemptsMap[att.quiz_id].push(att);
      }

      let output = `📚 Riwayat Quiz (${quizzes.length} quiz):\n\n`;
      for (const quiz of quizzes) {
        const quizAttempts = attemptsMap[quiz.id] || [];
        const bestAttempt = quizAttempts.length > 0
          ? quizAttempts.reduce((best, curr) => (curr.score / curr.total) > (best.score / best.total) ? curr : best)
          : null;

        const difficultyEmoji = quiz.difficulty === 'easy' ? '🟢' : quiz.difficulty === 'medium' ? '🟡' : '🔴';
        output += `• ${quiz.topic} ${difficultyEmoji} (${quiz.total_questions} soal)\n`;
        if (bestAttempt) {
          const pct = Math.round((bestAttempt.score / bestAttempt.total) * 100);
          output += `  Skor terbaik: ${bestAttempt.score}/${bestAttempt.total} (${pct}%)\n`;
        } else {
          output += `  Belum dikerjakan\n`;
        }
        output += `  Dibuat: ${new Date(quiz.created_at).toLocaleDateString('id-ID')}\n\n`;
      }

      return output.trim();
    }

    case 'get_quiz_stats': {
      // Get all attempts
      const { data: attempts, error: attError } = await supabase
        .from('quiz_attempts')
        .select('*');

      if (attError) return `Error: ${attError.message}`;

      // Get all quizzes
      const { data: quizzes, error: quizError } = await supabase
        .from('quizzes')
        .select('*');

      if (quizError) return `Error: ${quizError.message}`;

      if (!attempts?.length) {
        return '📊 Belum ada statistik belajar. Kerjakan quiz pertama untuk mulai tracking!';
      }

      const totalAttempts = attempts.length;
      const totalScore = attempts.reduce((sum, a) => sum + a.score, 0);
      const totalQuestions = attempts.reduce((sum, a) => sum + a.total, 0);
      const avgScore = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

      // Topic analysis
      const quizMap: Record<string, { topic: string; difficulty: string }> = {};
      for (const q of (quizzes || [])) {
        quizMap[q.id] = { topic: q.topic, difficulty: q.difficulty };
      }

      const topicStats: Record<string, { correct: number; total: number; count: number }> = {};
      for (const att of attempts) {
        const quiz = quizMap[att.quiz_id];
        if (!quiz) continue;
        const topic = quiz.topic;
        if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0, count: 0 };
        topicStats[topic].correct += att.score;
        topicStats[topic].total += att.total;
        topicStats[topic].count += 1;
      }

      const topicScores = Object.entries(topicStats)
        .map(([topic, stats]) => ({
          topic,
          score: (stats.correct / stats.total) * 100,
          count: stats.count,
        }))
        .sort((a, b) => b.score - a.score);

      const strongest = topicScores[0];
      const weakest = topicScores[topicScores.length - 1];

      let output = `📊 Statistik Belajar:\n\n`;
      output += `📝 Total quiz dikerjakan: ${totalAttempts}\n`;
      output += `📈 Rata-rata skor: ${avgScore}%\n`;
      output += `✅ Total soal dijawab benar: ${totalScore}/${totalQuestions}\n\n`;

      if (strongest && topicScores.length > 0) {
        output += `🏆 Topik terkuat: ${strongest.topic} (${Math.round(strongest.score)}%)\n`;
      }
      if (weakest && topicScores.length > 1 && weakest.topic !== strongest?.topic) {
        output += `📚 Perlu ditingkatkan: ${weakest.topic} (${Math.round(weakest.score)}%)\n`;
      }

      return output.trim();
    }

    case 'send_notification': {
      const { error } = await supabase
        .from('notifications')
        .insert({
          title: args.title,
          message: args.message,
          type: args.type || 'info',
        });
      if (error) return `Error: ${error.message}`;
      return `🔔 Notifikasi terkirim: "${args.title}"`;
    }

    case 'create_scheduled_task': {
      const cronExp = String(args.cron_expression).trim();
      if (!/^(\S+\s+){4}\S+$/.test(cronExp)) {
        return '❌ Format cron expression tidak valid. Gunakan 5 field: menit jam tanggal bulan hari. Contoh: "0 7 * * *"';
      }

      const taskName = String(args.name).trim();
      const encodedName = encodeURIComponent(taskName);
      const schedulerUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://nimbus-brain.vercel.app'}/api/scheduler?task=${encodedName}`;

      // Call EasyCron API
      let easycronId: string | null = null;
      try {
        const easycronRes = await fetch('https://www.easycron.com/rest/add', {
          method: 'POST',
          headers: {
            'X-API-Key': process.env.EASYCRON_API_KEY || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: schedulerUrl,
            cron_expression: cronExp,
          }),
        });
        const easycronData = await easycronRes.json();
        if (easycronData.status === 'success' && easycronData.cron_job_id) {
          easycronId = String(easycronData.cron_job_id);
        } else {
          return `❌ EasyCron error: ${easycronData.error || JSON.stringify(easycronData)}`;
        }
      } catch (err) {
        return `❌ Gagal menghubungi EasyCron: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }

      const { data, error } = await supabase
        .from('scheduled_tasks')
        .insert({
          easycron_id: easycronId,
          name: taskName,
          prompt: args.prompt,
          cron_expression: cronExp,
        })
        .select()
        .single();
      if (error) return `Error menyimpan ke database: ${error.message}`;
      return `📅 Task "${data.name}" berhasil dibuat! Cron: ${cronExp} | ID: ${data.id}`;
    }

    case 'get_scheduled_tasks': {
      let query = supabase.from('scheduled_tasks').select('*').order('created_at', { ascending: false });
      if (args.status && args.status !== 'all') query = query.eq('status', args.status as string);

      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return 'Belum ada scheduled tasks.';

      return data.map((t: { id: string; name: string; status: string; prompt: string; cron_expression: string }) => {
        return `• ${t.name} [${t.status}] — "${t.prompt}" | Cron: ${t.cron_expression} | ID: ${t.id}`;
      }).join('\n');
    }

    case 'update_scheduled_task': {
      const taskId = String(args.task_id);
      const newCron = String(args.cron_expression).trim();
      if (!/^(\S+\s+){4}\S+$/.test(newCron)) {
        return '❌ Format cron expression tidak valid. Gunakan 5 field: menit jam tanggal bulan hari.';
      }

      const { data: task, error: findErr } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      if (findErr || !task) return `Task dengan ID "${taskId}" tidak ditemukan.`;

      // Update EasyCron
      if (task.easycron_id) {
        try {
          const easycronRes = await fetch('https://www.easycron.com/rest/edit', {
            method: 'POST',
            headers: {
              'X-API-Key': process.env.EASYCRON_API_KEY || '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cron_job_id: task.easycron_id,
              cron_expression: newCron,
            }),
          });
          const easycronData = await easycronRes.json();
          if (easycronData.status !== 'success') {
            return `❌ EasyCron error: ${easycronData.error || JSON.stringify(easycronData)}`;
          }
        } catch (err) {
          return `❌ Gagal menghubungi EasyCron: ${err instanceof Error ? err.message : 'Unknown error'}`;
        }
      }

      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ cron_expression: newCron })
        .eq('id', taskId)
        .select()
        .single();
      if (error) return `Error: ${error.message}`;
      return `📅 Task "${data.name}" berhasil diupdate. Cron baru: ${newCron}`;
    }

    case 'delete_scheduled_task': {
      const taskId = String(args.task_id);

      const { data: task, error: findErr } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      if (findErr || !task) return `Task dengan ID "${taskId}" tidak ditemukan.`;

      // Delete from EasyCron
      if (task.easycron_id) {
        try {
          const easycronRes = await fetch('https://www.easycron.com/rest/delete', {
            method: 'POST',
            headers: {
              'X-API-Key': process.env.EASYCRON_API_KEY || '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cron_job_id: task.easycron_id,
            }),
          });
          const easycronData = await easycronRes.json();
          if (easycronData.status !== 'success') {
            console.error('[EASYCRON] Delete failed:', easycronData);
          }
        } catch (err) {
          console.error('[EASYCRON] Delete request failed:', err);
        }
      }

      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', taskId);
      if (error) return `Error: ${error.message}`;
      return `🗑️ Task "${task.name}" berhasil dihapus dari EasyCron dan database.`;
    }

    case 'reset_finance': {
      if (args.confirm !== true) {
        return '⚠️ Reset keuangan membutuhkan konfirmasi. Kirim dengan confirm: true untuk melanjutkan.';
      }

      const { data: expData } = await supabase.from('expenses').select('id');
      const { data: incData } = await supabase.from('incomes').select('id');
      const expCount = expData?.length || 0;
      const incCount = incData?.length || 0;

      const { error: expError } = await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (expError) return `Error menghapus expenses: ${expError.message}`;

      const { error: incError } = await supabase.from('incomes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (incError) return `Error menghapus incomes: ${incError.message}`;

      await insertNotification(
        'Data Keuangan Direset',
        `${expCount} pengeluaran dan ${incCount} pemasukan telah dihapus.`,
        'warning'
      );

      return `🗑️ Data keuangan berhasil direset. ${expCount} pengeluaran dan ${incCount} pemasukan dihapus.`;
    }

    case 'delete_all_threads': {
      if (args.confirm !== true) {
        return '⚠️ Hapus semua thread membutuhkan konfirmasi. Kirim dengan confirm: true untuk melanjutkan.';
      }

      const { data: convData } = await supabase.from('conversations').select('id');
      const convCount = convData?.length || 0;

      const { error } = await supabase.from('conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) return `Error: ${error.message}`;

      await insertNotification(
        'Semua Thread Dihapus',
        `${convCount} percakapan beserta semua pesannya telah dihapus.`,
        'warning'
      );

      return `🗑️ ${convCount} percakapan beserta semua pesan berhasil dihapus.`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

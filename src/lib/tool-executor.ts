import { supabase } from './supabase';

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
            max_results: 5,
            search_depth: 'basic',
            include_answer: true,
          }),
        });
        if (!tavilyRes.ok) {
          return `Gagal melakukan pencarian web untuk "${query}" (status ${tavilyRes.status}).`;
        }
        const data = await tavilyRes.json();
        let output = `Web Search Results for "${query}":\n\n`;
        if (data.answer) {
          output += `Answer: ${data.answer}\n\n`;
        }
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((r: { title?: string; url?: string; content?: string }, i: number) => {
            const snippet = r.content ? r.content.slice(0, 200) : '';
            output += `${i + 1}. ${r.title || 'Untitled'} — ${r.url || ''}\n   ${snippet}\n\n`;
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

    default:
      return `Unknown tool: ${name}`;
  }
}

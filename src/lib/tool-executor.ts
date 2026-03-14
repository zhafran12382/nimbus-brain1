import { supabase } from './supabase';

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

    default:
      return `Unknown tool: ${name}`;
  }
}

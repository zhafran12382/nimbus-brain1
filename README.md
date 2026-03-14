# 🧠 Nimbus Brain

**Agentic Personal Dashboard** — AI chatbot yang terintegrasi dengan sistem manajemen target/goal pribadi. Dibangun dengan Next.js, Supabase, dan AI function calling.

## ✨ Fitur Utama

### 🎯 Target Manager
- Buat, edit, dan hapus target/goal pribadi
- Tracking progress secara real-time
- 5 kategori bawaan: **Study**, **Fitness**, **Finance**, **Project**, **Custom**
- Status tracking: Active, Completed, Failed, Paused
- Visualisasi progress dengan persentase
- Deadline dan deskripsi untuk setiap target
- Filter berdasarkan status dan kategori
- Sinkronisasi real-time dengan database

### 💬 AI Chat Assistant
- Interface percakapan dengan bahasa Indonesia
- AI agent dengan kemampuan function calling
- Riwayat chat tersimpan di database
- Pemilihan model AI

### 🤖 AI Agent Tools
AI dapat menjalankan aksi secara otomatis melalui percakapan:
- **create_target** — Buat target baru
- **update_target_progress** — Update progress target
- **get_targets** — Ambil daftar target dengan filter
- **delete_target** — Hapus target
- **get_target_summary** — Ringkasan semua target aktif

## 🛠️ Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| UI | [React 19](https://react.dev), [Radix UI](https://radix-ui.com), [Lucide Icons](https://lucide.dev) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Database | [Supabase](https://supabase.com) (PostgreSQL + Realtime) |
| AI | Maia Router API (function calling) |
| Deployment | [Netlify](https://netlify.com) |
| Bahasa | TypeScript |

## 📁 Struktur Project

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home → redirect ke /targets
│   ├── chat/page.tsx           # Halaman chat AI
│   ├── targets/page.tsx        # Halaman target manager
│   └── api/chat/route.ts       # API endpoint chat
├── components/
│   ├── chat/                   # Komponen chat
│   ├── targets/                # Komponen target manager
│   ├── layout/                 # App shell, sidebar, header
│   └── ui/                     # Primitif UI (Radix-based)
├── lib/
│   ├── models.ts               # Konfigurasi model AI
│   ├── supabase.ts             # Supabase client
│   ├── tools.ts                # Definisi tools AI
│   └── tool-executor.ts        # Eksekusi tools
└── types/
    └── index.ts                # TypeScript interfaces
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) v18+
- [npm](https://www.npmjs.com)
- Akun [Supabase](https://supabase.com)

### Instalasi

1. **Clone repository**
   ```bash
   git clone https://github.com/zhafran12382/nimbus-brain1.git
   cd nimbus-brain1
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**

   Buat file `.env.local` di root project:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

   # Maia Router API
   MAIA_BASE_URL=https://your-maia-api-url
   MAIA_API_KEY=your-api-key
   ```

4. **Jalankan development server**
   ```bash
   npm run dev
   ```

5. Buka [http://localhost:3000](http://localhost:3000) di browser.

## 📦 Scripts

| Script | Deskripsi |
|--------|-----------|
| `npm run dev` | Jalankan development server |
| `npm run build` | Build untuk production |
| `npm run start` | Jalankan production server |
| `npm run lint` | Jalankan ESLint |

## 🌐 Deploy ke Netlify

Project ini sudah dikonfigurasi untuk deploy ke Netlify dengan `netlify.toml`.

### Deploy Otomatis

1. Push repository ke GitHub
2. Hubungkan repository di [Netlify Dashboard](https://app.netlify.com)
3. Set environment variables di **Site settings → Environment variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `MAIA_BASE_URL`
   - `MAIA_API_KEY`
4. Netlify akan otomatis build dan deploy setiap ada push ke branch utama

### Deploy Manual (Netlify CLI)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login ke Netlify
netlify login

# Deploy
netlify deploy --prod
```

## 📄 Lisensi

Project ini bersifat private.

# BOT Spin Wheel

## Prasyarat
- Node.js 18+

## Langkah
1. `cd backend`
2. `cp .env.example .env` (opsional edit)
3. `npm i`
4. `npm run dev`

Back-end jalan di `http://localhost:8080`.

### Coba Admin
- Buka `admin/admin.html` dengan Live Server (mis. VS Code) atau host statis.
- Masukkan **Admin API Key** sesuai `.env` (default contoh: `replace-with-strong-key`).
- Kelola wheel & slices.

### Coba User
- Buka `user/spin.html` (Live Server). Pastikan CORS mengizinkan origin-mu; edit `ALLOWED_ORIGINS` di `.env` jika perlu.

## Produksi
- Ganti SQLite ke PostgreSQL bila perlu (ORM Prisma) → kontrak API sama.
- Tambahkan CDN/Cloudflare; aktifkan HTTPS; atur cookie `secure:true`.
- Tambahkan rate limit IP & PoW bila traffic sangat besar.

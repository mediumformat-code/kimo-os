# Aktivasi integrasi KIMO OS

Kode siap diaktifkan; koneksi Google belum aktif sampai OAuth selesai. Tiga sheet DDO/DDS sudah terdaftar dengan tab yang diberikan. Data lama tetap ada sampai pemilik meninjau impor, mengunduh backup, dan menyetujui penggantian.

## Google Workspace

1. Buka https://console.cloud.google.com/ dan buat project `KIMO OS`.
2. Pada APIs & Services → Library, aktifkan Google Calendar API, Gmail API, Google Drive API, Google Docs API, dan Google Sheets API.
3. Google Auth Platform: isi Branding dan email kontak. Audience pilih Internal jika project berada dalam organisasi Workspace yang sesuai; jika tidak, pilih External → Testing, lalu tambahkan email kamu sebagai test user.
4. Data Access: tambahkan `openid`, `email`, `https://www.googleapis.com/auth/calendar.readonly`, `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/drive.readonly`, `https://www.googleapis.com/auth/documents.readonly`, dan `https://www.googleapis.com/auth/spreadsheets.readonly`.
5. Clients → Create client → Web application. Authorized redirect URI: `https://kimo-os-rbcy.vercel.app/api/google/callback`. Simpan Client ID dan Client Secret di Vercel, jangan kirim ke chat.
6. Supabase SQL Editor: jalankan isi [activate-integrations.sql](../supabase/activate-integrations.sql). Ini hanya menambah tabel integrasi dan fungsi proposal; tidak menghapus workspace. Migrasi workspace awal harus sudah ada.
7. Vercel → project KIMO OS → Environment Variables → Production. Tambahkan variabel server berikut:

| Key | Value |
| --- | --- |
| GOOGLE_CLIENT_ID | Client ID dari Google |
| GOOGLE_CLIENT_SECRET | Client Secret dari Google |
| GOOGLE_REDIRECT_URI | https://kimo-os-rbcy.vercel.app/api/google/callback |
| GOOGLE_TOKEN_ENCRYPTION_KEY | Key 32 byte dari Settings KIMO OS → Google setup; simpan aman dan jangan ubah setelah koneksi aktif |
| SUPABASE_SERVICE_ROLE_KEY | Supabase → Settings → API Keys → Legacy service_role key |

Semua variabel ini server-only: jangan gunakan awalan NEXT_PUBLIC_. Dua variabel Supabase publik yang sudah ada tetap digunakan.

8. Redeploy Production dengan build cache tidak dicentang. Login KIMO OS → Settings → Connect Google → pilih akun yang dapat membuka ketiga sheet → izinkan akses → Sync.
9. Sources → pilih sumber DDO/DDS, pilih baris header dan kolom nama proyek serta owner. Periksa hasil setiap sheet, gabungkan sumber, unduh backup, lalu konfirmasi impor. Jangan impor baris total/dashboard sebagai proyek. Status awal Watch dan priority 50 adalah nilai awal aplikasi, bukan kesimpulan bisnis dari sheet.

Sync membaca kalender terpilih/utama dari kemarin sampai 14 hari ke depan, maksimal 40 acara per kalender dan 10 kalender; 20 email inbox terbaru dalam 30 hari; 40 file Drive terbaru. Preview dokumen dibatasi, impor sheet maksimal 500 baris dan 52 kolom pada tab yang ditentukan. Sync dijalankan manual. Google belum digunakan untuk mengirim email atau mengubah dokumen. Akun External Testing biasanya membutuhkan reconnect setelah refresh token kedaluwarsa dalam 7 hari; kebijakan admin Workspace dapat membatasi izin.

## GPT ↔ KIMO OS

KIMO OS adalah pusat data. Custom GPT membaca workspace dan mengusulkan perubahan; pemilik meninjau proposal sebelum data diganti. Tidak ada akses otomatis ke riwayat seluruh percakapan ChatGPT.

1. Setelah SQL integrasi dijalankan dan service-role key dikonfigurasi, buka Sources → GPT bridge → buat key. Key hanya ditampilkan sekali dan berlaku 90 hari; membuat key baru membatalkan key lama.
2. Di editor Custom GPT → Configure → Actions → Import from URL: `https://kimo-os-rbcy.vercel.app/api/gpt/schema`.
3. Authentication: API Key → Bearer, isi key dari Sources. Jangan kirim key ke chat. Instruksikan GPT membaca workspace dahulu, mempertahankan data yang masih diperlukan, dan mengajukan proposal lengkap untuk perubahan.
4. Sources → refresh proposal → review → backup → apply. Konflik revisi ditolak agar perubahan perangkat lain tidak tertimpa.

Untuk chat AI dari dalam KIMO OS, tambahkan `OPENAI_API_KEY` server-only di Vercel dan redeploy. Opsional `OPENAI_MODEL` (default `gpt-4.1`). Penggunaan API memiliki billing terpisah dari langganan ChatGPT. Chat mengirim workspace tersimpan sebagai konteks ke OpenAI; tidak otomatis membaca Gmail atau menulis data.

## Plaud dan sumber lain

Plaud tersedia melalui impor hasil export teks/Markdown, bukan sinkronisasi akun langsung. Sources → Plaud import → isi judul, tanggal, proyek terkait dan peserta → review ringkasan → simpan sebagai meeting. Koneksi langsung baru dapat dibuat setelah akses API/webhook resmi tersedia.

Export proyek GPT tersedia melalui impor JSON. Review menunjukkan perubahan sebelum penggantian. Sumber sheet, JSON, dan Plaud diperlakukan sebagai data, bukan instruksi untuk mengeksekusi tindakan.

# Bot Agensi Talent Produk

Bot Telegram + Mini App untuk agensi talent model produk:

- **Live chat relay** — pesan pengguna diteruskan ke grup admin (gaya Livegram); admin membalas dengan reply, dan bisa mengakhiri sesi lewat tombol.
- **Mini App** (Telegram Web App) — halaman Beranda, Katalog Talent (kartu ala polaroid, deskripsi, **paket harga**, bukan harga per-orang untuk chat langsung), Info & Promo, dan Aturan.
- **Order terstruktur** — tombol order pada halaman talent membuka **form** (brand, jenis produk, tanggal shoot, budget, kebutuhan) yang dikirim ke grup admin sebagai pesan terstruktur — bukan membuka chat 1-on-1 yang menyebut nama talent.
- **Database JSON** dengan export/import/restore manual (perintah owner) dan backup otomatis berkala, disimpan di Railway Volume.

## Kenapa desainnya seperti ini

Katalog talent sengaja **tidak** menampilkan harga per-individu dengan tombol "chat langsung" yang otomatis membuka percakapan menyebut nama talent tertentu. Order selalu melalui form terstruktur ke tim admin. Live chat tetap ada, tapi terpisah — untuk pertanyaan umum/support, bukan untuk memilih dan langsung menghubungi satu talent secara personal.

## Struktur proyek

```
src/
  config.js          # baca .env
  index.js           # entry point: start bot + server
  db/
    store.js          # engine JSON database (atomic write)
    backup.js          # export / import / restore / auto-backup
  bot/
    bot.js             # setup Telegraf, daftarkan semua handler
    session.js          # state sesi live chat per pengguna
    userProfile.js       # profil pengguna (jumlah pesan, dsb)
    keyboards.js          # tombol inline (buka mini app, akhiri sesi)
    handlers/
      start.js            # /start (+ deep link ?start=support)
      relay.js              # relay pesan user <-> grup admin
      ownerCommands.js      # /exportdb /importdb /restoredb /addtalent dst.
  server/
    app.js               # Express: serve mini app + daftarkan API
    middleware/telegramAuth.js  # validasi initData Mini App
    routes/
      talent.js, info.js, booking.js
webapp/                 # Mini App (HTML/CSS/JS statis, tanpa build step)
```

## Menjalankan secara lokal

```bash
cp .env.example .env
# isi BOT_TOKEN, OWNER_ID, ADMIN_GROUP_ID, PUBLIC_URL
npm install
npm start
```

`PUBLIC_URL` perlu URL https publik (untuk Telegram Web App) — saat development lokal, pakai tunnel seperti ngrok/Cloudflare Tunnel lalu isi URL tunnel tersebut.

## Deploy ke Railway

1. Push folder ini ke sebuah repo GitHub.
2. Di Railway: **New Project → Deploy from GitHub repo**.
3. Tambahkan **Volume** ke service ini, dengan **Mount Path: `/app/data`**.
   - Railway menjalankan aplikasi dari root repo di dalam container, yaitu `/app`.
   - `DATA_DIR` di `.env.example` sudah diset ke `./data` (path relatif), yang otomatis mengarah ke `/app/data` saat aplikasi berjalan.
   - Jadi mount path volume **harus** `/app/data` — kalau beda, database tidak akan tersimpan permanen dan hilang setiap redeploy.
4. Isi environment variables sesuai `.env.example` (`BOT_TOKEN`, `OWNER_ID`, `ADMIN_GROUP_ID`, `PUBLIC_URL` = domain Railway kamu, `PORT` biasanya otomatis dari Railway, `DATA_DIR` biarkan `./data`).
5. Deploy. Railway akan menjalankan `npm start`.
6. Di @BotFather: set **Menu Button / Web App URL** bot ke `PUBLIC_URL` supaya tombol "Buka Katalog Talent" bekerja.
7. Setelah deploy pertama berhasil, cek log untuk memastikan folder `data/backups` dan `data/db.json` sudah dibuat di dalam volume (bukan hilang saat redeploy berikutnya) — ini tandanya volume sudah terpasang dengan benar.

## Setup awal grup admin

1. Buat grup Telegram, tambahkan bot sebagai anggota lalu jadikan admin (butuh izin kirim pesan & baca semua pesan — matikan Privacy Mode bot lewat @BotFather → `/setprivacy` → Disable, kalau grup bukan forum khusus admin kecil).
2. Di dalam grup, kirim `/groupid` untuk mendapatkan Chat ID, lalu isi ke `ADMIN_GROUP_ID`.
3. Restart bot.

## Perintah owner (hanya `OWNER_ID`)

| Perintah | Fungsi |
|---|---|
| `/stats` | ringkasan pengguna, sesi, talent, order |
| `/exportdb` | kirim file database saat ini sebagai dokumen |
| `/importdb` | reply ke file `.json` dengan perintah ini untuk mengganti database |
| `/restoredb` | pilih dari daftar backup untuk dipulihkan |
| `/addtalent Nama \| Deskripsi \| URL Foto \| Paket:Harga, Paket2:Harga2` | tambah talent |
| `/listtalents` | daftar talent + ID |
| `/deltalent <id>` | hapus talent |
| `/toggletalent <id>` | aktif/nonaktifkan talent di katalog |
| `/setrules <teks>` | ubah halaman Aturan |
| `/setinfo <ads\|channel\|group\|sponsor> Judul \| Isi \| URL` | ubah halaman Info |
| `/setbg <home\|talent\|info\|rules> <#hex atau URL gambar>` | ubah latar belakang halaman tersebut di Mini App |
| `/resetbg <home\|talent\|info\|rules>` | kembalikan latar belakang halaman ke warna default |
| `/orders` | lihat order terbaru |

Backup otomatis berjalan tiap `AUTO_BACKUP_INTERVAL_MIN` menit (default 60), menyimpan maksimal `AUTO_BACKUP_KEEP` file terakhir (default 48) di `data/backups/`.

## Alur order (mini app)

1. Pengguna membuka Mini App → tab **Talent** → tap kartu talent.
2. Lembar detail menampilkan foto, deskripsi, dan **daftar paket** (bukan harga per orang untuk chat langsung).
3. Tombol **Ajukan Order** membuka form: nama brand, jenis produk, tanggal shoot, budget, kebutuhan.
4. Saat dikirim, form memanggil `POST /api/booking`, tersimpan ke database, dan pesan terstruktur otomatis dikirim ke grup admin untuk ditindaklanjuti.

## Alur live chat (bot)

1. Pengguna kirim pesan apa pun ke bot secara pribadi (atau tap tombol live chat di mini app → `?start=support`).
2. Bot meneruskan pesan ke grup admin dengan header info pengguna + tombol **Akhiri Sesi**.
3. Admin membalas dengan **reply** ke pesan tersebut di grup → otomatis diteruskan ke pengguna.
4. Admin tap **Akhiri Sesi** kapan saja untuk menutup sesi; pengguna diberi tahu dan bisa memulai sesi baru dengan mengirim pesan lagi.

## Mengubah latar belakang setiap halaman Mini App

Setiap halaman (`home`, `talent`, `info`, `rules`) punya latar belakang sendiri-sendiri yang bisa diganti tanpa perlu edit kode, lewat perintah owner di bot:

```
/setbg home #fdf6ec
/setbg talent https://contoh.com/gambar-latar.jpg
/setbg info #eef2e6
/setbg rules #f5f1e6
```

- Kalau nilainya dimulai dengan `http://` atau `https://` → dianggap **gambar** (dipasang sebagai `background-image`, otomatis `cover` dan center).
- Kalau nilainya kode warna heksadesimal (`#rrggbb` atau `#rgb`) → dianggap **warna solid**.
- `/resetbg <halaman>` mengembalikan halaman tersebut ke warna default (`#f5f1e6`).
- Perubahan langsung berlaku saat pengguna membuka/refresh Mini App — tidak perlu redeploy.

Latar belakang ini diambil dari endpoint `GET /api/theme` yang dibaca oleh `webapp/app.js` saat Mini App dimuat.

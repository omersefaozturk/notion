# 📒 Ortak Plan

Eşinle birlikte kullanmak için Notion benzeri bir planlayıcı. Günlük, haftalık ve aylık
planlarınızı, hedeflerinizi, yapılacaklarınızı ve takviminizi tek yerde toplar.

Her kişinin kendi takvimi ve planları vardır. İstediğiniz an **Ortak** görünüme geçip
ikinizin kayıtlarını aynı takvimde görebilirsiniz. Her kayıt, sahibinin renginde küçük
bir harfle işaretlenir (ör. **Ö** = Ömer, **E** = Eşim).

![Ortak takvim](docs/screenshots/takvim-ortak.png)

## Özellikler

- **İki (veya daha fazla) kullanıcı, tek ev:** Biri hesap açar, diğeri davet koduyla aynı
  eve katılır.
- **Benim / Eşim / Ortak görünümü:** Üst çubuktaki seçici tüm ekranlara uygulanır.
  - *Benim*: yalnızca benim kayıtlarım
  - *Eşim*: yalnızca eşimin paylaştığı kayıtlar
  - *Ortak*: ikimizin kayıtları birlikte, her biri sahibinin harfiyle
- **Ortak / Özel:** Her kayıt varsayılan olarak ortaktır; *Özel 🔒* yaptığınız kayıtları
  eşiniz hiçbir görünümde göremez.
- **Takvim (Ay / Hafta / Gün):** Ayın tamamı normal bir takvim gibi görünür. Etkinlikler,
  son tarihli görevler, günlük hedefler ve planlar hücrelerde; ayın ve haftanın hedefleri
  takvimin yanında listelenir. Bir güne tıklayıp etkinlik eklenir, gün numarasına
  tıklayınca o günün ayrıntılı görünümü açılır. Telefonda hücrelerde kişilerin harfleri
  gösterilir, güne dokununca o günün listesi açılır.
- **Bugün paneli:** Bugünün etkinlikleri ve görevleri, haftanın kalan etkinlikleri ve
  görevleri, günlük/haftalık/aylık hedefler ve planlar, görev durumu özeti.
- **Pano (Kanban):** *Yapılacak / Yapılıyor / Yapıldı* sütunları, sürükle-bırak. Eşiniz de
  ortak görevlerinizi taşıyabilir.
- **Hedefler:** Günlük, haftalık ve aylık hedefler; ilerleme çubuğu (%), tamamlandı işareti,
  dönemler arası gezinme.
- **Planlar:** Her gün/hafta/ay için plan sayfası (hazır şablonla).
- **Notion benzeri sayfa düzenleyici:** `/` komut menüsü (başlık, yapılacak, madde, numaralı
  liste, açılır liste, alıntı, bilgi kutusu, kod, ayırıcı), Enter / Backspace kısayolları,
  **Tab / Shift+Tab ile liste girintisi**, açılır listelerin açık/kapalı durumu kaydedilir,
  emoji simgesi, iç içe alt sayfalar, otomatik kaydetme.
- **Karanlık mod** (üst çubuktaki 🌙 / ☀️ düğmesi) ve mobil uyumlu arayüz.
- Saat dilimine duyarlı takvim (varsayılan *Europe/Istanbul*; tarayıcının saat dilimi
  kullanılır).

| Pano | Hedefler | Sayfa düzenleyici |
| --- | --- | --- |
| ![Pano](docs/screenshots/pano.png) | ![Hedefler](docs/screenshots/hedefler.png) | ![Sayfa](docs/screenshots/sayfa-duzenleyici.png) |

## Kurulum ve çalıştırma

Gereksinim: **Node.js 22 veya üzeri**. Veritabanı PostgreSQL'dir; yerelde ayrıca bir şey
kurmanız gerekmez: `DATABASE_URL` tanımlı değilse uygulama **PGlite** (tarayıcıda/Node'da
çalışan gerçek Postgres) kullanır ve verileri `server/data/pglite` klasöründe tutar.

```bash
npm install      # bağımlılıkları kurar
npm run seed     # örnek verilerle veritabanını (yeniden) oluşturur
npm run dev      # API (3001) ve arayüzü (5173) birlikte başlatır
```

Tarayıcıda **http://localhost:5173** adresini açın.

### Örnek hesaplar

| Kişi | E-posta | Şifre |
| --- | --- | --- |
| Ömer (Ö) | `omer@example.com` | `123456` |
| Eşim (E) | `es@example.com` | `123456` |

> `npm run seed` veritabanındaki **tüm verileri siler** ve bugüne göre örnek veriler
> (bu hafta sonu ikinizin planları, görevler, hedefler, plan sayfaları) oluşturur.
>
> Yerel PGlite veritabanını aynı anda yalnızca tek bir süreç kullanabilir: `npm run seed`
> komutunu `npm run dev` / `npm start` kapalıyken çalıştırın.

### Üretim (production)

```bash
npm run build    # arayüzü client/dist klasörüne derler
npm start        # API + derlenmiş arayüz: http://localhost:3001
```

Ortam değişkenleri (örnek: [`.env.example`](.env.example)):

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `DATABASE_URL` | — (PGlite) | PostgreSQL bağlantı adresi (ör. Supabase). Boşsa yerel PGlite kullanılır |
| `PGLITE_DIR` | `server/data/pglite` | Yerel PGlite veri klasörü (`DATABASE_URL` yokken) |
| `JWT_SECRET` | geliştirme anahtarı | Oturum imzalama anahtarı — `NODE_ENV=production` iken **zorunlu** |
| `APP_TIMEZONE` | `Europe/Istanbul` | İstemci saat dilimi göndermediğinde kullanılan saat dilimi |
| `PORT` | `3001` | Sunucu portu (`npm start`) |
| `PG_POOL_MAX` | `2` | `DATABASE_URL` ile açılan en fazla bağlantı sayısı |

Veritabanı şeması [`server/sql/schema.sql`](server/sql/schema.sql) dosyasındadır.
`npm run db:migrate` şemayı uygular (tekrar çalıştırmak güvenlidir); ayrıca sunucu ilk
sorguda tablolar eksikse şemayı kendiliğinden oluşturur, yani boş bir veritabanı da
doğrudan çalışır.

## Vercel + Supabase'e yayınlama

Uygulama Vercel'de çalışacak şekilde hazırdır: arayüz `client/dist` klasöründen statik
olarak sunulur, API ise [`api/index.js`](api/index.js) üzerinden tek bir sunucusuz
fonksiyon olarak çalışır (ayarlar [`vercel.json`](vercel.json) dosyasında). Veritabanı
olarak Supabase'in PostgreSQL'i kullanılır; oturum açma uygulamanın kendi e-posta/şifre
sistemiyle (JWT) yapılır, Supabase Auth kullanılmaz.

### 1. Supabase projesi

1. [supabase.com](https://supabase.com) → **New project**. Bir proje adı ve güçlü bir
   **veritabanı şifresi** belirleyin (bu şifreyi bir kenara not edin). Bölge olarak size
   yakın olanı (ör. *Frankfurt — eu-central-1*) seçin.
2. Proje açıldıktan sonra **Project Settings → Database → Connection string** bölümüne
   gidin (yeni arayüzde üstteki **Connect** düğmesi de aynı yere götürür).
3. **Transaction pooler** sekmesindeki **URI**'yi kopyalayın (port **6543**). Şuna benzer:

   ```
   postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```

   `[YOUR-PASSWORD]` kısmını köşeli parantezler olmadan veritabanı şifrenizle değiştirin.
   Şifrede `@`, `#`, `/`, `:` gibi özel karakterler varsa URL-kodlayın (ör. `@` → `%40`)
   ya da şifreyi yalnızca harf ve rakamlardan oluşacak şekilde sıfırlayın.

Tabloları elle oluşturmanız gerekmez: ilk istekte uygulama şemayı kendisi kurar. İsterseniz
önceden kendi bilgisayarınızdan da kurabilirsiniz:

```bash
DATABASE_URL="postgresql://postgres.xxx:SIFRE@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" npm run db:migrate
```

> Şema tüm tablolarda **Row Level Security**'yi açar (politika tanımlamadan). Bu,
> Supabase'in otomatik Data API'sinin (anon anahtarla) tablolara erişmesini engeller;
> uygulama veritabanına tablo sahibi olarak bağlandığı için etkilenmez.

### 2. Vercel projesi

1. [vercel.com](https://vercel.com) → **Add New… → Project** → GitHub hesabınızı bağlayıp
   **`omersefaozturk/notion`** deposunu **Import** edin.
2. Ayarlar:
   - **Framework Preset:** `Other`
   - **Root Directory:** depo kökü (boş bırakın / `./`)
   - Build, install ve output komutlarını değiştirmeyin; `vercel.json` bunları belirler
     (`npm install`, `npm run build`, çıktı `client/dist`). Node.js sürümü `package.json`
     içindeki `engines` alanından **22.x** olarak alınır.
3. **Environment Variables** bölümüne şunları ekleyin (Production ve Preview için):

   | Ad | Değer |
   | --- | --- |
   | `DATABASE_URL` | Supabase'den kopyaladığınız *Transaction pooler* URI'si (şifre dolu, port 6543) |
   | `JWT_SECRET` | Uzun, rastgele bir değer — üretmek için: `openssl rand -hex 32` |
   | `APP_TIMEZONE` | `Europe/Istanbul` |

4. **Deploy**'a basın. Bitince verilen adresi açıp **Kayıt ol** ile hesabınızı oluşturun,
   **Ayarlar**'daki davet kodunu eşinizle paylaşın; o da kayıt olurken bu kodu girer.

**Dallar (branch) hakkında:** Vercel, deponun varsayılan dalını (*main*) **Production**
olarak yayınlar. Diğer dallara (ör. `claude/notion-planning-app-kck021`) yapılan her push
için ayrı bir **Preview** adresi oluşturulur. Bu dal `main`'e birleştirilene kadar
uygulamayı Vercel panosundaki *Deployments* listesinden Preview adresiyle açabilirsiniz;
birleştirdikten sonra ana (production) adres güncellenir. Ortam değişkenlerini Preview
için de eklediğinizden emin olun (aynı veritabanını kullanırlar).

### 3. (İsteğe bağlı) Örnek veriler

Boş bir uygulamayla başlayıp kayıt olmanız yeterlidir. Örnek verileri (Ömer/Eşim hesapları)
yüklemek isterseniz kendi bilgisayarınızda:

```bash
DATABASE_URL="postgresql://postgres.xxx:SIFRE@...pooler.supabase.com:6543/postgres" npm run seed
```

> ⚠️ `npm run seed` hedef veritabanındaki **tüm verileri siler**. Gerçek verileriniz
> varken üretim veritabanında çalıştırmayın.

### Sorun giderme

- **API 503 dönüyor / "Veritabanına ulaşılamıyor":** Vercel → proje → *Logs* bölümüne
  bakın. Genellikle `DATABASE_URL` eksik, şifre yanlış ya da şifredeki özel karakterler
  URL-kodlanmamıştır. Ortam değişkenini değiştirdikten sonra yeniden deploy edin
  (*Deployments → … → Redeploy*).
- **"JWT_SECRET ortam değişkeni production ortamında zorunludur":** `JWT_SECRET`
  ekleyip yeniden deploy edin. Bu değeri değiştirmek herkesin oturumunu kapatır.
- Supabase'in ücretsiz projeleri bir hafta kullanılmazsa duraklatılır; Supabase panosundan
  tekrar başlatabilirsiniz.

## Eşinizle eşleşme (davet kodu)

1. Birinci kişi **Kayıt ol** sayfasından davet kodu girmeden hesap açar; kendisi için yeni
   bir "ev" oluşturulur.
2. **Ayarlar** sayfasında **Davet kodu** görünür (Kopyala düğmesiyle kopyalanabilir;
   gerekirse *Yeniden oluştur* ile yenilenir).
3. Eşi **Kayıt ol** sayfasında adını, e-postasını, şifresini, isterse baş harfini ve rengini
   girer, **Davet kodu** alanına bu kodu yazar.
4. Artık ikiniz aynı evdesiniz: *Ortak* görünümde birbirinizin paylaştığı her şeyi
   görürsünüz. Baş harf ve renk sonradan Ayarlar'dan değiştirilebilir.

## Proje yapısı

```
.
├── package.json          # npm workspaces + kök komutlar (dev, build, start, seed, db:migrate, test, e2e)
├── vercel.json           # Vercel yapılandırması (derleme, yönlendirmeler, fonksiyon)
├── .env.example          # ortam değişkenleri örneği
├── api/
│   └── index.js          # Vercel sunucusuz fonksiyonu (Express uygulamasını dışa aktarır)
├── docs/
│   ├── API.md            # mimari ve API sözleşmesi (sunucu ↔ istemci)
│   └── screenshots/
├── server/               # Express 5 + PostgreSQL API
│   ├── sql/schema.sql    # veritabanı şeması (idempotent)
│   ├── src/
│   │   ├── index.js      # sunucu girişi (üretimde client/dist'i de sunar)
│   │   ├── app.js        # Express uygulaması
│   │   ├── db.js         # veritabanı katmanı (Supabase/Postgres veya yerel PGlite)
│   │   ├── migrate.js    # npm run db:migrate
│   │   ├── seed.js       # örnek veriler
│   │   ├── routes/       # auth, household, events, tasks, goals, pages, calendar, dashboard
│   │   ├── services/     # sorgular (görünürlük / kapsam kuralları)
│   │   └── lib/          # tarih & saat dilimi, doğrulama, erişim
│   └── test/             # node:test + supertest testleri
├── client/               # React 18 + Vite + TypeScript + Tailwind
│   └── src/
│       ├── pages/        # Bugün, Takvim, Pano, Hedefler, Planlar, Sayfa, Ayarlar, Giriş/Kayıt
│       ├── components/   # düzenleyici, modallar, rozetler, ortak bileşenler
│       ├── context/      # oturum, görünüm (Benim/Eşim/Ortak), sayfa ağacı
│       ├── api/          # tipli API istemcisi
│       └── lib/          # tarih, bloklar, tema yardımcıları
├── e2e/                  # Playwright uçtan uca testleri
└── playwright.config.ts
```

## Testler

```bash
npm test         # sunucu testleri (node:test, bellek içi PGlite) + istemci tip kontrolü (tsc)
npm run e2e      # Playwright uçtan uca testleri
```

`npm run e2e` kendi izole ortamını başlatır: ayrı bir veritabanını örnek verilerle
oluşturur, API'yi 3101, arayüzü 5180 portunda çalıştırır ve testleri *Europe/Istanbul*
saat diliminde Chromium ile koşar. Geliştirme veritabanınıza (ve `DATABASE_URL`'e) dokunmaz. İlk kez
çalıştırıyorsanız tarayıcıyı kurmanız gerekebilir: `npx playwright install chromium`.

Sunucu testlerini gerçek bir PostgreSQL sunucusuna karşı çalıştırmak için (testler
tabloları boşaltır, boş bir test veritabanı kullanın):

```bash
TEST_DATABASE_URL=postgres://postgres@localhost:5432/ortak_test npm test -w server -- --test-concurrency=1
```

Uçtan uca testlerin kapsadıkları: iki kişinin hafta sonu planları ve Ortak takvimde Ö/E
harfleri, Benim/Eşim görünümleri, özel kayıtların gizliliği, ay/hafta/gün görünümleri,
hedefler, plan sayfası düzenleme ve otomatik kaydetme (Tab girintisi, açılır liste
durumu), panoda sürükle-bırak (eşin taşıması dahil), davet koduyla kayıt, Bugün paneli ve
telefon görünümü.

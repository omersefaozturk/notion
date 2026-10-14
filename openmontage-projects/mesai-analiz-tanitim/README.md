# BDKS Mesai Analizi — arayüz tanıtım videosu

`assets/mesai-analiz.html` uygulamasının kullanımını anlatan 16:9 video. Her kare
uygulamanın **gerçek ekranından** alınır: Chromium'da sayfa açılır, adımlar
Playwright ile uygulanır, ekran görüntüsü ve tıklanan öğelerin kutuları
kaydedilir; kompozisyon da bu kutulara zoom yapar, halka çizer ve imleci
oraya koyar. Mockup yok.

## Çıktı

- `renders/final.mp4` — 1920x1080, 30 fps, ~101 sn, H.264 + AAC
- `docs/arayuz-rehberi.md` — aynı içeriğin yazılı hâli

## Üretim zinciri

| Aşama | Komut | Ne yapar |
|---|---|---|
| Yakalama | `make capture` | Sayfayı sürer, `assets/shots/*.png` + `build/shots.json` üretir |
| Seslendirme | `make narration` | EMA Lightning ile Türkçe anlatım + `build/timeline.json` |
| Müzik | `make music` | Yerel sentezlenmiş ambient yatak, sese göre ducking |
| Render | `make video` | Remotion → `renders/final.mp4` |

```bash
make all
```

Seslendirme ve müzik betikleri `../toolkit/` altında iki proje tarafından
paylaşılır; EMA ağırlıkları `EMA_WEIGHTS_DIR` ile verilir.

## Anlatım akışı

`script/narration.json` içindeki 14 segment, `build/shots.json` içindeki aynı
adlı çekime bağlıdır: açılış → dosya bırakma → örnek veri → genel bakış → büyük
rakam → göz atılması gerekenler → net çalışma/bulunma → bakiye tablosu → kişi
detayı → günlük kayıtlar → kurallar → mola hakkını değiştirme → anında yeniden
hesap → Excel'e aktarma ve gizlilik.

Metni değiştirmek için `script/narration.json`'u düzenleyip `make narration music
video` demek yeterli; segment süreleri yeniden ölçüldüğü için altyazılar ve sahne
geçişleri kendiliğinden hizalanır. Arayüz değişirse `make capture` ile çekimler
tazelenir.

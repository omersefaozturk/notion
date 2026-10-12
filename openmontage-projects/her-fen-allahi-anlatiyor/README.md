# Her Fen Allah'ı Anlatıyor — 9:16 kısa film

Kullanıcının verdiği "Her Fen Allah'ı Anlatıyor" metninin, [OpenMontage](https://github.com/calesthio/OpenMontage)
yaklaşımıyla (araştırma → senaryo → sahne planı → varlıklar → kurgu → kompozisyon)
üretilmiş dikey (1080x1920) kısa video hâli. Seslendirme, müzik, altyazı ve tüm
görseller bu depoda üretilir; dışarıdan stok görsel/ses indirilmez.

## Çıktı

- `renders/final.mp4` — 1080x1920, 30 fps, H.264 + AAC, ~95 saniye
- `build/timeline.json` — segment ve altyazı zamanlamaları (render'ın tek kaynağı)

## Üretim zinciri

| Aşama | Dosya | Ne yapar |
|---|---|---|
| Senaryo | `script/narration.json` | 14 segment: metin + sahne adı + altyazı parçaları |
| Seslendirme | `scripts/build_narration.py` | TTS → `audio/seg_*.wav`, `audio/narration.wav`, `build/timeline.json` |
| Müzik | `scripts/build_music.py` | Yerel sentezlenmiş ambient yatak + sidechain ducking → `audio/mix.wav` |
| Kompozisyon | `composer/src/` | Remotion (React) ile 14 sahne, altyazı katmanı, üst/alt çerçeve |
| Render | `scripts/render.sh` | `renders/final.mp4` + ffprobe doğrulaması |

```bash
make setup     # venv + npm install (bir kez)
make all       # seslendirme -> müzik -> video
```

## Seslendirme sağlayıcısı

Varsayılan ses **espeak-ng** (çevrimdışı, anahtarsız, `espeakng-loader` wheel'i ile
gelir). Anlaşılır ama sentetiktir. Daha doğal bir Türkçe anlatıcı için:

```bash
# Google Cloud TTS (bu ortamdan erişilebilir)
GOOGLE_API_KEY=... .venv/bin/python scripts/build_narration.py --voice google \
  --google-voice tr-TR-Chirp3-HD-Alnilam
.venv/bin/python scripts/build_music.py && bash scripts/render.sh

# ElevenLabs (anahtar + ağ izni gerekir, aşağıya bakın)
ELEVENLABS_API_KEY=... .venv/bin/python scripts/build_narration.py --voice elevenlabs
```

Segment süreleri yeni sesten yeniden hesaplandığı için altyazılar ve sahne
geçişleri kendiliğinden hizalanır; başka bir değişiklik gerekmez.

> **Ağ notu:** Claude Code bulut ortamının ağ politikası `api.elevenlabs.io` ve
> `api.openai.com` adreslerine çıkışı engelliyor; `texttospeech.googleapis.com`
> açık. ElevenLabs kullanmak için ortam ayarlarındaki *Network access →
> Allowed domains* listesine `api.elevenlabs.io` eklenmeli.

## Sahneler

`title → sciences → pharmacy → dosage → apple → body → chemist → fruits → soil →
taste → city → sun → stars → closing`

Her sahne `composer/src/scenes/` altında kendi React bileşenidir; ölçü, denge ve
düzen fikirleri (hassas gramajlar, kan değerleri, toprağın altında fabrika
olmaması, yakıtsız yanan güneş, çarpışmayan yörüngeler) metindeki akışı takip eder.

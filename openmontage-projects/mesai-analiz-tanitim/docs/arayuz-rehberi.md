# BDKS Mesai Analizi — arayüz rehberi

Tek bir HTML dosyası. Çift tıklayıp tarayıcıda açılır, kurulum istemez ve
yüklediğiniz dosyalar bilgisayarınızdan dışarı çıkmaz.

## 1. Veriyi koymak

BDKS'den istediğiniz **tarih aralığını seçip** aylık dökümü Excel olarak indirin
ve açılış ekranındaki kutuya bırakın (ya da tıklayıp seçin). Birden çok ayı ve
birden çok dosyayı aynı anda verebilirsiniz; hepsi tek tabloda toplanır.

Denemek için veri gerekmez: **«Örnek veriyle göz at»** düğmesi hazır iki aylık
örnek veriyle arayüzü açar.

## 2. Üst bar

| Öğe | İşlevi |
|---|---|
| **Net çalışma / Bulunma** | Bütün tabloların ölçütünü değiştirir. *Bulunma* giriş ile çıkış arası (aralar dahil, günlük beklenen 10:00); *net çalışma* aralar düşülmüş hâli (beklenen 8:45). |
| **Dönem seçici** | Tüm dönemler veya tek bir ay. |
| **Dosya ekle** | Yeni bir BDKS dökümü ekler, öncekiler durur. |
| **Kurallar** | Hesaplama ayarları (aşağıda). |
| **Excel'e aktar** | O anki tabloyu indirir. |

## 3. Sekmeler

- **Genel bakış** — Dönemin toplam bakiyesi, ortalama giriş/çıkış saati, masa başı
  oranı; kişi bazında fark çubukları, haftalık seyir ve *«Göz atılması
  gerekenler»* (eksik kayıt, şüpheli giriş, tatil mesaisi).
- **Bakiye tablosu** — Satırlar kişi, sütunlar hafta. Yeşil fazla, kırmızı eksik;
  en sağ sütun dönem toplamı. Hafta / Ay / Dosya kırılımına geçebilirsiniz.
- **Kişi detayı** — Seçilen kişinin haftalık dökümü, tüm dosyalardaki toplamı,
  biriken bakiye grafiği, gün şeridi ve gün gün döküm.
- **Günlük kayıtlar** — Kaynak dosyadaki her satır: giriş, çıkış, bulunma, net
  çalışma, ara süresi ve fark. Durum filtreleriyle izinli / eksik kayıt /
  şüpheli kayıt / tatil mesaisi ayrılır.
- **Nasıl hesaplanıyor** — Kullanılan formüller ve sayma kuralları.

## 4. Kurallar (hesaplama ayarları)

Sağ üstteki **Kurallar**'dan açılır. Değiştirdiğiniz anda bütün sayılar yeniden
hesaplanır ve ayarlar bu tarayıcıda hatırlanır.

| Ayar | Ne yapar |
|---|---|
| Vardiya başlangıcı / bitişi | Referans vardiya saatleri. |
| Günlük beklenen bulunma | Giriş–çıkış arasında geçmesi beklenen süre (varsayılan 10:00). |
| **Günlük mola hakkı (ara süresi)** | Bulunmadan düşülen dakika (varsayılan 75). Beklenen net çalışma = beklenen bulunma − mola hakkı. |
| Geç giriş eşiği | Bu saatten sonraki giriş geç sayılır. |
| Kısmi izinli günler | İzin süresi beklentiden düşülsün / düşülmesin. |
| Hafta tatili çalışması | Bakiyeye eklensin / ayrı gösterilsin. |
| Anlamlı gün eşiği | Bu süreden kısa bulunmalar hatalı kayıt sayılır, bakiyeye katılmaz. |

**Varsayılanlara dön** düğmesi tüm kuralları fabrika ayarına çevirir.

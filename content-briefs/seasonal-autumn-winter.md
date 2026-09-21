# Brief: Mevsimsel boşluk — sonbahar / kış

Hedef URL: **yeni yazı yok.** Mevcut `best-summer-fragrances.html` mevsimsiz hâle getirilecek, sonbahar/kış ayrı bir sayfa olarak ancak birinci elden içerikle açılacak.

> Bu brief bir iskelet. Metni Kerem yazacak; buradaki hiçbir madde "AI ile doldur" değildir.
> AdSense reddi ölçeklenmiş/ince içerik gerekçeliydi. Boş bir sonbahar yazısı açmak o sorunu büyütür; bu yüzden sıra: **önce mevcut sayfayı düzelt, sonra yeni sayfa.**

## Sorun

`best-summer-fragrances.html`, Search Console 19 Haz – 18 Eyl 2026:

| Ölçüm | Değer |
|---|---|
| Gösterim | **5.365** |
| Tık | **0** |
| Sitenin toplam gösterimindeki payı | **%16** |

Sitenin en çok gösterim alan içerik sayfası ve tek bir tık getirmiyor. Sebep CTR değil, pozisyon: site ortalaması 20,8 ve bu yazı jenerik "best summer fragrances" kümesinde 30+ sırada.

Küme (hepsi 0 tık): summer fragrances 1.343 · best summer fragrances 645 · best summer perfumes 443 · summer perfume 274 · summer perfumes 257 · best fragrances summer 181 · summer fragrance 159 · best summer perfume 147 · summer scents 137 · good perfumes for summer 85 · best summer scents 83 · perfumes for the summer 79 · *(kuyruk devam ediyor, küme toplamı ~4.500 gösterim)*

Üstüne mevsim dönüyor: bugün 21 Eylül. Bu 4.500 gösterim Ekim boyunca eriyecek ve yerine gelecek sonbahar/kış talebini karşılayacak hiçbir sayfa yok. Sitede "fall", "autumn", "winter" hedefleyen tek bir sayfa bulunmuyor.

## Faz 1 — mevcut yaz yazısını mevsimsizleştir (önce bu)

1. **Sıcaklık/iklim ekseni ekle** — "yaz" yerine "sıcak hava". Nem oranı yüksek vs kuru sıcak ayrımı; tropik iklimde ne çalışır. Bu, sayfayı Kasım'da da anlamlı kılar ve güney yarımküre trafiğini kapsar.
2. **Neden bu notalar** — sıcakta uçucu notaların davranışı; sitrus neden çabuk gider, akuatik neden dayanır. Şu an liste var, mekanizma yok. Jenerik listeden ayrışmanın tek yolu bu.
3. **Kendi ölçümün** — aynı şişe, sıcak gün vs serin gün, saatlik kalıcılık tablosu. `how-to-make-perfume-last-longer` brief'indeki şablonun aynısı. Bu tablo sitede başka kimsede yok.
4. **İç link** — sonbahar/kış sayfası açılınca karşılıklı link.
5. **Başlık** — "Best Summer Fragrances 2026" yıl bağımlı. Yıl damgası tutmak istiyorsan `npm run content` tarihleri zaten güncelliyor; başlıktaki yılı her sezon elle güncellemeyi unutma, yoksa Ocak'ta "2026" eskimiş görünür.

## Faz 2 — sonbahar/kış sayfası (birinci elden içerik hazır olunca)

Hedef sorgu kümesi (henüz GSC'de yok çünkü sayfa yok — mevsim döndüğünde çıkacak): fall fragrances, autumn perfume, best winter fragrances, cozy fragrances, warm vanilla perfume, spicy fall scents, sweater weather perfume.

Sitede zaten bağlanacak malzeme var: `vanilla-in-perfumery.html` (gurme/vanilya), `what-is-oud.html` (oud/baharat). Sonbahar/kış sayfası bu ikisinin hub'ı olur — yeni ince sayfa değil, mevcut derin sayfaları birleştiren bir giriş.

Açılış koşulu: en az 8-10 şişeyi kendin giymiş ve kalıcılık ölçümü almış olman. Bu yoksa sayfayı açma.

## Zamanlama

| Ne zaman | Ne |
|---|---|
| Şimdi | Faz 1 — yaz yazısını iklim eksenine çevir |
| Ekim başı | Sonbahar şişelerini giymeye ve ölçmeye başla |
| Ekim sonu | Faz 2 sayfası, ölçümler tabloya girmişse |

Kış sorguları Kasım'da tırmanır; Ekim sonunda yayınlanan bir sayfanın indekslenip sıralanmaya başlaması için yeterli zaman kalır.

## Bitirince

`npm run content` → `npm run audit` → commit.

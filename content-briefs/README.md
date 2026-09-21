# Content briefs

**Durum (14 Eyl 2026):** altı yazı ve müzik rehberi, nota tabanlı karşılaştırma tabloları, "hangi versiyonu kopyalıyorsun" bölümleri, test/numune tavsiyesi, sahte-klon ayrımı ve SSS (FAQPage schema) ile derinleştirildi. Her yazının başında bunun bir *nota tabanlı kısa liste* olduğu, giyim testi olmadığı açıkça yazıyor. Aşağıdaki brief'lerde hâlâ açık olan tek katman, yalnızca senin sağlayabileceğin şeyler: kendi kalıcılık ölçümlerin, kendi fotoğrafların, tarihli fiyatlar ve owned/sampled/not tested etiketleri. Bunlar eklendikçe yazıdaki "not a wear test" cümlesi kaldırılır.

Faz 2 iş listesi. Her dosya bir yazı için iskelet: hangi bölümler eklenecek, hangi özgün katman gerekli (kendi fotoğrafın, kendi kalıcılık testin, tarihli fiyat tablosu, karşılaştırma). Metni Kerem yazar; brief'ler metin değildir.

Öncelik sırası (trafik potansiyeli × mevcut incelik):

| # | Yazı | Şu an | Neden önce |
|---|---|---|---|
| 1 | [baccarat-rouge-540-dupes](baccarat-rouge-540-dupes.md) | 638 kelime | En yüksek hacimli dupe konusu |
| 2 | [dior-sauvage-dupes](dior-sauvage-dupes.md) | 1.031 kelime | İkinci en büyük; sadece birinci elden katman eksik |
| 3 | [le-labo-santal-33-dupes](le-labo-santal-33-dupes.md) | 207 kelime | En ince yazı, en kolay kazanç |
| 4 | [creed-aventus-dupes](creed-aventus-dupes.md) | 491 kelime | Sauvage yazısıyla örtüşüyor, ayrışması gerek |
| 5 | [best-perfumes-under-50](best-perfumes-under-50.md) | 394 kelime | Bütçe aramaları; tarihli fiyat şart |
| 6 | [how-to-make-perfume-last-longer](how-to-make-perfume-last-longer.md) | 845 kelime | Evergreen; kontrollü deneyle sitenin en güvenilir sayfası olabilir |

Bir yazıyı bitirince: `npm run content` (okuma süresi, tarih, disclosure otomatik güncellenir) → `npm run audit` → commit.

Kalan beş ince yazı (ysl-libre-dupes, best-date-night, vanilla-in-perfumery, what-is-oud, best-summer) da aynı yöntemle derinleştirildi; artık 400 kelimenin altında yazı yok. Bunlar için ayrı brief yazılmadı; birinci elden katman (kalıcılık, fotoğraf, tarihli fiyat) aynı şablonla eklenebilir.

---

## Faz 3 öncelikleri — Search Console verisiyle (21 Eyl 2026)

İlk öncelik sırası kelime sayısına göreydi. Artık üç aylık gerçek arama verisi var (19 Haz – 18 Eyl 2026), sıra ona göre yeniden kuruldu: **gösterim × mevcut incelik**, yani talebin zaten geldiği ama sayfanın karşılayamadığı yerler.

| # | Yazı | Gösterim | Tık | Kelime | Neden bu sırada |
|---|---|---|---|---|---|
| 1 | [fragrance-layering-guide](fragrance-layering-guide.md) | 1.476 | 2 | 455 | En yüksek gösterim/incelik oranı. Küme mevsimsiz, kalıcı talep. |
| 2 | [best-niche-fragrances](best-niche-fragrances.md) | 1.019 | 14 | 575 | Zaten tık alıyor — sayfa derinleşince en hızlı karşılık verecek olan. |
| 3 | [best-office-fragrances](best-office-fragrances.md) | 740 | 2 | 534 | Yıl boyu sabit talep; yaz yazısının aksine Ekim'de düşmez. |
| 4 | [seasonal-autumn-winter](seasonal-autumn-winter.md) | 5.365 (yaz) | 0 | 1.265 | Yaz sayfası sitenin %16 gösterimini alıp sıfır tık getiriyor ve mevsim dönüyor. |
| 5 | [celebrity-fragrances-guide](celebrity-fragrances-guide.md) | — | — | 684 | Arama hacmi için değil: indekste değil ve ürüne giden en doğal köprü. |

Sırayı bozmaya değer tek durum: elinde hangi şişelerin ölçümü varsa o yazı öne geçer. Brief'lerin hepsi birinci elden katman istiyor; ölçümü olmayan yazıyı derinleştirmeye çalışmak yine ince içerik üretir.

### Tıkı olmayan gösterim havuzu

Aşağıdaki sayfalar üç ayda toplam ~12.000 gösterim alıp 20'den az tık getirdi. Hepsinin ortak sebebi pozisyon (site ortalaması 20,8 — 2-3. sayfa), CTR değil. Başlık/meta oynamak buraya çare değil; derinlik ve iç link gerekiyor.

| Sayfa | Gösterim | Tık |
|---|---|---|
| best-summer-fragrances | 5.365 | 0 |
| fragrance-layering-guide | 1.476 | 2 |
| creed-aventus-dupes | 1.057 | 3 |
| best-niche-fragrances | 1.019 | 14 |
| best-perfumes-under-50 | 930 | 4 |
| baccarat-rouge-540-dupes | 851 | 2 |
| best-womens-fragrances | 767 | 2 |
| best-office-fragrances | 740 | 2 |
| dior-sauvage-dupes | 675 | 4 |
| ysl-libre-dupes | 469 | 1 |

Buna karşılık çalışan taraf: ana sayfa 1.022 tık (çoğu marka araması) ve eski burç sayfaları 242 tık / 8.235 gösterim. Burç sayfaları 14 Eyl'de `zodiac-fragrance-guide.html`'e 301'lendi; o rehber indekslenene kadar bu 242 tık risk altında.

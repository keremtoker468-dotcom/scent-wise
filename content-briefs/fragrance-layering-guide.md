# Brief: Fragrance Layering Guide

URL: https://scent-wise.com/blog/fragrance-layering-guide.html · Şu anki uzunluk: 455 kelime

> Bu brief bir iskelet. Metni Kerem yazacak; buradaki hiçbir madde "AI ile doldur" değildir.
> Kural: her bölümde en az bir şey **senin** olmalı (kendi kombinin, kendi fotoğrafın, kendi "bu ikisi birbirini öldürdü" cümlen). Elinde olmayanı yazma, bölümü boş bırak.

## Neden bu yazı birinci öncelik

Search Console, 19 Haz – 18 Eyl 2026 (3 ay):

| Ölçüm | Değer |
|---|---|
| Sayfa gösterimi | **1.476** |
| Sayfa tıklaması | **2** |
| CTR | %0,14 |

Sitenin ikinci en yüksek gösterim alan yazısı ve aynı zamanda 455 kelimeyle en ince ikinci yazısı. Talep zaten orada, sayfa onu karşılayacak derinlikte değil — bu kombinasyon sitedeki en net "derinleştir" vakası.

Aynı dönemde bu kümeden gelen sorgular (hepsi 0 tık):

| Sorgu | Gösterim |
|---|---|
| fragrance layering | 306 |
| perfume layering combinations | 241 |
| scent pairing | 95 |
| best perfume layering combinations | 37 |
| fragrance combining | 42 |
| layering colognes | 27 |
| perfume combinations | 27 |
| how to layer fragrances | 21 |
| layering fragrances | 18 |
| fragrance pairing | 16 |
| fragrance pairing tips | 14 |
| layering scents | 14 |
| perfume layering guide | 13 |
| fragrance layering chart | 11 |
| how to pair perfumes | 10 |
| scent layering | 10 |

Küme toplamı ~900 gösterim, sıfır tık. Ortalama pozisyon site genelinde 20,8 — yani 2-3. sayfa. Bu sayfa için hedef ilk sayfaya girmek, CTR'ı zorlamak değil.

## Mevcut iskelet

What Is Fragrance Layering? → The Golden Rules (4 madde) → 7 Proven Layering Combinations → What NOT to Layer → CTA.

7 kombinasyonun her biri tek cümle. "Viral TikTok combo" gibi ifadeler var, kaynak yok. Tablo yok, SSS yok, FAQPage schema yok.

## Eklenecek bölümler

1. **Nota ailesi eşleşme tablosu** — "fragrance layering chart" ve "scent pairing" sorguları tam olarak bunu arıyor; sitede zaten 65.000 parfümün nota verisi var. Satırlar: oryantal, gurme, taze/aromatik, odunsu, çiçeksi, fujer, deri, akuatik. Her hücre: **çalışır / dikkatli / çalışmaz** + tek cümle gerekçe. Bu tablo yazının omurgası ve tek başına alıntılanabilir bir varlık.
2. **Kombinasyon başına gerçek bölüm** — mevcut 7 kombinasyonun her biri tek cümleden bir paragrafa çıkmalı: hangi nota hangisini bastırıyor, hangi sırayla sıkılıyor, kaç fıs, ne kadar dayandı. Denemediğin kombini listede tutacaksan `not tested` etiketle.
3. **Sıra ve oran** — "önce ağır olan" kuralı var ama oran yok. 2+1, 1+1, 3+1 farkı; aynı bölgeye mi ayrı bölgeye mi; bekleme süresi var mı. Kendi denemende ne fark yarattı.
4. **Çalışmayanlar** — "What NOT to Layer" şu an iki cümle. Kendi başarısız denemelerinden 3-5 tanesi, neden çöktüğü ile. Bu bölüm yazıyı diğer bütün layering yazılarından ayırır; kimse başarısızlığını yazmıyor.
5. **Tek şişeyle layering** — aynı evin farklı konsantrasyonları (EDT + EDP + parfum), body lotion/saç spreyi katmanı. "layering colognes" sorgusu erkek tarafından geliyor, oraya ayrı bir alt başlık.
6. **Başlangıç seti** — "hangi 3-4 şişeyle en çok kombinasyon çıkar" sorusu. Bütçe aralığı ver, tarihli fiyat yaz.
7. **SSS + FAQPage schema** — diğer derinleştirilmiş yazılardaki şablonun aynısı. Sorular doğrudan GSC'den: "How do you layer fragrances?", "What scents should not be layered together?", "Should you layer the heavier or lighter fragrance first?", "Can you layer two perfumes from the same brand?", "How many sprays of each when layering?"

## Kombinasyon test şablonu (her kombin için)

| Kombin | Sıra + fıs | Bölge | 1. saat | 4. saat | 8. saat | Sonuç | Not |
|---|---|---|---|---|---|---|---|

- Aynı gün tek kombin test et; iki kombini aynı anda taşırsan ölçüm anlamsız.
- "Amazing" yerine ne olduğunu yaz: hangi nota öne çıktı, hangisi kayboldu.

## Fotoğraf listesi (kendi çektiğin, stok değil)

- Kapak: kombinde kullanılan şişeler ikili gruplar hâlinde, doğal ışık.
- Nota ailesi tablosu için basit bir görsel şema (SVG olabilir, stok görsel olmasın).
- Dosyalar `public/blog/img/` altına; alt metinleri elle yaz.

## Silinecek / düzeltilecek

- "The viral TikTok combo" → ya kaynak/ekran görüntüsü ya da "benim denediğim" ile değiştir.
- Başlıktaki "Like a Pro" ifadesi jenerik; başlığa "chart" veya "combinations" sokmak sorgu eşleşmesini artırır. Öneri: **Fragrance Layering Guide 2026 — Combination Chart, Rules and What Not to Mix**. Değiştirirsen canonical'a dokunma, sadece `<title>`, `<h1>` ve meta description.
- Meta description şu an kombinasyon sayısı vermiyor; "chart" ve "combinations" kelimeleri geçsin.

## Şeffaflık satırları

- Yazının başına: bunun nota temelli bir kılavuz olduğunu ve hangi kombinasyonların bizzat denendiğini söyleyen cümle.
- Denenmemiş kombinasyonlar `not tested` etiketiyle kalsın, listeden çıkarılmasın.

## Bitirince

`npm run content` → `npm run audit` (0 duplicate, 0 eksik disclosure, 0 kırık link) → commit.

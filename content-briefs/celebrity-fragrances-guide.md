# Brief: Celebrity Fragrances Guide

URL: https://scent-wise.com/blog/celebrity-fragrances-guide.html · Şu anki uzunluk: 684 kelime

> Bu brief bir iskelet. Metni Kerem yazacak; buradaki hiçbir madde "AI ile doldur" değildir.

## Neden bu yazı

İki ayrı sorunu var:

1. **İndekste değil.** Search Console → Sayfa indeksleme → "Discovered – currently not indexed" listesinde. Sitemap'te olmasına rağmen Google indekslememiş. Sebep büyük olasılıkla incelik (684 kelime) + zayıf iç link. İç link tarafı 21 Eyl düzeltmesiyle kapatıldı (ana sayfa Guides ızgarasına ve her blog footer'ına eklendi); geriye içerik derinliği kalıyor.
2. **Ürünle en güçlü bağı olan yazı ama sayfada affiliate ve disclosure yok.** Site 101 ünlü profili tutuyor (`/?mode=celeb`), yazı ise bunun sadece vitrin metni.

Küme sorguları küçük ama niyet net: "rapper cologne" (9), "leo moon fragrances" (8) gibi. Asıl değeri arama hacmi değil, **ürüne giden en doğal köprü** olması.

## Eklenecek bölümler

1. **Kaynak disiplini** — bu yazının en kritik noktası. Her ünlü-parfüm eşleşmesi için kaynak: röportaj, kendi sosyal medya paylaşımı, marka elçiliği sözleşmesi. Kaynağı olmayan eşleşme `reported / unconfirmed` etiketiyle kalsın. Ünlülerle ilgili kaynaksız iddia hem E-E-A-T hem hukuki risk.
2. **Kategori bazlı bölümler** — müzisyen / oyuncu / sporcu / iş insanı. "rapper cologne" gibi sorgular kategori seviyesinde geliyor.
3. **"Bu ünlüyü seviyorsan bunu dene"** — ünlünün şişesi pahalı/bulunamazsa nota profili benzer alternatif. Sitenin dupe motoruyla (`/?mode=dupe`) doğal bağ.
4. **101 profilin tamamına giriş** — yazı şu an bir avuç isim veriyor, ürün 101 tane tutuyor. `/?mode=celeb` ve `/collections.html` bağlantısı belirgin olsun.
5. **Marka elçisi ≠ gerçekten kullanıyor** — sektörde kimsenin yazmadığı ayrım. Reklam yüzü olmakla o parfümü giymek aynı şey değil; birkaç somut örnek.
6. **SSS + FAQPage schema** — "What perfume does [kategori] wear?", "Are celebrity fragrance endorsements real?", "What is the most worn celebrity fragrance?", "How do we know what a celebrity actually wears?"
7. **Affiliate + disclosure** — yazıya fragrance kartları eklenince `npm run content` disclosure'ı otomatik enjekte eder.

## Eşleşme tablosu şablonu

| Ünlü | Kategori | Parfüm | Kaynak (link + tarih) | Durum (confirmed / reported / ambassador) |
|---|---|---|---|---|

## Silinecek / düzeltilecek

- Kaynaksız her eşleşme ya kaynaklanır ya `reported` etiketlenir ya çıkarılır.
- Yazı derinleşip indekslendikten sonra Search Console'dan URL denetleme → indeksleme talebi.

## Bitirince

`npm run content` → `npm run audit` → commit → GSC'den indeksleme talebi.

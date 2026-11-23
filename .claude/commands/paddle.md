---
description: Lemon Squeezy → Paddle ödeme geçişine kaldığı yerden devam et
---
Lemon Squeezy → Paddle ödeme geçişi üzerinde çalışıyoruz. Kullanıcıyla Türkçe konuş.

1. `PAYMENT-MIGRATION-PLAN.md` dosyasını baştan sona oku. Özellikle "0. Durum ve kararlar" bölümünü oku. Oradaki kararlar alındı, yeniden tartışma.
2. "Durum" tablosundaki ilk tamamlanmamış fazı bul. Faz 0 kullanıcının hesap işleri; onun bitmesini bekleme, Faz 1 Paddle hesabı olmadan yapılabilir.
3. Kullanıcıya tek cümlede hangi fazdan devam ettiğini söyle ve başla. Kodda `CLAUDE.md` kurallarına uy (CommonJS, yeni `api/*.js` dosyası yok, timing-safe karşılaştırma, `?v=` artır).
4. Bir faz ya da madde bitince plandaki kutuyu `[x]` yap, "Durum" tablosunu ve "Değişiklik günlüğü"nü güncelle, commit at.
5. Kullanıcıdan bir bilgi gerekiyorsa (Paddle price ID, API anahtarı, onay durumu) sor. Anahtarları asla dosyaya ya da commit'e yazma, sadece Vercel env değişkeni olarak iste.

Kullanıcının ek notu (varsa): $ARGUMENTS

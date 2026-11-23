# Ödeme Altyapısı Geçiş Planı: Lemon Squeezy → Paddle

_Hazırlanma: 23 Kasım 2026 · Son tarih: 31 Mart 2027 (Lemon Squeezy ödeme almayı bırakıyor, uzatma yok)_

## 0. Durum ve kararlar

> Yeni bir oturumda kaldığın yerden devam etmek için `/paddle` yaz (ya da "paddle geçişine devam et" de).

**Durum**

| Faz | Durum | Not |
|---|---|---|
| 0. Hesap ve uygunluk | ⏳ Kullanıcıda | Paddle (ve yedek olarak Polar) kaydı, mali müşavir |
| 1. Sipariş kaydı + LS yedeği | ⬜ Başlanmadı | **Sıradaki iş.** Paddle hesabı olmadan yapılabilir |
| 2. Paddle entegrasyonu (sandbox) | ⬜ | Paddle sandbox anahtarları ve `pri_…` ID'si gerekiyor |
| 3. Yasal metinler | ⬜ | Paddle sözleşmesindeki unvan gerekiyor |
| 4. Canlıya geçiş | ⬜ | Hedef: 15–31 Ocak 2027 |
| 5. LS temizliği | ⬜ | 1–15 Nisan 2027 |

**Alınmış kararlar (yeniden tartışılmaz)**
1. Sağlayıcı **Paddle** (Paddle Billing, tek seferlik 10 USD fiyat). Paddle 10 gün içinde onaylamazsa → **Polar**.
2. Stripe Managed Payments **yok**: Türkiye desteklenmiyor. Yurt dışında şirket kurulmayacak.
3. Whop / WhopDFY (`sparkintro.info`) teklifi reddedildi. Kimseyle ürün listesi ya da API anahtarı paylaşılmayacak.
4. Yerli sağlayıcı (iyzico/PayTR) **yok**: vergi ve fatura yükü bize düşer.
5. **Sağlayıcıdan bağımsız sipariş kaydı** Redis'te (`sw_order:*`). Premium doğrulaması bu kayıttan yapılır, sağlayıcı API'sinden değil.
6. Yeni `api/*.js` dosyası **eklenmez** (Hobby planı 12/12). Sağlayıcı seçimi `PAYMENT_PROVIDER` env değişkeniyle, mevcut function'larda dallanarak.
7. LS webhook'u **31 Mart 2027'ye kadar** açık kalır (geç gelen iadeler için). LS'de yeni satış 31 Ocak'ta kapanır.
8. `purchase` olayı yine **sadece sunucudan** (webhook) gider. Google Ads dönüşüm aksiyonu değişmez.
9. LS sipariş yedeği (CSV) kişisel veri içerir, **repoya commit edilmez**.
10. `sw_sub` cookie'sinin 365 günlük ömrü sorunu Faz 1'de çözülür.

**Değişiklik günlüğü**
- 2026-11-23: Plan yazıldı, kararlar alındı. Sıradaki: kullanıcı Paddle'a kaydolur, kod tarafında Faz 1 başlar.

## 1. Özet

| | |
|---|---|
| **Öneri** | **Paddle** (Paddle Billing, tek seferlik fiyat). Yedek: **Polar**. |
| **Neden** | Gerçek "merchant of record": dünya genelinde KDV/VAT/sales tax'ı Paddle hesaplar, tahsil eder ve öder; faturayı alıcıya Paddle keser. Türkiye'den yazılım satıcısı kabul ettiği ve Türkiye'ye ödeme yaptığı bildiriliyor. En köklü MoR, iade ve chargeback'leri kendisi yürütür. |
| **Maliyet (10$ satış)** | ~1,00$ (5% + 0,50$). Bugünkü Lemon Squeezy kesintisiyle aynı. Ödeme (payout) başına SWIFT ~15$ → ayda bir ödeme alın. |
| **Kod işi** | ~3–5 gün. Yeni serverless function **eklenmez** (Hobby planı 12/12). |
| **Hedef tarih** | Paddle canlıda: **15 Ocak 2027**. Lemon Squeezy checkout kapalı: **31 Ocak 2027**. |
| **Senin için kritik risk** | Mevcut müşterilerin girişi Lemon Squeezy API'sine bağlı ve Premium cookie'si **365 gün** sonra bitiyor. Siparişler kapanıştan önce dışa aktarılmazsa ilk alıcılar 2027'de Premium'a geri giremez. → Faz 1. |

**Stripe Managed Payments neden olmuyor:** Lemon Squeezy'nin resmi geçiş yolu bu, ama satıcının Stripe'ın desteklediği bir ülkede kurulu olması gerekiyor ve **Türkiye listede yok**. Tek çıkış yolu yurt dışında şirket (ör. Stripe Atlas ile ABD LLC) kurmak; bu 10$'lık ürün için orantısız bir vergi ve muhasebe yükü.

## 2. Karşılaştırma

Ücretler 10$'lık tek seferlik satış içindir. Kaynaklar: sağlayıcı dokümanlarının arama özetleri ve üçüncü taraf karşılaştırmalar. Sağlayıcı sitelerine bu oturumdan doğrudan erişilemedi, bu yüzden "Türkiye" sütunu **kayıt sırasında teyit edilmeli** (Faz 0).

| | **Paddle** | **Polar** | Creem | Dodo Payments | Whop |
|---|---|---|---|---|---|
| Vergiyi tamamen üstleniyor mu (MoR) | ✅ Evet, 200+ ülke | ✅ Evet | ✅ Evet (beyan) | ✅ Evet (beyan) | ⚠️ Belirsiz. Bazı kaynaklara göre satıcı "supplier" sayılıyor ve vergi sorumluluğu sende kalabiliyor. |
| Türkiye'den satıcı | ✅ Muhtemel: yalnızca yaptırımlı ülkeleri dışlıyor, Türkiye'ye özel MoR sayfası olduğu bildiriliyor | ✅ Muhtemel: Stripe Connect Express ile ödeme listesinde Türkiye görünüyor | ❓ Bulunamadı | ❓ Bulunamadı | ❓ Bulunamadı |
| İşlem ücreti | 5% + 0,50$ → **~1,00$** | 5% + 0,50$ (Mayıs 2026'dan beri) + uluslararası kart ek ücreti → **~1,00–1,15$** | 3,9% + 0,40$ → ~0,79$ | 4% + 0,40$ + uluslararası %1,5 → ~0,95$ | Kart ~2,7% + 0,30$, vergi hizmeti için +%2 |
| Türkiye'ye ödeme | SWIFT, ~15$/ödeme | Stripe Connect, TR bankasına | 7$ veya %1 (hangisi büyükse), elle talep | 25$'a kadar SWIFT | Ülkeye göre değişiyor |
| Olgunluk / risk | En köklü. Nadir hesap incelemeleri ve 90 gün bloke vakaları bildirilmiş | Genç ama geliştirici dostu, hızlı onay | Genç | Genç | Topluluk/kurs odaklı, SaaS'a daha az uygun |
| Bu proje için | **1. tercih** | **Yedek** | Türkiye teyidi yok | Türkiye teyidi yok | Vergi belirsiz → elendi |

**Karar kuralı:**
1. Paddle hesabı onaylanır ve Türkiye bankasına ödeme açılırsa → **Paddle**.
2. Paddle 10 gün içinde onaylamazsa veya reddederse → **Polar** (kod yapısı aynı kalır, sadece adaptör değişir).

> **Vergi notu:** MoR, **alıcının** ülkesindeki KDV/VAT'yi halleder. **Senin Türkiye'deki gelir vergin** (Paddle'dan gelen ödemeler) yine senin sorumluluğunda. Paddle sana satış yapmış olur, sen de Paddle'a (yurt dışına) hizmet ihracatı faturası kesersin. Hizmet ihracatı KDV istisnası ve olası gelir vergisi indirimleri için bir **mali müşavire** danış. Bu plan vergi danışmanlığı değildir.

## 3. Mimari karar: sağlayıcıdan bağımsız sipariş kaydı

Bugün Premium doğrulaması her seferinde Lemon Squeezy API'sine soruyor (`verify-subscription.js`, `check-tier.js`). Bunun yerine **kendi sipariş kaydımızı** Redis'te tutacağız. Sağlayıcılar (LS, Paddle) sadece bu kaydı besleyecek:

```
sw_order:{provider}:{orderRef}   → { email, custId, status: paid|refunded, provider, createdAt }
sw_orders_by_email:{sha256(email)} → set of orderRef
```

- Webhook (`order_created` / `transaction.completed`) kaydı yazar, iade (`order_refunded` / `adjustment` refund approved) `status: refunded` yapar ve mevcut `revokeOrder()`'ı çağırır.
- `verify-subscription.js` önce Redis'e bakar. Böylece **Lemon Squeezy kapandıktan sonra da** eski alıcılar e-posta ve sipariş numarasıyla girebilir.
- Bir sonraki sağlayıcı değişikliği (gerekirse) sadece bir adaptör yazmak olur.

## 4. Fazlar

### Faz 0: Hesap ve uygunluk (24 Kasım → 6 Aralık)
- [ ] Paddle hesabı aç (vendors.paddle.com) → işletme bilgileri (şahıs/şirket, VKN), kimlik doğrulama.
- [ ] **Domain onayı:** Paddle, `scent-wise.com` sitesini inceler. Fiyat, şartlar, iade ve gizlilik sayfaları erişilebilir olmalı (var). AI ürünü olduğunu açıkça yaz.
- [ ] Ödeme yöntemi: Türkiye bankası (USD hesap önerilir), eşik ve aylık ödeme ayarla (SWIFT ücretini azaltmak için).
- [ ] Ürün: "ScentWise Premium (Lifetime)", tek seferlik fiyat **10 USD** → `pri_...` ID'sini not al.
- [ ] Checkout ayarı: varsayılan ödeme linki `https://scent-wise.com/`. Bu, API ile checkout URL'si üretmek için gerekli.
- [ ] Sandbox hesabı aç (sandbox-vendors.paddle.com). Testler orada yapılır.
- [ ] **Paralelde Polar hesabı da aç.** Paddle reddederse süre kaybetmemek için.
- [ ] Mali müşavirle görüş: hizmet ihracatı faturası ve gelir vergisi.

### Faz 1: Sipariş kaydı ve LS siparişlerinin yedeği (1 → 15 Aralık), **acil**
- [ ] `api/_lib/orders.js`: `recordOrder`, `markRefunded`, `findOrder(email, orderRef)` (Redis). `_lib/` altında olduğu için function sayılmaz.
- [ ] `api/webhook.js` (LS): `order_created` ve `order_refunded` → `recordOrder` / `markRefunded`.
- [ ] **Backfill betiği** `scripts/export-ls-orders.js`: LS API `GET /v1/orders` (sayfalı) → her ödenmiş/iade edilmiş siparişi Redis'e yaz. Ayrıca yerel bir CSV yedeği al. **Bu CSV kişisel veri içerir, repoya commit edilmez.**
- [ ] `api/verify-subscription.js`: önce `findOrder()`. Yoksa (geçiş döneminde) LS API'ye düş.
- [ ] `sw_sub` cookie'si 365 gün sonra bitiyor. Ömür boyu ürün için ya süreyi uzat ya da `check-tier.js` her doğrulamada cookie'yi tazelesin.
- [ ] Testleri yaz, deploy et, backfill'i production Redis'e bir kez çalıştır ve sayıları LS panosuyla karşılaştır.

### Faz 2: Paddle entegrasyonu (sandbox) (15 Aralık → 10 Ocak)
Yeni dosya yok. Mevcut function'lar sağlayıcıya göre dallanır, `PAYMENT_PROVIDER=paddle|lemonsqueezy` env değişkeniyle seçilir.

- [ ] **`api/create-checkout.js`**: Paddle'da `POST https://api.paddle.com/transactions` gövdesi `{ items:[{price_id, quantity:1}], custom_data:{device_id, ga_client_id, ga_session_id, gclid, ga_consent, ttclid?...} }` → `data.checkout.url` döner. Mevcut doğrulama ve onay kuralları aynen kalır (TikTok verisi sadece reklam izniyle).
- [ ] **`api/webhook.js`**: `Paddle-Signature: ts=…;h1=…` başlığı varsa Paddle yolu: `HMAC-SHA256(secret, ts + ":" + rawBody)` timing-safe karşılaştırma, ayrıca `ts` için 5 dakikalık tazelik kontrolü. LS yolu (`X-Signature`) 31 Mart'a kadar paralel çalışır.
  - `transaction.completed` → fiyat ID kontrolü (`PADDLE_PRICE_ID`) → `recordOrder` + `bindDeviceToOrder` + GA4 `purchase` + TikTok (sadece `ga_consent: granted` ise). Tutar `details.totals` alanından, vergi hariç gelir.
  - `adjustment.created/updated` (`action: refund`, `status: approved`) → `markRefunded` + `revokeOrder` + GA4 `refund`.
  - Idempotency: `claimOnce('sw_ga4sent:'+txnId)` mevcut mantıkla.
  - Alıcı e-postası transaction içinde değil, `GET /customers/{customer_id}` ile alınır.
- [ ] **`api/verify-subscription.js`**: Paddle sipariş numarası (`txn_…` veya fatura no) → `findOrder()`. Hata mesajındaki "numeric order number" örneğini güncelle.
- [ ] **`api/check-tier.js`**: LS revalidation bloğunu kaldır ve yerine Redis'teki `status` ile iptal kontrolü koy. LS API kapandıktan sonra her gün başarısız istek atmasın.
- [ ] **`public/app.js`**: `checkout()` içindeki `lemonsqueezy.com` URL doğrulamasını `paddle.com` (ve geçişte her ikisi) olarak genişlet. Dönüşte `?_ptxn=` / sipariş parametresi işlenir. `?v=` sürümünü artır.
- [ ] **`vercel.json` CSP**: `script-src`/`frame-src`/`form-action`/`connect-src` içine `https://*.paddle.com` ve `https://cdn.paddle.com` ekle. LS girdileri 31 Mart'tan sonra silinir.
- [ ] `public/index.html`: dns-prefetch girdilerini güncelle.
- [ ] `api/_lib/validate-secrets.js`: yeni env değişkenleri.
- [ ] Sandbox uçtan uca test: satın al → webhook → cihaz otomatik açılıyor mu → GA4 DebugView'da `purchase` görünüyor mu → iade → erişim kapanıyor mu → yeni cihazda e-posta ve sipariş no ile giriş.

**Yeni env değişkenleri:** `PAYMENT_PROVIDER`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_PRICE_ID`, `PADDLE_ENV` (`sandbox`|`production`).

### Faz 3: Yasal metinler (Faz 2 ile paralel)
Paddle'ın unvanı "Paddle.com Market Ltd" (İngiltere). Kayıt sırasında sözleşmedeki unvanı teyit et.
- [ ] `terms.html`: satıcı/MoR bölümü ve alıcı şartları linki.
- [ ] `privacy.html`: işleyici listesi, yurt dışına aktarım (İngiltere/AB).
- [ ] `kvkk.html`: aktarılan taraf, ülke, amaç (sipariş bildirimleri).
- [ ] `refund.html`: iadeyi Paddle yürütür, süre ve süreç.
- [ ] `contact.html`: MoR satırı.
- [ ] `openCheckoutSheet` (ön bilgilendirme ve cayma hakkı feragati) metni: satıcı adı güncellenir. **Akış korunur, atlanmaz.**
- [ ] `CLAUDE.md` + `README.md`: env tablosu, mimari notlar, webhook kurulumu.

### Faz 4: Canlıya geçiş (10 → 31 Ocak)
- [ ] Production Paddle anahtarlarını Vercel'e gir → `PAYMENT_PROVIDER=paddle` → deploy.
- [ ] Paddle webhook uç noktası: `https://scent-wise.com/api/webhook`, olaylar `transaction.completed`, `adjustment.created`, `adjustment.updated`.
- [ ] Kendi kartınla **gerçek 10$ satın alma** → GA4 Realtime'da `purchase` → Paddle'dan iade → erişim kapanıyor mu kontrol et.
- [ ] `GET /api/owner-auth?ga4ping=1` ile GA4 bağlantısını doğrula.
- [ ] Google Ads: dönüşüm aksiyonu değişmez (yine GA4 `purchase`). Geçiş haftasında dönüşüm sayılarını izle.
- [ ] Lemon Squeezy'de ürünü "draft" yap (yeni satış yok). **Webhook'u 31 Mart'a kadar açık bırak**, geç gelen iadeler için.

### Faz 5: Lemon Squeezy temizliği (1 → 15 Nisan)
- [ ] Son backfill'i çalıştır ve son ödemenin alındığını panodan doğrula.
- [ ] LS kod yollarını, env değişkenlerini ve CSP girdilerini sil. `?v=` sürümlerini artır.
- [ ] LS faturalarını ve ödeme raporlarını muhasebe için indir (10 yıl sakla, VUK).

## 5. Kontrol listesi: canlıya çıkmadan önce
- [ ] Eski bir LS alıcısı, yeni bir tarayıcıda e-posta ve sipariş no ile Premium'a girebiliyor.
- [ ] Yeni Paddle alıcısının cihazı otomatik açılıyor (cihaz bağlama).
- [ ] İade → 24 saat içinde Premium kapanıyor.
- [ ] GA4 `purchase` tek sefer gidiyor (webhook tekrarı çift saymıyor).
- [ ] İzin vermemiş alıcı için TikTok olayı gitmiyor ve GA4'te `non_personalized_ads` işaretli.
- [ ] `npm run audit` temiz, CSP raporlarında (`/api/csp-report`) Paddle ihlali yok.

## 6. Açık sorular (kayıt sırasında netleşecek)
1. Paddle, şahıs (şirketsiz) Türk satıcıyı kabul ediyor mu, yoksa şahıs şirketi mi gerekiyor?
2. Türkiye'ye ödeme USD mi, EUR mu? SWIFT ücreti ve minimum eşik ne?
3. AI ürünü için Paddle'ın ek bir inceleme şartı var mı?
4. Polar'ın güncel ücreti (4%+0,40$ mı, 5%+0,50$ mı) ve Türkiye'ye ödeme süresi.

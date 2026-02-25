# 43Zekat - Kurulum ve Çalıştırma Rehberi

Bu uygulama İslami kurallara uygun Zakat hesaplama ve varlık yönetimi için geliştirilmiştir.

## Teknolojiler
- **Next.js 15 (App Router)**
- **React 19**
- **TailwindCSS & Shadcn UI** (Premium Tasarım)
- **Firebase** (Auth & Firestore)
- **Zustand** (State Management)
- **PWA** (Çevrimdışı destek ve Mobil Uygulama olarak kurulum)

## Kurulum Adımları

1.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```

2.  **Firebase Yapılandırması:**
    `.env.local` dosyasını kontrol edin. Eğer yoksa `.env.example` dosyasını `.env.local` olarak kopyalayın ve Firebase anahtarlarınızı girin. (Hazır anahtarlar dosya içine eklenmiştir.)

3.  **Uygulamayı Başlatın:**
    Uygulama otomatik olarak **4300** portunda çalışacak şekilde ayarlanmıştır. Masaüstüne kısayol eklemek ve uygulamayı başlatmak için PowerShell üzerinde `start-app.ps1` dosyasını çalıştırın veya:
    ```bash
    npm run dev -- -p 4300
    ```

## Özellikler
- **TL Varlıkları:** 1 kameri yıl (354 gün) takibi.
- **Döviz:** Canlı kur çekimi ve TRY dönüşümü.
- **Madenler:** Canlı altın/gümüş fiyatları ile hesaplama.
- **Özet:** Nisab kontrolü ve %2.5 zekat hesaplaması.
- **Güvenlik:** Sadece kendi verilerinize erişim.

## PWA Kullanımı
Uygulama tarayıcıda açıldığında adres çubuğundaki "Yükle" (Install) butonuna basarak masaüstü veya mobil cihazınıza uygulama olarak kurabilirsiniz. Çevrimdışı çalışma desteği mevcuttur.

## Dağıtım (Deployment)
Vercel üzerine tek tıkla dağıtılabilir:
1. GitHub'a push edin.
2. Vercel'de yeni proje oluşturun.
3. `.env.local` içideki değişkenleri Vercel Dashboard'a ekleyin.

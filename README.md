# X Clone - Social Media Platform

Modern bir sosyal medya platformu. Kullanıcılar tweet atabilir, resim/video paylaşabilir, beğeni ve yorum yapabilir.

## Özellikler

- ✅ Kullanıcı kayıt ve giriş sistemi
- ✅ Tweet oluşturma, silme ve görüntüleme
- ✅ Resim ve video yükleme (Cloudinary entegrasyonu)
- ✅ Tweet beğenme ve yorum yapma
- ✅ Profil güncelleme (profil resmi, banner, bio vb.)
- ✅ Gerçek zamanlı bildirimler
- ✅ Responsive tasarım

## Teknolojiler

- **Backend:** Node.js, Express.js
- **Veritabanı:** MongoDB (Atlas)
- **Dosya Depolama:** Cloudinary
- **Frontend:** HTML, CSS, JavaScript
- **Deployment:** Vercel

## Kurulum

### 1. Projeyi Klonlayın

```bash
git clone <repository-url>
cd X
```

### 2. Gerekli Paketleri Yükleyin

```bash
npm install
```

### 3. Environment Variables Ayarlayın

`.env` dosyasını oluşturun ve aşağıdaki değişkenleri ekleyin:

```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string
PORT=3000
JWT_SECRET=your_jwt_secret_key

# Cloudinary (resim/video yükleme için)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

NODE_ENV=production
```

### 4. Cloudinary Hesabı Oluşturun

1. [Cloudinary](https://cloudinary.com) sitesinden ücretsiz hesap oluşturun
2. Dashboard'dan API bilgilerinizi alın
3. `.env` dosyasına ekleyin

### 5. Sunucuyu Başlatın

```bash
npm start
```

Sunucu http://localhost:3000 adresinde çalışacaktır.

## Vercel'e Deploy Etme

1. Vercel hesabınızla GitHub repository'nizi bağlayın
2. Environment variables'ları Vercel dashboard'ından ekleyin
3. Otomatik deploy işlemi başlayacaktır

## Kullanım

1. Login.html sayfasından kayıt olun veya giriş yapın
2. Ana sayfa (index.html) üzerinden tweet atabilirsiniz
3. Profil sayfasından (profile.html) profilinizi düzenleyebilirsiniz
4. Resim ve videolarınız Cloudinary üzerinde güvenli şekilde saklanır

## Proje Yapısı

```
├── server.js           # Ana sunucu dosyası
├── models/
│   └── schemas.js      # MongoDB şemaları
├── Login.html          # Giriş/Kayıt sayfası
├── index.html          # Ana sayfa
├── profile.html        # Profil sayfası
├── script.js           # Frontend JavaScript
├── *.css               # Stil dosyaları
└── vercel.json         # Vercel konfigürasyonu
```

## Sorun Giderme

**Resim/Video yüklenmiyor:**

- Cloudinary API bilgilerinizi kontrol edin
- .env dosyasının doğru ayarlandığından emin olun

**MongoDB bağlantı hatası:**

- MongoDB Atlas bağlantı string'inizi kontrol edin
- IP whitelist ayarlarınızı kontrol edin

**Vercel deployment sorunları:**

- Environment variables'ların Vercel'de ayarlandığından emin olun
- Build loglarını kontrol edin

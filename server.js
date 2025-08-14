const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { User, Tweet, Comment, Notification } = require('./models/schemas');
require('dotenv').config();

// Environment variables validation
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set');
  process.exit(1);
}

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Cloudinary environment variables are not set');
  process.exit(1);
}

// Cloudinary konfigürasyonu
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://x-tau-jet.vercel.app',
        'https://x-git-master-esra-ercans-projects.vercel.app', 
        'https://x-c20s86vs-esra-ercans-projects.vercel.app',
        /\.vercel\.app$/,
        /\.vercel\.com$/,
        'https://x-esraercan666s-projects.vercel.app',
        'https://x-pi-weld.vercel.app'
      ]
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'file://', 'null'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(express.static('.'));

// Uploads klasörünü statik olarak servis et (mevcut resimler için)
app.use('/uploads', express.static('uploads'));
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
    const allowedVideoTypes = /mp4|avi|mov|wmv|flv|webm|mkv|m4v/;
    const extname = path.extname(file.originalname).toLowerCase();
    
    const isImage = allowedImageTypes.test(extname) && file.mimetype.startsWith('image/');
    const isVideo = allowedVideoTypes.test(extname) && file.mimetype.startsWith('video/');
    
    if (isImage || isVideo) {
      return cb(null, true);
    } else {
      cb(new Error('Sadece resim ve video dosyaları yüklenebilir!'));
    }
  }
});

// Cloudinary'ye dosya yükleme fonksiyonu
async function uploadToCloudinary(buffer, resourceType = 'auto', folder = 'xclone') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: folder,
        quality: 'auto',
        fetch_format: 'auto'
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(buffer);
  });
}

// Uploads klasörünü statik olarak servis et
app.use('/uploads', express.static('uploads'));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xclone', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB bağlantı hatası:'));
db.once('open', () => {
  console.log('MongoDB bağlantısı başarılı!');
});

// Dosya silme yardımcı fonksiyonu
function deleteFileIfExists(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Dosya silindi:', filePath);
      return true;
    }
  } catch (error) {
    console.error('Dosya silinirken hata:', error);
    return false;
  }
  return false;
}

// Orphan dosyaları temizlemek için yardımcı fonksiyon
async function cleanupOrphanFiles() {
  try {
    const uploadsPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsPath)) return;

    const files = fs.readdirSync(uploadsPath);
    const allTweets = await Tweet.find({}, 'image video');
    const allUsers = await User.find({}, 'profileImage bannerImage');
    
    const usedFiles = new Set();
    
    // Tweet dosyalarını topla
    allTweets.forEach(tweet => {
      if (tweet.image) {
        const filename = path.basename(tweet.image);
        usedFiles.add(filename);
      }
      if (tweet.video) {
        const filename = path.basename(tweet.video);
        usedFiles.add(filename);
      }
    });
    
    // Kullanıcı profil dosyalarını topla
    allUsers.forEach(user => {
      if (user.profileImage) {
        const filename = path.basename(user.profileImage);
        usedFiles.add(filename);
      }
      if (user.bannerImage) {
        const filename = path.basename(user.bannerImage);
        usedFiles.add(filename);
      }
    });
    
    // Kullanılmayan dosyaları sil
    let deletedCount = 0;
    files.forEach(file => {
      if (!usedFiles.has(file)) {
        const filePath = path.join(uploadsPath, file);
        if (deleteFileIfExists(filePath)) {
          deletedCount++;
        }
      }
    });
    
    if (deletedCount > 0) {
      console.log(`${deletedCount} orphan dosya temizlendi`);
    }
    
  } catch (error) {
    console.error('Orphan dosya temizleme hatası:', error);
  }
}

// Güvenlik fonksiyonları
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // HTML tag karakterlerini kaldır
    .replace(/javascript:/gi, '') // JavaScript protokolünü kaldır
    .replace(/on\w+=/gi, '') // Event handler'ları kaldır
    .trim()
    .substring(0, 500); // Maksimum uzunluk limiti
}

function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}


function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}


function isValidPhone(phone) {
  const phoneRegex = /^[0-9]{10,11}$/;
  return phoneRegex.test(phone);
}

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, birth_date, phone } = req.body;

    // Girişleri güvenli hale getir
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedEmail = email ? sanitizeInput(email) : '';
    const sanitizedPhone = phone ? sanitizeInput(phone) : '';

    if (!sanitizedUsername || !password || !birth_date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kullanıcı adı, şifre ve doğum tarihi zorunludur' 
      });
    }

    if ((!sanitizedEmail || sanitizedEmail.trim() === '') && (!sanitizedPhone || sanitizedPhone.trim() === '')) {
      return res.status(400).json({ 
        success: false, 
        message: 'E-posta veya telefon numarası gereklidir' 
      });
    }

    // Email ve phone kontrollerini sadece değer varsa yap
    if (sanitizedEmail && sanitizedEmail.trim() !== '' && !isValidEmail(sanitizedEmail)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Geçerli bir e-posta adresi giriniz' 
      });
    }

    if (sanitizedPhone && sanitizedPhone.trim() !== '' && !isValidPhone(sanitizedPhone)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Telefon numarası 10-11 haneli olmalıdır' 
      });
    }
    
    // Mevcut kullanıcı kontrolü
    const orConditions = [{ username: sanitizedUsername }];
    if (sanitizedEmail && sanitizedEmail.trim() !== '') {
      orConditions.push({ email: sanitizedEmail.trim() });
    }
    if (sanitizedPhone && sanitizedPhone.trim() !== '') {
      orConditions.push({ phone: sanitizedPhone.trim() });
    }

    const existingUser = await User.findOne({
      $or: orConditions
    });

    if (existingUser) {
      if (existingUser.username === sanitizedUsername) {
        return res.status(400).json({ 
          success: false, 
          message: 'Bu kullanıcı adı zaten kullanılıyor' 
        });
      }
      if (sanitizedEmail && existingUser.email === sanitizedEmail) {
        return res.status(400).json({ 
          success: false, 
          message: 'Bu e-posta adresi zaten kullanılıyor' 
        });
      }
      if (sanitizedPhone && existingUser.phone === sanitizedPhone) {
        return res.status(400).json({ 
          success: false, 
          message: 'Bu telefon numarası zaten kullanılıyor' 
        });
      }
    }

    // Şifre hashleme
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new User({
      username: sanitizedUsername,
      email: sanitizedEmail && sanitizedEmail.trim() !== '' ? sanitizedEmail.trim() : undefined,
      password: hashedPassword,
      birth_date: new Date(birth_date),
      phone: sanitizedPhone && sanitizedPhone.trim() !== '' ? sanitizedPhone.trim() : undefined
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'Hesap başarıyla oluşturuldu',
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        birth_date: newUser.birth_date,
        phone: newUser.phone,
        created_at: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Kayıt hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası' 
    });
  }
});

// Kullanıcı adı benzersizlik kontrolü endpointi
app.post('/api/check-username', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Kullanıcı adı gereklidir' 
      });
    }

    // Kullanıcı adı benzersizlik kontrolü
    const existingUser = await User.findOne({ username: username.trim() });

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bu kullanıcı adı zaten kullanılıyor' 
      });
    }

    res.json({
      success: true,
      message: 'Kullanıcı adı kullanılabilir'
    });

  } catch (error) {
    console.error('Kullanıcı adı kontrol hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası' 
    });
  }
});

// Kullanıcı kontrol endpointi
app.post('/api/check-user', async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kullanıcı adı, e-posta veya telefon gerekli' 
      });
    }

    // Kullanıcıyı bulmaa
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier },
        { phone: identifier }
      ]
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kullanıcı bulunamadı' 
      });
    }

    res.json({
      success: true,
      message: 'Kullanıcı bulundu',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Kullanıcı kontrol hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası' 
    });
  }
});

// Şifre kontrol endpointi
app.post('/api/login', async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kullanıcı ID ve şifre gerekli' 
      });
    }

    // Kullanıcıyı ID ile bul
    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kullanıcı bulunamadı' 
      });
    }

    // Şifre kontrolü
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Geçersiz şifre' 
      });
    }

    res.json({
      success: true,
      message: 'Giriş başarılı',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        birth_date: user.birth_date,
        phone: user.phone,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Giriş hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası' 
    });
  }
});

// Profil güncelleme endpointi
app.put('/api/user/:userId', upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const { userId } = req.params;
    const { displayName, bio, location, website } = req.body;

    // Kullanıcıyı bul
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Girişleri güvenli hale getir
    const sanitizedDisplayName = sanitizeInput(displayName);
    const sanitizedBio = sanitizeInput(bio);
    const sanitizedLocation = sanitizeInput(location);
    
    // Website URL'ini kontrol et
    let sanitizedWebsite = '';
    if (website && website.trim() !== '') {
      if (isValidUrl(website.trim())) {
        sanitizedWebsite = website.trim();
      } else {
        return res.status(400).json({
          success: false,
          message: 'Geçersiz website URL\'si'
        });
      }
    }

    // Güncellenecek veriler
    const updateData = {};

    // Bu alanlar her zaman güncellenir (boş olsa bile)
    updateData.displayName = sanitizedDisplayName;
    updateData.bio = sanitizedBio;
    updateData.location = sanitizedLocation;
    updateData.website = sanitizedWebsite;

    // Profil resmi yüklendiyse
    if (req.files && req.files.profileImage) {
      try {
        const profileImageResult = await uploadToCloudinary(
          req.files.profileImage[0].buffer, 
          'image', 
          'xclone/profiles'
        );
        updateData.profileImage = profileImageResult.secure_url;
        console.log('Profil resmi Cloudinary\'ye yüklendi:', profileImageResult.secure_url);
      } catch (error) {
        console.error('Profil resmi yükleme hatası:', error);
      }
    }

    // Banner resmi yüklendiyse
    if (req.files && req.files.bannerImage) {
      try {
        const bannerImageResult = await uploadToCloudinary(
          req.files.bannerImage[0].buffer, 
          'image', 
          'xclone/banners'
        );
        updateData.bannerImage = bannerImageResult.secure_url;
        console.log('Banner resmi Cloudinary\'ye yüklendi:', bannerImageResult.secure_url);
      } catch (error) {
        console.error('Banner resmi yükleme hatası:', error);
      }
    }

    // Kullanıcıyı güncelle
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profil başarıyla güncellendi',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        bio: updatedUser.bio,
        location: updatedUser.location,
        website: updatedUser.website,
        profileImage: updatedUser.profileImage,
        bannerImage: updatedUser.bannerImage,
        email: updatedUser.email,
        birth_date: updatedUser.birth_date,
        phone: updatedUser.phone,
        created_at: updatedUser.created_at
      }
    });

  } catch (error) {
    console.error('Profil güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Kullanıcı bilgilerini getirme endpointi
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        location: user.location,
        website: user.website,
        profileImage: user.profileImage,
        bannerImage: user.bannerImage,
        email: user.email,
        birth_date: user.birth_date,
        phone: user.phone,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Kullanıcı bilgileri getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Tweet oluşturma endpointi
app.post('/api/tweets', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Tweet oluşturma isteği alındı');
    console.log('req.body:', req.body);
    console.log('req.files:', req.files);
    
    const { content, userId } = req.body;

    if (!content || !userId) {
      console.log('Eksik veriler - content:', content, 'userId:', userId);
      return res.status(400).json({
        success: false,
        message: 'Content ve userId gerekli'
      });
    }

    // İçeriği güvenli hale getir
    const sanitizedContent = sanitizeInput(content);
    if (!sanitizedContent || sanitizedContent.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tweet içeriği geçersiz'
      });
    }

    // Kullanıcının var olup olmadığını kontrol et
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    let imageUrl = '';
    let videoUrl = '';

    // Resim yükleme
    if (req.files && req.files.image) {
      try {
        const imageResult = await uploadToCloudinary(
          req.files.image[0].buffer, 
          'image', 
          'xclone/tweets'
        );
        imageUrl = imageResult.secure_url;
        console.log('Resim Cloudinary\'ye yüklendi:', imageUrl);
      } catch (error) {
        console.error('Resim yükleme hatası:', error);
      }
    }

    // Video yükleme
    if (req.files && req.files.video) {
      try {
        const videoResult = await uploadToCloudinary(
          req.files.video[0].buffer, 
          'video', 
          'xclone/tweets'
        );
        videoUrl = videoResult.secure_url;
        console.log('Video Cloudinary\'ye yüklendi:', videoUrl);
      } catch (error) {
        console.error('Video yükleme hatası:', error);
      }
    }

    const newTweet = new Tweet({
      content: sanitizedContent,
      userId: userId,
      image: imageUrl,
      video: videoUrl,
      views: 1 // İlk görüntüleme
    });

    await newTweet.save();
    console.log('Tweet başarıyla kaydedildi:', newTweet);

    // Tweet'i kullanıcı bilgileriyle birlikte döndür
    const populatedTweet = await Tweet.findById(newTweet._id).populate('userId', 'username displayName profileImage');

    res.status(201).json({
      success: true,
      message: 'Tweet başarıyla oluşturuldu',
      tweet: {
        _id: populatedTweet._id,
        content: populatedTweet.content,
        image: populatedTweet.image,
        video: populatedTweet.video,
        likes: populatedTweet.likes,
        retweets: populatedTweet.retweets,
        comments: populatedTweet.comments,
        views: populatedTweet.views,
        created_at: populatedTweet.created_at,
        user: {
          _id: populatedTweet.userId._id,
          username: populatedTweet.userId.username,
          displayName: populatedTweet.userId.displayName,
          profileImage: populatedTweet.userId.profileImage
        }
      }
    });

  } catch (error) {
    console.error('Tweet oluşturma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Tüm tweetleri getirme endpointi
app.get('/api/tweets', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const tweets = await Tweet.find()
      .populate('userId', 'username displayName profileImage')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const formattedTweets = tweets.map(tweet => ({
      _id: tweet._id,
      content: tweet.content,
      image: tweet.image,
      video: tweet.video,
      likes: tweet.likes,
      retweets: tweet.retweets,
      comments: tweet.comments,
      views: tweet.views,
      created_at: tweet.created_at,
      user: {
        _id: tweet.userId._id,
        username: tweet.userId.username,
        displayName: tweet.userId.displayName,
        profileImage: tweet.userId.profileImage
      }
    }));

    res.json({
      success: true,
      tweets: formattedTweets,
      pagination: {
        page,
        limit,
        hasMore: tweets.length === limit
      }
    });

  } catch (error) {
    console.error('Tweet listesi getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Belirli bir kullanıcının tweetlerini getirme endpointi
app.get('/api/tweets/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const tweets = await Tweet.find({ userId })
      .populate('userId', 'username displayName profileImage')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const formattedTweets = tweets.map(tweet => ({
      _id: tweet._id,
      content: tweet.content,
      image: tweet.image,
      video: tweet.video,
      likes: tweet.likes,
      retweets: tweet.retweets,
      comments: tweet.comments,
      views: tweet.views,
      created_at: tweet.created_at,
      user: {
        _id: tweet.userId._id,
        username: tweet.userId.username,
        displayName: tweet.userId.displayName,
        profileImage: tweet.userId.profileImage
      }
    }));

    res.json({
      success: true,
      tweets: formattedTweets,
      pagination: {
        page,
        limit,
        hasMore: tweets.length === limit
      }
    });

  } catch (error) {
    console.error('Kullanıcı tweetleri getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Tweet beğenme/beğenmeme endpointi
app.post('/api/tweets/:tweetId/like', async (req, res) => {
  try {
    const { tweetId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı ID gerekli'
      });
    }

    const tweet = await Tweet.findById(tweetId).populate('userId', 'username displayName');
    if (!tweet) {
      return res.status(404).json({
        success: false,
        message: 'Tweet bulunamadı'
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const isLiked = tweet.likedBy.includes(userObjectId);

    if (isLiked) {
      // Beğeniyi kaldır
      tweet.likedBy.pull(userObjectId);
      tweet.likes = Math.max(0, tweet.likes - 1);
      
      // Bildirimi sil
      await Notification.findOneAndDelete({
        type: 'like',
        fromUser: userObjectId,
        toUser: tweet.userId._id,
        tweet: tweetId
      });
    } else {
      // Beğeni ekle
      tweet.likedBy.push(userObjectId);
      tweet.likes += 1;
      
      // Kendi tweet'ini beğenmiyorsa bildirim oluştur
      if (tweet.userId._id.toString() !== userId) {
        const notification = new Notification({
          type: 'like',
          fromUser: userObjectId,
          toUser: tweet.userId._id,
          tweet: tweetId
        });
        await notification.save();
      }
    }

    await tweet.save();

    res.json({
      success: true,
      liked: !isLiked,
      likes: tweet.likes
    });

  } catch (error) {
    console.error('Tweet beğeni hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Tweet görüntüleme sayısını artırma endpointi
app.post('/api/tweets/:tweetId/view', async (req, res) => {
  try {
    const { tweetId } = req.params;

    const tweet = await Tweet.findByIdAndUpdate(
      tweetId,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!tweet) {
      return res.status(404).json({
        success: false,
        message: 'Tweet bulunamadı'
      });
    }

    res.json({
      success: true,
      views: tweet.views
    });

  } catch (error) {
    console.error('Tweet görüntüleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Yorum ekleme endpoint'i
app.post('/api/comments', upload.single('image'), async (req, res) => {
  try {
    const { content, userId, tweetId } = req.body;

    if (!content || !userId || !tweetId) {
      return res.status(400).json({
        success: false,
        message: 'Content, userId ve tweetId gerekli'
      });
    }

    // İçeriği güvenli hale getir
    const sanitizedContent = sanitizeInput(content);
    if (!sanitizedContent || sanitizedContent.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Yorum içeriği geçersiz'
      });
    }

    // Kullanıcının var olup olmadığını kontrol et
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Tweet'in var olup olmadığını kontrol et
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      return res.status(404).json({
        success: false,
        message: 'Tweet bulunamadı'
      });
    }

    // Yorum oluştur
    let imageUrl = '';
    
    // Resim yüklendiyse Cloudinary'ye yükle
    if (req.file) {
      try {
        const imageResult = await uploadToCloudinary(
          req.file.buffer, 
          'image', 
          'xclone/comments'
        );
        imageUrl = imageResult.secure_url;
        console.log('Yorum resmi Cloudinary\'ye yüklendi:', imageUrl);
      } catch (error) {
        console.error('Yorum resmi yükleme hatası:', error);
      }
    }

    const newComment = new Comment({
      content: sanitizedContent,
      userId: userId,
      tweetId: tweetId,
      image: imageUrl
    });

    await newComment.save();

    // Tweet'in yorum sayısını artır
    await Tweet.findByIdAndUpdate(tweetId, {
      $inc: { comments: 1 }
    });
    
    // Kendi tweet'ine yorum yapmıyorsa bildirim oluştur
    if (tweet.userId.toString() !== userId) {
      const notification = new Notification({
        type: 'comment',
        fromUser: userId,
        toUser: tweet.userId,
        tweet: tweetId,
        comment: newComment._id
      });
      await notification.save();
    }

    res.status(201).json({
      success: true,
      message: 'Yorum başarıyla eklendi',
      comment: newComment
    });

  } catch (error) {
    console.error('Yorum ekleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Yorum silme endpoint'i
app.delete('/api/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    // Yorum var mı kontrol et
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Yorum bulunamadı'
      });
    }

    // Sadece yorum sahibi silebilir
    if (comment.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bu yorumu silme yetkiniz yok'
      });
    }

    // Yorumu sil
    await Comment.findByIdAndDelete(commentId);

    // Tweet'in yorum sayısını azalt
    await Tweet.findByIdAndUpdate(comment.tweetId, {
      $inc: { comments: -1 }
    });

    res.json({
      success: true,
      message: 'Yorum başarıyla silindi'
    });

  } catch (error) {
    console.error('Yorum silme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Yorumları getirme endpoint'i
app.get('/api/comments/:tweetId', async (req, res) => {
  try {
    const { tweetId } = req.params;

    // Tweet'in var olup olmadığını kontrol et
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      return res.status(404).json({
        success: false,
        message: 'Tweet bulunamadı'
      });
    }

    // Yorumları getir (kullanıcı bilgileriyle birlikte)
    const comments = await Comment.find({ tweetId: tweetId })
      .populate('userId', 'username displayName profileImage')
      .sort({ created_at: 1 }); // Eskiden yeniye sırala

    const formattedComments = comments.map(comment => ({
      _id: comment._id,
      content: comment.content,
      image: comment.image,
      user: comment.userId,
      likes: comment.likes,
      likedBy: comment.likedBy,
      created_at: comment.created_at
    }));

    res.json({
      success: true,
      comments: formattedComments,
      count: comments.length
    });

  } catch (error) {
    console.error('Yorumları getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Kullanıcının beğendiği tweetleri getirme endpoint'i
app.get('/api/user/:userId/liked-tweets', async (req, res) => {
  try {
    const { userId } = req.params;

    // Kullanıcının var olup olmadığını kontrol et
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Kullanıcının beğendiği tweetleri getir
    const likedTweets = await Tweet.find({ 
      likedBy: new mongoose.Types.ObjectId(userId) 
    })
    .populate('userId', 'username displayName profileImage')
    .populate('comments')
    .sort({ created_at: -1 }); // Yeniden eskiye sırala

    const formattedTweets = likedTweets.map(tweet => ({
      _id: tweet._id,
      content: tweet.content,
      image: tweet.image,
      video: tweet.video,
      user: tweet.userId,
      likes: tweet.likes,
      comments: tweet.comments.length,
      retweets: tweet.retweets,
      views: tweet.views,
      likedBy: tweet.likedBy,
      created_at: tweet.created_at
    }));

    res.json({
      success: true,
      tweets: formattedTweets,
      count: formattedTweets.length
    });

  } catch (error) {
    console.error('Beğenilen tweetleri getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Kullanıcının kendi tweetlerini getirme endpoint'i
app.get('/api/user/:userId/tweets', async (req, res) => {
  try {
    const { userId } = req.params;

    // Kullanıcının var olup olmadığını kontrol et
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Kullanıcının tweetlerini getir
    const userTweets = await Tweet.find({ 
      userId: new mongoose.Types.ObjectId(userId) 
    })
    .populate('userId', 'username displayName profileImage')
    .populate('comments')
    .sort({ created_at: -1 }); // Yeniden eskiye sırala

    const formattedTweets = userTweets.map(tweet => ({
      _id: tweet._id,
      content: tweet.content,
      image: tweet.image,
      video: tweet.video,
      user: tweet.userId,
      likes: tweet.likes,
      comments: tweet.comments.length,
      retweets: tweet.retweets,
      views: tweet.views,
      likedBy: tweet.likedBy,
      created_at: tweet.created_at
    }));

    res.json({
      success: true,
      tweets: formattedTweets,
      count: formattedTweets.length
    });

  } catch (error) {
    console.error('Kullanıcı tweetlerini getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Tweet silme endpoint'i
app.delete('/api/tweets/:tweetId', async (req, res) => {
  try {
    const { tweetId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'UserId gerekli'
      });
    }

    // Tweet'i bul
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      return res.status(404).json({
        success: false,
        message: 'Tweet bulunamadı'
      });
    }

    // Kullanıcı kendi tweet'ini mi siliyor kontrol et
    if (tweet.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bu tweet\'i silme yetkiniz yok'
      });
    }

    // Tweet ile ilişkili dosyaları sil
    if (tweet.image) {
      const imagePath = path.join(__dirname, tweet.image);
      deleteFileIfExists(imagePath);
    }

    if (tweet.video) {
      const videoPath = path.join(__dirname, tweet.video);
      deleteFileIfExists(videoPath);
    }

    // Tweet'i sil
    await Tweet.findByIdAndDelete(tweetId);

    // İlgili yorumları da sil
    await Comment.deleteMany({ tweetId: tweetId });

    res.json({
      success: true,
      message: 'Tweet başarıyla silindi'
    });

  } catch (error) {
    console.error('Tweet silme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Orphan dosyaları temizleme endpoint'i (admin/maintenance için)
app.post('/api/cleanup-files', async (req, res) => {
  try {
    await cleanupOrphanFiles();
    res.json({
      success: true,
      message: 'Dosya temizleme işlemi tamamlandı'
    });
  } catch (error) {
    console.error('Dosya temizleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Dosya temizleme sırasında hata oluştu'
    });
  }
});

// En çok posta sahip kullanıcıları getirme endpoint'i
app.get('/api/top-users', async (req, res) => {
  try {
    // Her kullanıcının post sayısını hesapla ve en çok posta sahip 3 kullanıcıyı getir
    const topUsers = await User.aggregate([
      {
        $lookup: {
          from: 'tweets',
          localField: '_id',
          foreignField: 'userId',
          as: 'tweets'
        }
      },
      {
        $addFields: {
          tweetCount: { $size: '$tweets' }
        }
      },
      {
        $match: {
          tweetCount: { $gt: 0 } // En az 1 tweet'i olan kullanıcılar
        }
      },
      {
        $sort: { tweetCount: -1 } // Tweet sayısına göre azalan sıralama
      },
      {
        $limit: 3 // İlk 3 kullanıcı
      },
      {
        $project: {
          _id: 1,
          username: 1,
          displayName: 1,
          profileImage: 1,
          tweetCount: 1
        }
      }
    ]);

    res.json({
      success: true,
      users: topUsers
    });

  } catch (error) {
    console.error('En çok posta sahip kullanıcıları getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

// Kullanıcının bildirimlerini getir
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const notifications = await Notification.find({ toUser: userId })
      .populate('fromUser', 'username displayName profileImage')
      .populate('tweet', 'content')
      .sort({ created_at: -1 })
      .limit(50);
    
    res.json({
      success: true,
      notifications: notifications
    });
  } catch (error) {
    console.error('Bildirimler getirilirken hata:', error);
    res.status(500).json({
      success: false,
      message: 'Bildirimler getirilirken hata oluştu'
    });
  }
});

// Bildirimi okundu olarak işaretle
app.put('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    await Notification.findByIdAndUpdate(notificationId, {
      read: true
    });
    
    res.json({
      success: true,
      message: 'Bildirim okundu olarak işaretlendi'
    });
  } catch (error) {
    console.error('Bildirim güncellenirken hata:', error);
    res.status(500).json({
      success: false,
      message: 'Bildirim güncellenirken hata oluştu'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
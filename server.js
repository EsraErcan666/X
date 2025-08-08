const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'file://', 'null'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('.'));

// Uploads klasörünü oluştur
const uploadsDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Multer konfigürasyonu
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit (video dosyaları için)
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = /jpeg|jpg|png|gif/;
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

// Kullanıcı Şeması
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true, // Boş değerler için unique kontrolü yapmaz
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
       
        if (!v || v === '') return true;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(v);
      },
      message: 'Geçerli bir e-posta adresi giriniz'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  birth_date: {
    type: Date,
    required: true
  },
  phone: {
    type: String,
    required: false,
    unique: true,
    sparse: true, 
    trim: true,
    validate: {
      validator: function(v) {
        if (!v || v === '') return true;
        return v.length >= 10 && v.length <= 11;
      },
      message: 'Telefon numarası 10-11 haneli olmalıdır'
    }
  },
  displayName: {
    type: String,
    maxlength: 50,
    default: function() {
      return this.username;
    }
  },
  bio: {
    type: String,
    maxlength: 160,
    default: ''
  },
  location: {
    type: String,
    maxlength: 30,
    default: ''
  },
  website: {
    type: String,
    maxlength: 100,
    default: ''
  },
  profileImage: {
    type: String,
    default: ''
  },
  bannerImage: {
    type: String,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

// Tweet Şeması
const tweetSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 280,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  video: {
    type: String,
    default: ''
  },
  likes: {
    type: Number,
    default: 0
  },
  retweets: {
    type: Number,
    default: 0
  },
  comments: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  retweetedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  created_at: {
    type: Date,
    default: Date.now
  }
});

const Tweet = mongoose.model('Tweet', tweetSchema);

// Yorum şeması
const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 280,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tweetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tweet',
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  created_at: {
    type: Date,
    default: Date.now
  }
});

const Comment = mongoose.model('Comment', commentSchema);

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
      // Eski profil resmini sil
      if (user.profileImage) {
        const oldImagePath = path.join(__dirname, user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.profileImage = '/uploads/' + req.files.profileImage[0].filename;
    }

    // Banner resmi yüklendiyse
    if (req.files && req.files.bannerImage) {
      // Eski banner resmini sil
      if (user.bannerImage) {
        const oldBannerPath = path.join(__dirname, user.bannerImage);
        if (fs.existsSync(oldBannerPath)) {
          fs.unlinkSync(oldBannerPath);
        }
      }
      updateData.bannerImage = '/uploads/' + req.files.bannerImage[0].filename;
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

    const newTweet = new Tweet({
      content: sanitizedContent,
      userId: userId,
      image: req.files && req.files.image ? '/uploads/' + req.files.image[0].filename : '',
      video: req.files && req.files.video ? '/uploads/' + req.files.video[0].filename : '',
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
        message: 'UserId gerekli'
      });
    }

    const tweet = await Tweet.findById(tweetId);
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
    } else {
      // Beğeni ekle
      tweet.likedBy.push(userObjectId);
      tweet.likes += 1;
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
    const newComment = new Comment({
      content: sanitizedContent,
      userId: userId,
      tweetId: tweetId,
      image: req.file ? '/uploads/' + req.file.filename : ''
    });

    await newComment.save();

    // Tweet'in yorum sayısını artır
    await Tweet.findByIdAndUpdate(tweetId, {
      $inc: { comments: 1 }
    });

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

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
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
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir!'));
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

    if (!username || !password || !birth_date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kullanıcı adı, şifre ve doğum tarihi zorunludur' 
      });
    }

    if ((!email || email.trim() === '') && (!phone || phone.trim() === '')) {
      return res.status(400).json({ 
        success: false, 
        message: 'E-posta veya telefon numarası gereklidir' 
      });
    }

    // Email ve phone kontrollerini sadece değer varsa yap
    if (email && email.trim() !== '' && !isValidEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Geçerli bir e-posta adresi giriniz' 
      });
    }

    if (phone && phone.trim() !== '' && !isValidPhone(phone)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Telefon numarası 10-11 haneli olmalıdır' 
      });
    }
    
    // Mevcut kullanıcı kontrolü
    const orConditions = [{ username }];
    if (email && email.trim() !== '') {
      orConditions.push({ email: email.trim() });
    }
    if (phone && phone.trim() !== '') {
      orConditions.push({ phone: phone.trim() });
    }

    const existingUser = await User.findOne({
      $or: orConditions
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ 
          success: false, 
          message: 'Bu kullanıcı adı zaten kullanılıyor' 
        });
      }
      if (email && existingUser.email === email) {
        return res.status(400).json({ 
          success: false, 
          message: 'Bu e-posta adresi zaten kullanılıyor' 
        });
      }
      if (phone && existingUser.phone === phone) {
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
      username,
      email: email && email.trim() !== '' ? email.trim() : undefined,
      password: hashedPassword,
      birth_date: new Date(birth_date),
      phone: phone && phone.trim() !== '' ? phone.trim() : undefined
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

    // Güncellenecek veriler
    const updateData = {};

    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (website !== undefined) updateData.website = website;

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

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
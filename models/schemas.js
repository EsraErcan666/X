const mongoose = require('mongoose');

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

// Notification Şeması
const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['like', 'comment', 'retweet', 'follow']
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tweet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tweet',
    required: false
  },
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    required: false
  },
  read: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Model'leri oluştur ve export et
const User = mongoose.model('User', userSchema);
const Tweet = mongoose.model('Tweet', tweetSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = {
  User,
  Tweet,
  Comment,
  Notification,
  userSchema,
  tweetSchema,
  commentSchema,
  notificationSchema
};

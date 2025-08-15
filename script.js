// API adresini otomatik belirle
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : window.location.origin;

console.log('API_URL Debug:', {
  hostname: window.location.hostname,
  origin: window.location.origin,
  API_URL: API_URL
});

// Test için geçici kullanıcı oluştur
if (!localStorage.getItem('user')) {
  const testUser = {
    _id: '60a5f9c5a1b2c3d4e5f6g7h8',
    username: 'testuser',
    displayName: 'Test User',
    email: 'test@example.com'
  };
  localStorage.setItem('user', JSON.stringify(testUser));
}

// Sayfa yüklendiğinde login kontrolü (test için devre dışı)
/*
(function() {
  const user = localStorage.getItem('user');
  if (!user) {
    window.location.href = 'Login.html';
  }
})();
*/

// Authentication kontrolü fonksiyonu
function checkAuthentication() {
  const user = localStorage.getItem('user');
  
  // Eğer kullanıcı bilgisi yoksa login sayfasına yönlendir
  if (!user) {
    window.location.href = 'loading.html?target=Login.html';
    return false;
  }
  
  try {
    const userData = JSON.parse(user);
    // Kullanıcı verisi geçersizse login sayfasına yönlendir
    if (!userData || !userData._id) {
      localStorage.removeItem('user');
      localStorage.removeItem('currentUserId');
      window.location.href = 'loading.html?target=Login.html';
      return false;
    }
  } catch (error) {
    // JSON parse hatası varsa login sayfasına yönlendir
    localStorage.removeItem('user');
    localStorage.removeItem('currentUserId');
    window.location.href = 'loading.html?target=Login.html';
    return false;
  }
  
  return true;
}

// Authentication başarılıysa normal şekilde devam et
let tweetInput, modalTweetInput, tweetList, tweetModal, tweetTemplate, profileTemplate;
let postButton, modalPostButton, closeModalBtn, postButtonMain;
let tweetDropdownsInitialized = false; // Tweet dropdown event listener'larının kurulup kurulmadığını takip et

const currentUser = {
  id: 1,
  username: "kullanici",
  displayName: "Kullanıcı Adı",
  avatar: ""
};

// Güvenlik fonksiyonu - kullanıcı girişlerini temizler
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  // Tehlikeli karakterleri temizle
  return input
    .replace(/[<>]/g, '') // HTML tag karakterlerini kaldır
    .replace(/javascript:/gi, '') // JavaScript protokolünü kaldır
    .replace(/on\w+=/gi, '') // Event handler'ları kaldır
    .trim();
}

// URL'lerin güvenli olup olmadığını kontrol et
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

// Tweet verilerini veritabanından çekeceğiz
let tweets = [];

// Tweet'leri veritabanından yükle
async function loadTweets() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    let url = `${API_URL}/api/tweets`;
    
    // Kullanıcı giriş yapmışsa userId'yi ekle
    if (user && user._id) {
      url += `?userId=${user._id}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
      tweets = data.tweets.map(tweet => ({
        id: tweet._id,
        userId: tweet.user._id,
        username: tweet.user.username,
        displayName: tweet.user.displayName || tweet.user.username,
        verified: false, // Bu bilgiyi kullanıcı şemasına ekleyebiliriz
        avatar: tweet.user.profileImage || '',
        content: tweet.content,
        image: tweet.image || '',
        video: tweet.video || '',
        timestamp: formatTimestamp(tweet.created_at),
        likes: tweet.likes,
        comments: tweet.comments,
        retweets: tweet.retweets,
        views: tweet.views,
        isLiked: tweet.isLiked || false // Liked durumunu ekle
      }));
      renderTweets();
    } else {
      console.error('Tweet yükleme hatası:', data.message);
      showNotification('Tweet\'ler yüklenirken hata oluştu', 'error');
    }
  } catch (error) {
    console.error('Tweet yükleme hatası:', error);
    showNotification('Tweet\'ler yüklenirken hata oluştu', 'error');
  }
}

// Timestamp'i okunabilir formata çevir
function formatTimestamp(timestamp) {
  const now = new Date();
  const tweetDate = new Date(timestamp);
  const diffInMs = now - tweetDate;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return 'şimdi';
  if (diffInMinutes < 60) return `${diffInMinutes}dk`;
  if (diffInHours < 24) return `${diffInHours}sa`;
  if (diffInDays < 30) return `${diffInDays}g`;
  
  return tweetDate.toLocaleDateString('tr-TR', { 
    day: 'numeric', 
    month: 'short' 
  });
}

async function loadTopUsers() {
  try {
    const response = await fetch(`${API_URL}/api/top-users`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      if (data.users && data.users.length > 0) {
        updateWhoToFollowSection(data.users);
      } else {
        console.log('Henüz tweet atan kullanıcı yok:', data.message || 'Boş sonuç');
        // Boş durumda varsayılan içerik göster
        updateWhoToFollowSectionEmpty();
      }
    } else {
      console.error('Top users API hatası:', data.message);
    }
  } catch (error) {
    console.error('En çok posta sahip kullanıcıları yükleme hatası:', error);
    // Hata durumunda varsayılan içerik göster
    updateWhoToFollowSectionEmpty();
  }
}

function updateWhoToFollowSection(users) {
  const whoToFollowSections = document.querySelectorAll('.who-to-follow, .who-to-follow-section');
  
  whoToFollowSections.forEach(section => {
    const existingItems = section.querySelectorAll('.follow-item');
    existingItems.forEach(item => item.remove());
    
    const showMoreElement = section.querySelector('.show-more');
    
    users.forEach(user => {
      const followItem = createFollowItem(user);
      if (showMoreElement) {
        section.insertBefore(followItem, showMoreElement);
      } else {
        section.appendChild(followItem);
      }
    });
  });
}

function updateWhoToFollowSectionEmpty() {
  const whoToFollowSections = document.querySelectorAll('.who-to-follow, .who-to-follow-section');
  
  whoToFollowSections.forEach(section => {
    const existingItems = section.querySelectorAll('.follow-item');
    existingItems.forEach(item => item.remove());
    
    const showMoreElement = section.querySelector('.show-more');
    
    // Boş durum mesajı göster
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'follow-item empty-state';
    emptyMessage.innerHTML = `
      <div style="padding: 16px; text-align: center; color: #65676B;">
        <p>Henüz hiç tweet yok</p>
        <small>İlk tweeti sen at!</small>
      </div>
    `;
    
    if (showMoreElement) {
      section.insertBefore(emptyMessage, showMoreElement);
    } else {
      section.appendChild(emptyMessage);
    }
  });
}

// Follow item elementi oluştur
function createFollowItem(user) {
  const followItem = document.createElement('div');
  followItem.className = 'follow-item';
  
  const displayName = user.displayName || user.username;
  
  // Profil resmi URL'sini doğru şekilde oluştur
  let profileImageSrc = '';
  if (user.profileImage && user.profileImage.trim() !== '') {
    profileImageSrc = user.profileImage.startsWith('http') 
      ? user.profileImage 
      : `${API_URL}${user.profileImage}`;
  } else {
    // Varsayılan avatar göster
    profileImageSrc = 'images/logo.png';
  }
  
  followItem.innerHTML = `
    <img src="${profileImageSrc}" alt="${displayName}" class="avatar" />
    <div class="follow-info">
      <div class="follow-name">${displayName}</div>
      <div class="follow-username">@${user.username}</div>
    </div>
    <button class="follow-button">Follow</button>
  `;
  
  return followItem;
}

document.addEventListener("DOMContentLoaded", function() {
  // Tekrar login kontrolü yap (güvenlik için)
  if (!checkAuthentication()) {
    return;
  }
  
  tweetInput = document.getElementById('tweetInput');
  modalTweetInput = document.getElementById('modalTweetInput');
  tweetList = document.getElementById('tweetList');
  tweetModal = document.getElementById('tweetModal');
  tweetTemplate = document.getElementById('tweetTemplate');
  profileTemplate = document.getElementById('profileTemplate');
  postButton = document.querySelector('.tweet-actions button');
  modalPostButton = document.getElementById('modalPostButton');
  closeModalBtn = document.querySelector('.close-modal');
  postButtonMain = document.querySelector('.post-button');
  
  loadTweets(); // Tweet'leri yükle
  loadTopUsers(); // En çok posta sahip kullanıcıları yükle
  setupEventListeners();
  setupTweetModal();
  setupButtonStates();
  setupProfileMenu();
  setupTweetDropdowns(); // Tweet dropdown event listener'larını kur
  loadSidebarUserInfo();
  initializeMobileProfileMenu(); // Mobile profil menüsünü başlat
  initializeMobileBackButtons(); // Mobile geri butonlarını başlat
});

function setupProfileMenu() {
  const profileMenu = document.querySelector('.profile-menu');
  const profileDropdown = document.querySelector('.profile-dropdown');
  const logoutItem = document.querySelector('.logout-item');
  
  if (profileMenu && profileDropdown) {
    profileMenu.addEventListener('click', function(e) {
      e.stopPropagation();
      profileDropdown.classList.toggle('show');
    });
     
    profileDropdown.addEventListener('click', function(e) {
      e.stopPropagation();
    });
     
    document.addEventListener('click', function() {
      profileDropdown.classList.remove('show');
    });
  }
  
  if (logoutItem) {
    logoutItem.addEventListener('click', function() {
      console.log('Profile logout işlemi başlatılıyor...');
      
      // localStorage'ı temizle
      localStorage.removeItem('user');
      localStorage.removeItem('currentUserId');
      localStorage.removeItem('authToken');
      
      console.log('Profile logout - LocalStorage temizlendi');
      
      // Loading sayfası üzerinden Login sayfasına yönlendir
      console.log('Profile logout - Login sayfasına yönlendiriliyor...');
      window.location.href = 'loading.html?target=Login.html';
    });
  }
}
function setupEventListeners() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", function() {
      tabs.forEach(t => t.classList.remove("active"));
      this.classList.add("active");
    });
  });

  const menuItems = document.querySelectorAll(".left-sidebar nav ul li");
  menuItems.forEach((item, index) => {
    item.addEventListener("click", function() {
      menuItems.forEach(i => i.classList.remove("active"));
      this.classList.add("active");
      
      if (index === 2) { // Notifications (3. sırada)
        showNotificationsContent();
      } else if (index === 8) { // Profile
        showProfileContent();
      } else {
        showHomeContent();
      }
    });
  });
  
  postButtonMain.addEventListener("click", function() {
    openTweetModal();
  });
}

function showProfileContent() {
  const homeContent = document.getElementById('homeContent');
  const profileContent = document.getElementById('profileContent');
  const notificationsContent = document.getElementById('notificationsContent');
  
  if (profileContent.innerHTML.trim() === '<!--  -->') {
    loadProfileContent();
  } else {
    loadUserProfile();
  }
  
  // Diğer content'leri gizle
  homeContent.classList.remove('active');
  if (notificationsContent) {
    notificationsContent.classList.remove('active');
  }
  
  // Profile content'i göster
  profileContent.classList.add('active');
  setupProfileEventListeners();
  loadTopUsers();
  
  // Varsayılan olarak Posts tab'ını aktif yap ve kullanıcının postlarını yükle
  setTimeout(() => {
    const postsTab = document.querySelector('.profile-tab:first-child');
    if (postsTab) {
      // Diğer tab'ları pasif yap
      document.querySelectorAll('.profile-tab').forEach(tab => tab.classList.remove('active'));
      // Posts tab'ını aktif yap
      postsTab.classList.add('active');
      loadUserPosts();
    }
  }, 100);
}

function showHomeContent() {
  const homeContent = document.getElementById('homeContent');
  const profileContent = document.getElementById('profileContent');
  const notificationsContent = document.getElementById('notificationsContent');
  
  // Diğer content'leri gizle
  profileContent.classList.remove('active');
  if (notificationsContent) {
    notificationsContent.classList.remove('active');
  }
  
  // Home content'i göster
  homeContent.classList.add('active');
  
  const menuItems = document.querySelectorAll(".left-sidebar nav ul li");
  menuItems.forEach(i => i.classList.remove("active"));
  menuItems[0].classList.add("active"); 
}

function loadProfileContent() {
  const profileContent = document.getElementById('profileContent');
  
  const profileClone = profileTemplate.content.cloneNode(true);
  profileContent.appendChild(profileClone);
  loadUserProfile();
  loadUserTweets();
  loadTopUsers();
}

async function loadUserTweets() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user._id) return;

  try {
    let url = `${API_URL}/api/tweets/user/${user._id}`;
    
    // Current user ID'yi parameter olarak ekle
    if (user._id) {
      url += `?currentUserId=${user._id}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
      displayUserTweets(data.tweets);
      updatePostCount(data.tweets.length);
    } else {
      console.error('Kullanıcı tweet\'leri yükleme hatası:', data.message);
    }
  } catch (error) {
    console.error('Kullanıcı tweet\'leri yükleme hatası:', error);
  }
}

function updatePostCount(count) {
  const postsCountElement = document.querySelector('.posts-count');
  if (postsCountElement) {
    postsCountElement.textContent = `${count} ${count === 1 ? 'post' : 'posts'}`;
  }
}

// Kullanıcının tweet'lerini profil sayfasında göster
function displayUserTweets(userTweets) {
  // Profil sayfasında tweet'leri gösterecek alan olup olmadığını kontrol et
  const tweetContainer = document.querySelector('.profile-tweets');
  if (!tweetContainer) {
    console.log('Profil tweet container bulunamadı');
    return;
  }

  // Mevcut tweet'leri temizle
  while (tweetContainer.firstChild) {
    tweetContainer.removeChild(tweetContainer.firstChild);
  }

  if (userTweets.length === 0) {
    // Boş durum göster
    const emptyState = document.createElement('div');
    emptyState.className = 'profile-tweets-empty';
    emptyState.style.cssText = 'text-align: center; padding: 40px 20px; color: #71767b;';
    emptyState.innerHTML = `
      <h3>You haven't posted anything yet</h3>
      <p>When you post, your posts will show up here.</p>
      <button class="post-button" onclick="openTweetModal()">Post your first Tweet</button>
    `;
    tweetContainer.appendChild(emptyState);
    return;
  }

  // Ana sayfadaki tweet template'ini kullanarak her tweet'i render et
  userTweets.forEach(tweet => {
    const tweetEl = tweetTemplate.content.cloneNode(true);
    
    // Tweet ID'sini data attribute olarak ekle
    const tweetContainer = tweetEl.querySelector('.tweet');
    if (tweetContainer) {
      tweetContainer.dataset.tweetId = tweet._id;
    }
    
    // Avatar
    const avatar = tweetEl.querySelector('.avatar');
    if (tweet.user.profileImage && tweet.user.profileImage.trim() !== '') {
      const avatarUrl = tweet.user.profileImage.startsWith('http') 
        ? tweet.user.profileImage 
        : `${API_URL}${tweet.user.profileImage}`;
      
      console.log('Avatar URL Debug:', {
        originalProfileImage: tweet.user.profileImage,
        startsWithHttp: tweet.user.profileImage.startsWith('http'),
        API_URL: API_URL,
        finalAvatarUrl: avatarUrl
      });
      
      avatar.src = avatarUrl;
    } else {
      avatar.src = 'images/logo.png';
    }
    avatar.alt = tweet.user.displayName || tweet.user.username;
    
    // İsim
    const nameSpan = tweetEl.querySelector('.name');
    nameSpan.textContent = tweet.user.displayName || tweet.user.username;
    
    // Kullanıcı adı ve tarih
    const usernameSpan = tweetEl.querySelector('.username');
    const formattedDate = formatTimestamp(tweet.created_at);
    usernameSpan.textContent = `@${tweet.user.username} · ${formattedDate}`;
    
    // Tweet içeriği
    const contentP = tweetEl.querySelector('.post-content p');
    contentP.textContent = tweet.content;
    
    // Tweet resmi
    const imageDiv = tweetEl.querySelector('.tweet-image');
    if (tweet.image && tweet.image.trim() !== '') {
      imageDiv.style.display = 'block';
      const imageImg = imageDiv.querySelector('img');
      
      // URL'i düzgün oluştur
      const imageUrl = tweet.image.startsWith('http') 
        ? tweet.image 
        : `${API_URL}${tweet.image}`;
      
      console.log('Tweet Image URL Debug:', {
        originalImage: tweet.image,
        startsWithHttp: tweet.image.startsWith('http'),
        API_URL: API_URL,
        finalImageUrl: imageUrl
      });
      
      imageImg.src = imageUrl;
      imageImg.alt = 'Tweet image';
    } else {
      imageDiv.style.display = 'none';
    }
    
    // Tweet videosu
    const videoDiv = tweetEl.querySelector('.tweet-video');
    if (tweet.video && tweet.video.trim() !== '') {
      videoDiv.style.display = 'block';
      const videoEl = videoDiv.querySelector('video');
      const videoSource = videoEl.querySelector('source');
      
      // URL'i düzgün oluştur
      const videoUrl = tweet.video.startsWith('http') 
        ? tweet.video 
        : `${API_URL}${tweet.video}`;
      
      videoSource.src = videoUrl;
      videoSource.type = getVideoMimeType(tweet.video);
      console.log('Tweet video URL:', videoUrl);
      videoEl.load(); // Video'yu yeniden yükle
    } else {
      videoDiv.style.display = 'none';
    }
    
    // İstatistikler
    const commentCount = tweetEl.querySelector('.comment-count');
    const retweetCount = tweetEl.querySelector('.retweet-count');
    const likeCount = tweetEl.querySelector('.like-count');
    const viewCount = tweetEl.querySelector('.view-count');
    
    if (commentCount) commentCount.textContent = String(tweet.comments || 0);
    if (retweetCount) retweetCount.textContent = String(tweet.retweets || 0);
    if (likeCount) likeCount.textContent = String(tweet.likes || 0);
    if (viewCount) viewCount.textContent = String(tweet.views || 0);
    
    // Event listener'ları ekle
    const commentAction = tweetEl.querySelector('.comment-action');
    const retweetAction = tweetEl.querySelector('.retweet-action');
    const likeAction = tweetEl.querySelector('.like-action');
    const heartIcon = likeAction.querySelector('i');
    
    // Liked durumuna göre kalp ikonunu ayarla
    if (tweet.isLiked) {
      likeAction.classList.add('liked');
      heartIcon.classList.remove('far');
      heartIcon.classList.add('fas'); // Dolu kalp
    } else {
      likeAction.classList.remove('liked');
      heartIcon.classList.remove('fas');
      heartIcon.classList.add('far'); // Boş kalp
    }
    
    if (commentAction) {
      commentAction.addEventListener('click', () => commentPost(tweet._id));
    }
    if (retweetAction) {
      retweetAction.addEventListener('click', () => retweetPost(tweet._id));
    }
    if (likeAction) {
      likeAction.addEventListener('click', () => likeTweet(tweet._id));
    }
    
    tweetContainer.appendChild(tweetEl);
  });
}

function loadUserProfile() {
  const user = JSON.parse(localStorage.getItem('user'));
  let userId;
  
  if (user && user._id) {
    userId = user._id;
    localStorage.setItem('currentUserId', userId);
    
    fetch(`${API_URL}/api/user/${userId}`) 
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          updateProfileDisplay(data.user);
          populateEditForm(data.user);
          updateSidebarProfile(data.user);
        } else {
          console.error('Kullanıcı verileri yüklenemedi:', data.message);
          showNotification('Kullanıcı bilgileri yüklenemedi', 'error');
          showDefaultProfile();
        }
      })
      .catch(error => {
        console.error('Profil yükleme hatası:', error);
        showNotification('Profil yüklenirken bir hata oluştu', 'error');
        showDefaultProfile();
      });
  } else {
    showDefaultProfile();
    showNotification('Oturum bilgisi bulunamadı', 'error');
  }
}

function populateEditForm(user) {
  console.log('populateEditForm çağrıldı:', user);
  
  const editName = document.getElementById('editName');
  const editBio = document.getElementById('editBio');
  const editLocation = document.getElementById('editLocation');
  const editWebsite = document.getElementById('editWebsite');
  const avatarPreview = document.getElementById('avatarPreview');
  const currentBanner = document.getElementById('currentBanner');
  
  if (editName) editName.value = user.displayName || user.username || '';
  if (editBio) editBio.value = user.bio || '';
  if (editLocation) editLocation.value = user.location || '';
  if (editWebsite) editWebsite.value = user.website || '';
  
  if (avatarPreview && user.profileImage) {
    const fullImageUrl = user.profileImage.startsWith('http') 
      ? user.profileImage 
      : `${API_URL}${user.profileImage}`;
    console.log('Avatar önizleme güncelleniyor:', fullImageUrl);
    avatarPreview.src = fullImageUrl;
  }
  
  if (currentBanner && user.bannerImage) {
    const fullBannerUrl = user.bannerImage.startsWith('http') 
      ? user.bannerImage 
      : `${API_URL}${user.bannerImage}`;
    console.log('Banner önizleme güncelleniyor:', fullBannerUrl);
    currentBanner.style.backgroundImage = `url(${fullBannerUrl})`;
    currentBanner.style.backgroundSize = 'cover';
    currentBanner.style.backgroundPosition = 'center';
  }
  updateCharacterCounters();
}
function updateCharacterCounters() {
  const inputs = [
    { input: 'editName', max: 50 },
    { input: 'editBio', max: 160 },
    { input: 'editLocation', max: 30 },
    { input: 'editWebsite', max: 100 }
  ];

  inputs.forEach((item, index) => {
    const input = document.getElementById(item.input);
    const counter = document.querySelectorAll('.char-counter')[index];
    
    if (input && counter) {
      const length = input.value.length;
      counter.textContent = `${length} / ${item.max}`;
      
      if (length > item.max * 0.9) {
        counter.style.color = '#f91880';
      } else if (length > item.max * 0.8) {
        counter.style.color = '#ffad1f';
      } else {
        counter.style.color = '#71767b';
      }
    }
  });
}

function setupProfileEventListeners() {
  const profileTabs = document.querySelectorAll(".profile-tab");
  profileTabs.forEach((tab, index) => {
    tab.addEventListener("click", function() {
      profileTabs.forEach(t => t.classList.remove("active"));
      this.classList.add("active");
      
      // Tab içeriğini yükle
      const tabText = this.textContent.trim();
      if (tabText === 'Likes') {
        loadLikedTweets();
      } else if (tabText === 'Posts') {
        loadUserPosts();
      } else {
        // Diğer tab'lar için varsayılan içerik
        showDefaultProfileContent(tabText);
      }
    });
  });

  const closeVerification = document.querySelector('.close-verification');
  if (closeVerification) {
    closeVerification.addEventListener('click', function() {
      document.querySelector('.verification-notice').style.display = 'none';
    });
  }
  const backButton = document.querySelector('.back-button');
  if (backButton) {
    backButton.addEventListener('click', showHomeContent);
  }
  const editProfileBtn = document.querySelector('.edit-profile-btn');
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', openEditProfileModal);
  }
}

function openEditProfileModal() {
  const modal = document.getElementById('editProfileModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  setupEditProfileModal();
}

function closeEditProfileModal() {
  const modal = document.getElementById('editProfileModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function setupEditProfileModal() {
  const closeBtn = document.getElementById('closeEditProfile');
  const saveBtn = document.getElementById('saveProfile');
  const editBannerBtn = document.getElementById('editBannerBtn');
  const editAvatarBtn = document.getElementById('editAvatarBtn');
  const bannerUpload = document.getElementById('bannerUpload');
  const avatarUpload = document.getElementById('avatarUpload');
  const modal = document.getElementById('editProfileModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeEditProfileModal);
  }
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeEditProfileModal();
    }
  });
  if (saveBtn) {
    saveBtn.addEventListener('click', saveProfile);
  }
  if (editBannerBtn && bannerUpload) {
    editBannerBtn.addEventListener('click', function() {
      bannerUpload.click();
    });

    bannerUpload.addEventListener('change', function(e) {
      handleImageUpload(e, 'banner');
    });
  }
  if (editAvatarBtn && avatarUpload) {
    editAvatarBtn.addEventListener('click', function() {
      avatarUpload.click();
    });

    avatarUpload.addEventListener('change', function(e) {
      handleImageUpload(e, 'avatar');
    });
  }
  setupCharacterCounters();
}

function handleImageUpload(event, type) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      if (type === 'banner') {
        const currentBanner = document.getElementById('currentBanner');
        currentBanner.style.backgroundImage = `url(${e.target.result})`;
        currentBanner.style.backgroundSize = 'cover';
        currentBanner.style.backgroundPosition = 'center';
      } else if (type === 'avatar') {
        const avatarPreview = document.getElementById('avatarPreview');
        avatarPreview.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  }
}

function setupCharacterCounters() {
  const inputs = [
    { input: 'editName', counter: 0, max: 50 },
    { input: 'editBio', counter: 1, max: 160 },
    { input: 'editLocation', counter: 2, max: 30 },
    { input: 'editWebsite', counter: 3, max: 100 }
  ];

  inputs.forEach((item, index) => {
    const input = document.getElementById(item.input);
    const counter = document.querySelectorAll('.char-counter')[index];
    
    if (input && counter) {
      input.addEventListener('input', function() {
        const length = this.value.length;
        counter.textContent = `${length} / ${item.max}`;
        
        if (length > item.max * 0.9) {
          counter.style.color = '#f91880';
        } else if (length > item.max * 0.8) {
          counter.style.color = '#ffad1f';
        } else {
          counter.style.color = '#71767b';
        }
      });
    }
  });
}

async function saveProfile() {
  const formData = new FormData();
  
  // Kullanıcı girişlerini güvenli hale getir
  const name = sanitizeInput(document.getElementById('editName').value);
  const bio = sanitizeInput(document.getElementById('editBio').value);
  const location = sanitizeInput(document.getElementById('editLocation').value);
  const websiteInput = document.getElementById('editWebsite').value.trim();
  
  // Website URL'ini kontrol et
  let website = '';
  if (websiteInput && isValidUrl(websiteInput)) {
    website = websiteInput;
  } else if (websiteInput) {
    showNotification('Geçersiz website URL\'si', 'error');
    return;
  }
  
  formData.append('displayName', name);
  formData.append('bio', bio);
  formData.append('location', location);
  formData.append('website', website);
  
  const avatarFile = document.getElementById('avatarUpload').files[0];
  const bannerFile = document.getElementById('bannerUpload').files[0];
  
  console.log('=== PROFILE SAVE DEBUG ===');
  console.log('Avatar file:', avatarFile);
  console.log('Banner file:', bannerFile);
  
  if (avatarFile) {
    console.log('Avatar file details:', {
      name: avatarFile.name,
      size: avatarFile.size,
      type: avatarFile.type
    });
    formData.append('profileImage', avatarFile);
  }
  
  if (bannerFile) {
    console.log('Banner file details:', {
      name: bannerFile.name,
      size: bannerFile.size,
      type: bannerFile.type
    });
    formData.append('bannerImage', bannerFile);
  }
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user._id || localStorage.getItem('currentUserId') || '507f1f77bcf86cd799439011';
  
  console.log('User ID:', userId);
  console.log('FormData entries:');
  for (let [key, value] of formData.entries()) {
    console.log(key, value);
  }
  
  try {
    const response = await fetch(`${API_URL}/api/user/${userId}`, { 
      method: 'PUT',
      body: formData
    });
    
    // Response'un JSON olup olmadığını kontrol et
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server HTML döndürdü, JSON beklenmiyordu. API routing sorunu olabilir.');
    }
    
    const data = await response.json();
    
    if (data.success) {
      updateProfileDisplay(data.user);
      populateEditForm(data.user);
      updateSidebarProfile(data.user);
      updateModalUserAvatar(); // Modal avatarını da güncelle
      localStorage.setItem('user', JSON.stringify(data.user));
      
      closeEditProfileModal();
      showNotification('Profil başarıyla güncellendi!');
    } else {
      showNotification('Hata: ' + data.message, 'error');
    }
  } catch (error) {
    console.error('Profil güncelleme hatası:', error);
    if (error.message.includes('HTML döndürdü')) {
      showNotification('Server hatası: API routes çalışmıyor. Vercel deployment kontrol edilmeli.', 'error');
    } else {
      showNotification('Profil güncellenirken bir hata oluştu.', 'error');
    }
  }
}

function updateProfileDisplay(user) {
  // Profil başlığındaki ismi güncelle
  const profileTitle = document.querySelector('.profile-display-name');
  if (profileTitle) {
    profileTitle.textContent = user.displayName || user.username;
  }
  
  // Ana profil ismi
  const profileNameSection = document.querySelector('.profile-full-name');
  if (profileNameSection) {
    profileNameSection.textContent = user.displayName || user.username;
  }
  
  // Kullanıcı adı (@username)
  const profileHandle = document.querySelector('.profile-handle');
  if (profileHandle && user.username) {
    profileHandle.textContent = `@${user.username}`;
  }
  
  // Katılma tarihi - eğer user.created_at varsa onu kullan
  const joinDateText = document.querySelector('.join-date-text');
  if (joinDateText && user.created_at) {
    const joinDate = new Date(user.created_at);
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const formattedDate = `Joined ${monthNames[joinDate.getMonth()]} ${joinDate.getFullYear()}`;
    joinDateText.textContent = formattedDate;
  } else if (joinDateText) {
    joinDateText.textContent = "Joined October 2024"; // Fallback
  }
  
  // Sidebar profil ismi
  const sidebarProfileName = document.querySelector('.profile-name');
  if (sidebarProfileName) {
    sidebarProfileName.textContent = user.displayName || user.username;
  }

  // Profil resmi güncelle veya varsayılan göster
  const profileAvatar = document.querySelector('.profile-avatar-large img');
  const sidebarAvatar = document.querySelector('.profile-avatar');
  
  if (user.profileImage && user.profileImage.trim() !== '') {
    const fullImageUrl = user.profileImage.startsWith('http') 
      ? user.profileImage 
      : `${API_URL}${user.profileImage}`;
      
    if (profileAvatar) {
      profileAvatar.src = fullImageUrl;
    }
    if (sidebarAvatar) {
      sidebarAvatar.src = fullImageUrl;
    }
  } else {
    // Varsayılan avatar göster
    const defaultAvatar = 'images/logo.png';
    if (profileAvatar) {
      profileAvatar.src = defaultAvatar;
    }
    if (sidebarAvatar) {
      sidebarAvatar.src = defaultAvatar;
    }
  }
  
  // Banner resmi güncelle veya temizle
  const bannerImage = document.querySelector('.banner-image');
  if (bannerImage) {
    if (user.bannerImage && user.bannerImage.trim() !== '') {
      const fullBannerUrl = user.bannerImage.startsWith('http') 
        ? user.bannerImage 
        : `${API_URL}${user.bannerImage}`;
      bannerImage.style.backgroundImage = `url(${fullBannerUrl})`;
      bannerImage.style.backgroundSize = 'cover';
      bannerImage.style.backgroundPosition = 'center';
    } else {
      // Banner boşsa temizle
      bannerImage.style.backgroundImage = '';
    }
  }
  // Bio alanını güncelle veya temizle
  let bioElement = document.querySelector('.profile-bio');
  if (user.bio && user.bio.trim() !== '') {
    if (!bioElement) {
      bioElement = document.createElement('div');
      bioElement.className = 'profile-bio';
      const profileMeta = document.querySelector('.profile-meta');
      profileMeta.insertBefore(bioElement, profileMeta.firstChild);
    }
    bioElement.textContent = user.bio;
    bioElement.style.marginBottom = '12px';
    bioElement.style.fontSize = '15px';
    bioElement.style.lineHeight = '1.3';
    bioElement.style.color = '#e7e9ea';
  } else if (bioElement) {
    // Bio boşsa elementi kaldır
    bioElement.remove();
  }
  
  // Location alanını güncelle veya temizle
  let locationElement = document.querySelector('.profile-location');
  if (user.location && user.location.trim() !== '') {
    if (!locationElement) {
      locationElement = document.createElement('div');
      locationElement.className = 'profile-location';
      const profileMeta = document.querySelector('.profile-meta');
      const joinDate = profileMeta.querySelector('.join-date');
      profileMeta.insertBefore(locationElement, joinDate);
    }
    
    // Güvenli şekilde location bilgisini ekle
    locationElement.innerHTML = ''; // Önce temizle
    const icon = document.createElement('i');
    icon.className = 'fas fa-map-marker-alt';
    const span = document.createElement('span');
    span.textContent = user.location; // textContent güvenli
    
    locationElement.appendChild(icon);
    locationElement.appendChild(document.createTextNode(' '));
    locationElement.appendChild(span);
    
    locationElement.style.marginBottom = '12px';
    locationElement.style.fontSize = '15px';
    locationElement.style.color = '#71767b';
  } else if (locationElement) {
    // Location boşsa elementi kaldır
    locationElement.remove();
  }
  
  // Website alanını güncelle veya temizle
  let websiteElement = document.querySelector('.profile-website');
  if (user.website && user.website.trim() !== '') {
    if (!websiteElement) {
      websiteElement = document.createElement('div');
      websiteElement.className = 'profile-website';
      const profileMeta = document.querySelector('.profile-meta');
      const joinDate = profileMeta.querySelector('.join-date');
      profileMeta.insertBefore(websiteElement, joinDate);
    }
    
    // Güvenli şekilde website bilgisini ekle
    websiteElement.innerHTML = ''; // Önce temizle
    const icon = document.createElement('i');
    icon.className = 'fas fa-link';
    const link = document.createElement('a');
    
    // URL'yi güvenli şekilde ayarla
    let websiteUrl = user.website.trim();
    if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = 'https://' + websiteUrl;
    }
    
    link.href = websiteUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = user.website; // textContent güvenli
    link.style.color = '#1d9bf0';
    link.style.textDecoration = 'none';
    
    websiteElement.appendChild(icon);
    websiteElement.appendChild(document.createTextNode(' '));
    websiteElement.appendChild(link);
    
    websiteElement.style.marginBottom = '12px';
    websiteElement.style.fontSize = '15px';
    websiteElement.style.color = '#71767b';
  } else if (websiteElement) {
    // Website boşsa elementi kaldır
    websiteElement.remove();
  }
  
  // Profil istatistiklerini güncelle
  const followingCount = document.querySelector('.profile-stats .stat:first-child .stat-number');
  const followersCount = document.querySelector('.profile-stats .stat:last-child .stat-number');
  
  if (followingCount && user.following) {
    followingCount.textContent = user.following.length || 0;
  } else if (followingCount) {
    followingCount.textContent = '0';
  }
  
  if (followersCount && user.followers) {
    followersCount.textContent = user.followers.length || 0;
  } else if (followersCount) {
    followersCount.textContent = '0';
  }
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.textContent = message;
  
  const backgroundColor = type === 'error' ? '#f91880' : '#1d9bf0';
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: ${backgroundColor};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    z-index: 10000;
    font-weight: 500;
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 4000);
}

function postTweet(fromModal = false) {
  const input = fromModal ? modalTweetInput : tweetInput;
  const text = input.value.trim();
  const imageFile = fromModal ? selectedModalImage : selectedImage;
  const videoFile = fromModal ? selectedModalVideo : selectedVideo;
  
  if (text === "" && !imageFile && !videoFile) {
    showNotification('Tweet içeriği, fotoğraf veya video ekleyin', 'error');
    return;
  }
  
  // Tweet içeriğini güvenli hale getir
  const sanitizedContent = text ? sanitizeInput(text) : "";
  if (text && sanitizedContent === "") {
    showNotification('Tweet içeriği geçersiz karakterler içeriyor', 'error');
    return;
  }
  
  const button = fromModal ? modalPostButton : postButton;
  if (button.disabled) return;

  // Kullanıcı bilgilerini localStorage'dan al
  const user = JSON.parse(localStorage.getItem('user'));
  console.log('localStorage user:', user);
  
  if (!user || !user._id) {
    showNotification('Lütfen giriş yapın', 'error');
    console.log('Kullanıcı bilgisi bulunamadı, login sayfasına yönlendiriliyor');
    window.location.href = 'loading.html?target=Login.html';
    return;
  }

  console.log('Tweet gönderiliyor - userId:', user._id, 'content:', sanitizedContent);

  // Tweet'i veritabanına kaydet
  saveTweetToDatabase(sanitizedContent, user._id, input, fromModal, imageFile, videoFile);
}

// Tweet'i veritabanına kaydetme fonksiyonu
async function saveTweetToDatabase(content, userId, input, fromModal, imageFile = null, videoFile = null) {
  try {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('userId', userId);
    
    console.log('Gönderilen veriler:', {
      content: content,
      userId: userId,
      imageFile: imageFile ? imageFile.name : 'yok',
      videoFile: videoFile ? videoFile.name : 'yok'
    });
    
    if (imageFile) {
      formData.append('image', imageFile);
    }
    
    if (videoFile) {
      formData.append('video', videoFile);
    }

    const response = await fetch(`${API_URL}/api/tweets`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    console.log('Server response:', data);

    if (data.success) {
      // Başarılı olursa tweet listesini yenile
      input.value = "";
      
      // Fotoğraf ve video önizlemelerini temizle
      if (fromModal) {
        removeModalImage();
        removeModalVideo();
      } else {
        removeImage();
        removeVideo();
      }
      
      await loadTweets(); // Ana sayfa tweet'lerini yeniden yükle
      
      // Eğer profil sayfasındaysak, profil tweet'lerini de yenile
      const profileContent = document.getElementById('profileContent');
      if (profileContent && profileContent.classList.contains('active')) {
        await loadUserTweets();
      }
      
      showNotification('Tweet başarıyla paylaşıldı!', 'success');
      
      if (fromModal) {
        closeTweetModal();
      }
    } else {
      showNotification('Tweet paylaşılırken hata oluştu: ' + data.message, 'error');
    }
  } catch (error) {
    console.error('Tweet kaydetme hatası:', error);
    showNotification('Tweet paylaşılırken hata oluştu', 'error');
  }
}

function setupTweetModal() {
  window.addEventListener("click", function(event) {
    if (event.target === tweetModal) {
      closeTweetModal();
    }
    // Yorum modal'ı için de ekle
    const commentModal = document.getElementById('commentModal');
    if (event.target === commentModal) {
      closeCommentModal();
    }
  });
  
  closeModalBtn.addEventListener("click", function() {
    closeTweetModal();
  });
 
  modalPostButton.addEventListener("click", function() {
    if (!modalPostButton.disabled) {
      postTweet(true);
    }
  });
  
  modalTweetInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.shiftKey && !modalPostButton.disabled) {
      event.preventDefault();
      postTweet(true);
    }
  });
  
  modalTweetInput.addEventListener("input", function() {
    updateModalButtonState();
  });
}

function openTweetModal() {
  tweetModal.classList.add("active");
  modalTweetInput.focus();
  document.body.style.overflow = "hidden";
  
  // Modal'daki profil fotoğrafını güncelle
  updateModalUserAvatar();
}

// Modal'daki kullanıcı avatarını güncelle
function updateModalUserAvatar() {
  const modalAvatar = document.querySelector('.tweet-modal-user .avatar');
  if (!modalAvatar) return;
  
  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user.profileImage && user.profileImage.trim() !== '') {
    const avatarUrl = user.profileImage.startsWith('http') 
      ? user.profileImage 
      : `${API_URL}${user.profileImage}`;
    modalAvatar.src = avatarUrl;
  } else {
    // Varsayılan avatar
    modalAvatar.src = 'images/logo.png';
  }
  
  modalAvatar.alt = user?.displayName || user?.username || 'User Avatar';
}

// Ana sayfa tweet box'ındaki avatarı güncelle
function closeTweetModal() {
  tweetModal.classList.remove("active");
  modalTweetInput.value = "";
  removeModalImage(); // Modal fotoğrafını temizle
  removeModalVideo(); // Modal videosunu temizle
  document.body.style.overflow = ""; 
  updateModalButtonState(); 
}
function setupButtonStates() {
  postButton.disabled = true;
  postButton.classList.add("disabled");
  
  tweetInput.addEventListener("input", function() {
    updateButtonState();
  });
  
  modalPostButton.disabled = true;
  modalPostButton.classList.add("disabled");
}

function updateButtonState() {
  if (tweetInput.value.trim() === "" && !selectedImage && !selectedVideo) {
    postButton.disabled = true;
    postButton.classList.add("disabled");
  } else {
    postButton.disabled = false;
    postButton.classList.remove("disabled");
  }
}

function updateModalButtonState() {
  if (modalTweetInput.value.trim() === "" && !selectedModalImage && !selectedModalVideo) {
    modalPostButton.disabled = true;
    modalPostButton.classList.add("disabled");
  } else {
    modalPostButton.disabled = false;
    modalPostButton.classList.remove("disabled");
  }
}

async function likeTweet(id) {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user._id) {
    showNotification('Lütfen giriş yapın', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/tweets/${id}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId: user._id })
    });

    const data = await response.json();

    if (data.success) {
      // Local tweet listesindeki like sayısını ve liked durumunu güncelle
      const tweet = tweets.find(t => t.id === id);
      if (tweet) {
        tweet.likes = data.likes;
        tweet.isLiked = data.liked; // Liked durumunu güncelle
        
        // UI'ı güncelle
        const tweetElement = document.querySelector(`[data-tweet-id="${id}"]`);
        if (tweetElement) {
          const likeAction = tweetElement.querySelector('.like-action');
          const heartIcon = likeAction.querySelector('i');
          const likeCount = tweetElement.querySelector('.like-count');
          
          // Like sayısını güncelle
          likeCount.textContent = String(data.likes);
          
          // Kalp ikonunu güncelle
          if (data.liked) {
            likeAction.classList.add('liked');
            heartIcon.classList.remove('far');
            heartIcon.classList.add('fas'); // Dolu kalp
          } else {
            likeAction.classList.remove('liked');
            heartIcon.classList.remove('fas');
            heartIcon.classList.add('far'); // Boş kalp
          }
        }
      }
    } else {
      showNotification('Beğeni işlemi başarısız', 'error');
    }
  } catch (error) {
    console.error('Like hatası:', error);
    showNotification('Beğeni işlemi başarısız', 'error');
  }
}

function retweetPost(id) {
  const tweet = tweets.find(t => t.id === id);
  if (tweet) {
    tweet.retweets++;
    renderTweets();
  }
}
function commentPost(id) {
  openCommentModal(id);
}

function renderTweets() {
  // Mevcut tweetleri temizle
  while (tweetList.firstChild) {
    tweetList.removeChild(tweetList.firstChild);
  }

  tweets.forEach(tweet => {
    const tweetEl = tweetTemplate.content.cloneNode(true);
    
    // Tweet ID'sini data attribute olarak ekle
    const tweetContainer = tweetEl.querySelector('.tweet');
    if (tweetContainer) {
      tweetContainer.dataset.tweetId = tweet.id;
    }
    
    const avatar = tweetEl.querySelector('.avatar');
    // Avatar URL'ini düzgün ayarla
    if (tweet.avatar && tweet.avatar.trim() !== '') {
      const avatarUrl = tweet.avatar.startsWith('http') 
        ? tweet.avatar 
        : `${API_URL}${tweet.avatar}`;
      avatar.src = avatarUrl;
    } else {
      // Varsayılan avatar
      avatar.src = 'images/logo.png';
    }
    avatar.alt = tweet.displayName || '';
    
    const nameSpan = tweetEl.querySelector('.name');
    nameSpan.textContent = tweet.displayName || '';
    
    // Verified badge'i güvenli şekilde ekle
    if (tweet.verified) {
      const verifiedIcon = document.createElement('i');
      verifiedIcon.className = 'fas fa-check-circle';
      verifiedIcon.style.marginLeft = '4px';
      verifiedIcon.style.color = '#1d9bf0';
      nameSpan.appendChild(verifiedIcon);
    }
    
    const usernameSpan = tweetEl.querySelector('.username');
    usernameSpan.textContent = `@${tweet.username || ''} · ${tweet.timestamp || ''}`;
    
    // Tweet more dropdown sadece kullanıcının kendi tweetlerinde görünsün
    const tweetMore = tweetEl.querySelector('.tweet-more');
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user._id === tweet.userId) {
      tweetMore.style.display = 'block';
    } else {
      tweetMore.style.display = 'none';
    }
    
    const contentP = tweetEl.querySelector('.post-content p');
    contentP.textContent = tweet.content || '';
    
    // Tweet resmi
    const imageDiv = tweetEl.querySelector('.tweet-image');
    if (tweet.image && tweet.image.trim() !== '') {
      imageDiv.style.display = 'block';
      const imageImg = imageDiv.querySelector('img');
      
      // URL'i düzgün oluştur
      const imageUrl = tweet.image.startsWith('http') 
        ? tweet.image 
        : `${API_URL}${tweet.image}`;
      
      imageImg.src = imageUrl;
      imageImg.alt = 'Tweet image';
      console.log('renderTweets - Tweet image URL:', imageUrl);
    } else {
      imageDiv.style.display = 'none';
    }
    
    // Tweet videosu
    const videoDiv = tweetEl.querySelector('.tweet-video');
    console.log('renderTweets - Video kontrolü - tweet.video:', tweet.video);
    if (tweet.video && tweet.video.trim() !== '' && tweet.video !== 'undefined' && !tweet.video.includes('undefined')) {
      console.log('renderTweets - Video bulundu, gösteriliyor:', tweet.video);
      videoDiv.style.display = 'block';
      const videoEl = videoDiv.querySelector('video');
      const videoSource = videoEl.querySelector('source');
      
      // URL'i düzgün oluştur
      const videoUrl = tweet.video.startsWith('http') 
        ? tweet.video 
        : `${API_URL}${tweet.video}`;
      
      videoSource.src = videoUrl;
      console.log('renderTweets - Video URL:', videoUrl);
      videoSource.type = getVideoMimeType(tweet.video);
      console.log('renderTweets - Video MIME type:', getVideoMimeType(tweet.video));
      videoEl.load(); // Video'yu yeniden yükle
    } else {
      console.log('renderTweets - Video bulunamadı, gizleniyor');
      videoDiv.style.display = 'none';
    }
    
    // Güvenli şekilde sayıları ata
    const commentCount = tweetEl.querySelector('.comment-count');
    const retweetCount = tweetEl.querySelector('.retweet-count');
    const likeCount = tweetEl.querySelector('.like-count');
    const viewCount = tweetEl.querySelector('.view-count');
    
    if (commentCount) commentCount.textContent = String(tweet.comments || 0);
    if (retweetCount) retweetCount.textContent = String(tweet.retweets || 0);
    if (likeCount) likeCount.textContent = String(tweet.likes || 0);
    if (viewCount) viewCount.textContent = String(tweet.views || 0);
    
    // Like action'ını ayarla
    const likeAction = tweetEl.querySelector('.like-action');
    const heartIcon = likeAction.querySelector('i');
    
    // Liked durumuna göre kalp ikonunu ayarla
    if (tweet.isLiked) {
      likeAction.classList.add('liked');
      heartIcon.classList.remove('far');
      heartIcon.classList.add('fas'); // Dolu kalp
    } else {
      likeAction.classList.remove('liked');
      heartIcon.classList.remove('fas');
      heartIcon.classList.add('far'); // Boş kalp
    }
    
    tweetEl.querySelector('.comment-action').addEventListener('click', () => commentPost(tweet.id));
    tweetEl.querySelector('.retweet-action').addEventListener('click', () => retweetPost(tweet.id));
    likeAction.addEventListener('click', () => likeTweet(tweet.id));
    
    tweetList.appendChild(tweetEl);
  });
}

// Video MIME tipini dosya uzantısından belirle
function getVideoMimeType(filename) {
  const extension = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'video/ogg',
    'avi': 'video/avi',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'mkv': 'video/x-matroska'
  };
  return mimeTypes[extension] || 'video/mp4';
}


function loadSidebarUserInfo() {
  const user = JSON.parse(localStorage.getItem('user'));
  let userId;
  
  if (user && user._id) {
    userId = user._id;
    localStorage.setItem('currentUserId', userId);
    
    fetch(`${API_URL}/api/user/${userId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          updateSidebarProfile(data.user);
          updateModalUserAvatar(); // Modal avatarını da güncelle
          localStorage.setItem('user', JSON.stringify(data.user));
        } else {
          console.error('Sidebar kullanıcı verileri yüklenemedi:', data.message);
          showDefaultProfile();
        }
      })
      .catch(error => {
        console.error('Sidebar profil yükleme hatası:', error);
        showDefaultProfile();
      });
  } else {
    // Kullanıcı bilgisi yoksa varsayılan profili göster
    showDefaultProfile();
  }
}

function showDefaultProfile() {
  const profileName = document.querySelector('.profile-name');
  const profileUsername = document.querySelector('.profile-username');
  const sidebarAvatar = document.querySelector('.profile-avatar');
  const mobileProfileAvatar = document.querySelector('.mobile-profile-avatar');
  const mobileMenuAvatar = document.getElementById('mobileProfileAvatar');
  
  if (profileName) profileName.textContent = 'Kullanıcı';
  if (profileUsername) profileUsername.textContent = '@kullanici';
  
  const defaultAvatar = 'images/logo.png';
  const defaultMobileAvatar = 'images/logo.png';
  
  if (sidebarAvatar) sidebarAvatar.src = defaultAvatar;
  if (mobileProfileAvatar) mobileProfileAvatar.src = defaultMobileAvatar;
  if (mobileMenuAvatar) mobileMenuAvatar.src = defaultAvatar;
}
function updateSidebarProfile(user) {
  const sidebarAvatar = document.querySelector('.profile-avatar');
  const mobileProfileAvatar = document.querySelector('.mobile-profile-avatar');
  const mobileMenuAvatar = document.getElementById('mobileProfileAvatar');
  
  if (sidebarAvatar) {
    if (user.profileImage) {
      const fullImageUrl = user.profileImage.startsWith('http') 
        ? user.profileImage 
        : `${API_URL}${user.profileImage}`;
      sidebarAvatar.src = fullImageUrl;
    } else {
      // Varsayılan avatar göster
      sidebarAvatar.src = 'images/logo.png';
    }
  }
  
  if (mobileProfileAvatar) {
    if (user.profileImage) {
      const fullImageUrl = user.profileImage.startsWith('http') 
        ? user.profileImage 
        : `${API_URL}${user.profileImage}`;
      mobileProfileAvatar.src = fullImageUrl;
    } else {
      mobileProfileAvatar.src = 'images/logo.png';
    }
  }
  
  if (mobileMenuAvatar) {
    if (user.profileImage) {
      const fullImageUrl = user.profileImage.startsWith('http') 
        ? user.profileImage 
        : `${API_URL}${user.profileImage}`;
      mobileMenuAvatar.src = fullImageUrl;
    } else {
      mobileMenuAvatar.src = 'images/logo.png';
    }
  }
  
  const profileName = document.querySelector('.profile-name');
  if (profileName) {
    profileName.textContent = user.displayName || user.username;
  }
  const profileUsername = document.querySelector('.profile-username');
  if (profileUsername) {
    profileUsername.textContent = `@${user.username}`;
  }
}

// Fotoğraf ve video seçme ve önizleme fonksiyonları
let selectedImage = null;
let selectedModalImage = null;
let selectedCommentImage = null;
let selectedVideo = null;
let selectedModalVideo = null;
let currentTweetForComment = null;

function selectImage() {
  if (selectedVideo) {
    removeVideo();
  }
  document.getElementById('tweetImageInput').click();
}

function selectVideo() {
  if (selectedImage) {
    removeImage();
  }
  document.getElementById('tweetVideoInput').click();
}

function selectModalImage() {
  if (selectedModalVideo) {
    removeModalVideo();
  }
  document.getElementById('modalImageInput').click();
}

function selectModalVideo() {
  if (selectedModalImage) {
    removeModalImage();
  }
  document.getElementById('modalVideoInput').click();
}

function removeImage() {
  const imagePreview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  const fileInput = document.getElementById('tweetImageInput');
  
  imagePreview.style.display = 'none';
  previewImg.src = '';
  fileInput.value = '';
  selectedImage = null;
  updateButtonState();
}

function removeVideo() {
  const videoPreview = document.getElementById('videoPreview');
  const previewVideo = document.getElementById('previewVideo');
  const videoSource = document.getElementById('videoSource');
  const fileInput = document.getElementById('tweetVideoInput');
  
  videoPreview.style.display = 'none';
  previewVideo.src = '';
  videoSource.src = '';
  fileInput.value = '';
  selectedVideo = null;
  updateButtonState();
}

function removeModalImage() {
  const modalImagePreview = document.getElementById('modalImagePreview');
  const modalPreviewImg = document.getElementById('modalPreviewImg');
  const modalFileInput = document.getElementById('modalImageInput');
  
  modalImagePreview.style.display = 'none';
  modalPreviewImg.src = '';
  modalFileInput.value = '';
  selectedModalImage = null;
  updateModalButtonState();
}

function removeModalVideo() {
  const modalVideoPreview = document.getElementById('modalVideoPreview');
  const modalPreviewVideo = document.getElementById('modalPreviewVideo');
  const modalVideoSource = document.getElementById('modalVideoSource');
  const modalFileInput = document.getElementById('modalVideoInput');
  
  modalVideoPreview.style.display = 'none';
  modalPreviewVideo.src = '';
  modalVideoSource.src = '';
  modalFileInput.value = '';
  selectedModalVideo = null;
  updateModalButtonState();
}

// File input event listeners'ını ekle
document.addEventListener('DOMContentLoaded', function() {
  const tweetImageInput = document.getElementById('tweetImageInput');
  const tweetVideoInput = document.getElementById('tweetVideoInput');
  const modalImageInput = document.getElementById('modalImageInput');
  const modalVideoInput = document.getElementById('modalVideoInput');
  
  if (tweetImageInput) {
    tweetImageInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        selectedImage = file;
        const reader = new FileReader();
        reader.onload = function(e) {
          const previewImg = document.getElementById('previewImg');
          const imagePreview = document.getElementById('imagePreview');
          previewImg.src = e.target.result;
          imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        
        // Buton durumunu güncelle
        updateButtonState();
      }
    });
  }
  
  if (tweetVideoInput) {
    tweetVideoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        selectedVideo = file;
        const reader = new FileReader();
        reader.onload = function(e) {
          const previewVideo = document.getElementById('previewVideo');
          const videoSource = document.getElementById('videoSource');
          const videoPreview = document.getElementById('videoPreview');
          
          videoSource.src = e.target.result;
          videoSource.type = file.type;
          previewVideo.load(); // Video'yu yeniden yükle
          videoPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        updateButtonState();
      }
    });
  }
  
  if (modalImageInput) {
    modalImageInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        selectedModalImage = file;
        const reader = new FileReader();
        reader.onload = function(e) {
          const modalPreviewImg = document.getElementById('modalPreviewImg');
          const modalImagePreview = document.getElementById('modalImagePreview');
          modalPreviewImg.src = e.target.result;
          modalImagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        updateModalButtonState();
      }
    });
  }
  
  if (modalVideoInput) {
    modalVideoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        selectedModalVideo = file;
        const reader = new FileReader();
        reader.onload = function(e) {
          const modalPreviewVideo = document.getElementById('modalPreviewVideo');
          const modalVideoSource = document.getElementById('modalVideoSource');
          const modalVideoPreview = document.getElementById('modalVideoPreview');
          
          modalVideoSource.src = e.target.result;
          modalVideoSource.type = file.type;
          modalPreviewVideo.load(); // Video'yu yeniden yükle
          modalVideoPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        updateModalButtonState();
      }
    });
  }
  
  // Yorum image input event listener
  const commentImageInput = document.getElementById('commentImageInput');
  if (commentImageInput) {
    commentImageInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        selectedCommentImage = file;
        const reader = new FileReader();
        reader.onload = function(e) {
          const commentPreviewImg = document.getElementById('commentPreviewImg');
          const commentImagePreview = document.getElementById('commentImagePreview');
          commentPreviewImg.src = e.target.result;
          commentImagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }
});

// Yorum modal fonksiyonları
async function openCommentModal(tweetId) {
  currentTweetForComment = tweetId;
  
  // Yerel tweets array'inden tweet'i bul
  const tweet = tweets.find(t => t.id === tweetId);
  if (!tweet) {
    showNotification('Tweet bulunamadı', 'error');
    return;
  }
  
  const commentModal = document.getElementById('commentModal');
  
  // Orijinal tweet bilgilerini doldur
  const originalAvatar = document.querySelector('.original-tweet-avatar');
  const originalName = document.querySelector('.original-tweet-name');
  const originalUsername = document.querySelector('.original-tweet-username');
  const originalText = document.querySelector('.original-tweet-text');
  const originalImage = document.querySelector('.original-tweet-image');
  const replyUsername = document.querySelector('.reply-username');
  
  // Avatar
  if (tweet.avatar && tweet.avatar.trim() !== '') {
    const avatarUrl = tweet.avatar.startsWith('http') 
      ? tweet.avatar 
      : `${API_URL}${tweet.avatar}`;
    originalAvatar.src = avatarUrl;
  } else {
    originalAvatar.src = 'images/logo.png';
  }
  
  originalName.textContent = tweet.displayName || tweet.username;
  originalUsername.textContent = `@${tweet.username} · ${tweet.timestamp}`;
  originalText.textContent = tweet.content;
  replyUsername.textContent = `@${tweet.username}`;
  
  // Tweet resmi varsa göster
  if (tweet.image && tweet.image.trim() !== '') {
    originalImage.style.display = 'block';
    const imageUrl = tweet.image.startsWith('http') 
      ? tweet.image 
      : `${API_URL}${tweet.image}`;
    originalImage.querySelector('img').src = imageUrl;
  } else {
    originalImage.style.display = 'none';
  }
  
  // Yorum yazacak kullanıcının avatarını ayarla
  const user = JSON.parse(localStorage.getItem('user'));
  const commentAvatar = document.querySelector('.comment-avatar');
  if (user && user.profileImage && user.profileImage.trim() !== '') {
    const avatarUrl = user.profileImage.startsWith('http') 
      ? user.profileImage 
      : `${API_URL}${user.profileImage}`;
    commentAvatar.src = avatarUrl;
  } else {
    commentAvatar.src = 'images/logo.png';
  }
  
  commentModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Yorumları yükle - server'daki _id formatını kullan
  loadComments(tweetId);
}

function closeCommentModal() {
  const commentModal = document.getElementById('commentModal');
  const commentInput = document.getElementById('commentInput');
  
  commentModal.classList.remove('active');
  commentInput.value = '';
  removeCommentImage();
  currentTweetForComment = null;
  document.body.style.overflow = '';
}

function selectCommentImage() {
  document.getElementById('commentImageInput').click();
}

function removeCommentImage() {
  const commentImagePreview = document.getElementById('commentImagePreview');
  const commentPreviewImg = document.getElementById('commentPreviewImg');
  const commentFileInput = document.getElementById('commentImageInput');
  
  commentImagePreview.style.display = 'none';
  commentPreviewImg.src = '';
  commentFileInput.value = '';
  selectedCommentImage = null;
}

async function postComment() {
  const commentInput = document.getElementById('commentInput');
  const text = commentInput.value.trim();
  
  if (text === '' && !selectedCommentImage) {
    showNotification('Yorum içeriği veya fotoğraf ekleyin', 'error');
    return;
  }
  
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user._id) {
    showNotification('Lütfen giriş yapın', 'error');
    return;
  }
  
  try {
    const formData = new FormData();
    formData.append('content', text);
    formData.append('userId', user._id);
    formData.append('tweetId', currentTweetForComment);
    
    if (selectedCommentImage) {
      formData.append('image', selectedCommentImage);
    }
    
    const response = await fetch(`${API_URL}/api/comments`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Yorum sayısını artır
      const tweet = tweets.find(t => t.id === currentTweetForComment);
      if (tweet) {
        tweet.comments += 1;
      }
      
      // Ekranı güncelle
      renderTweets();
      if (document.querySelector('.profile-tweets')) {
        loadUserTweets();
      }
      
      showNotification('Yorum başarıyla eklendi!', 'success');
      
      // Yorum inputunu temizle
      commentInput.value = '';
      removeCommentImage();
      
      // Yorumları yeniden yükle
      loadComments(currentTweetForComment);
    } else {
      showNotification('Yorum eklenirken hata oluştu: ' + data.message, 'error');
    }
  } catch (error) {
    console.error('Yorum ekleme hatası:', error);
    showNotification('Yorum eklenirken hata oluştu', 'error');
  }
}

// Yorumları yükleme fonksiyonu
async function loadComments(tweetId) {
  const commentsLoading = document.getElementById('commentsLoading');
  const commentsEmpty = document.getElementById('commentsEmpty');
  const commentsList = document.getElementById('commentsList');
  
  // Loading göster
  commentsLoading.style.display = 'block';
  commentsEmpty.style.display = 'none';
  commentsList.innerHTML = '';
  
  try {
    // tweetId zaten server'daki _id formatında (loadTweets'de id = tweet._id atanıyor)
    const response = await fetch(`${API_URL}/api/comments/${tweetId}`);
    const data = await response.json();
    
    commentsLoading.style.display = 'none';
    
    if (data.success) {
      if (data.comments.length === 0) {
        commentsEmpty.style.display = 'block';
      } else {
        displayComments(data.comments);
      }
    } else {
      showNotification('Yorumlar yüklenirken hata oluştu', 'error');
    }
  } catch (error) {
    console.error('Yorumları yükleme hatası:', error);
    commentsLoading.style.display = 'none';
    showNotification('Yorumlar yüklenirken hata oluştu', 'error');
  }
}

// Yorumları görüntüleme fonksiyonu
function displayComments(comments) {
  const commentsList = document.getElementById('commentsList');
  const currentUser = JSON.parse(localStorage.getItem('user'));
  
  comments.forEach(comment => {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment-item';
    commentEl.setAttribute('data-comment-id', comment._id);
    commentEl.dataset.commentId = comment._id;
    
    // Avatar
    let avatarSrc = 'images/logo.png';
    if (comment.user.profileImage && comment.user.profileImage.trim() !== '') {
      avatarSrc = comment.user.profileImage.startsWith('http') 
        ? comment.user.profileImage 
        : `${API_URL}${comment.user.profileImage}`;
    }
    
    // Silme butonu (sadece yorum sahibi görebilir)
    let deleteBtn = '';
    if (currentUser && currentUser._id === comment.user._id) {
      deleteBtn = `<div class="comment-delete-btn" onclick="deleteComment('${comment._id}')"><i class="fas fa-trash"></i></div>`;
    }
    
    // Kullanıcının bu yorumu beğenip beğenmediğini kontrol et
    let isLiked = false;
    let likeIconClass = 'far fa-heart';
    let likeColor = '';
    
    if (currentUser && comment.likedBy && comment.likedBy.includes(currentUser._id)) {
      isLiked = true;
      likeIconClass = 'fas fa-heart';
      likeColor = 'color: #e91e63;';
    }
    
    // Cevap sayısı gösterimi
    const replyCount = comment.replies || 0;  
    const replyText = replyCount > 0 ? `${replyCount} Cevap` : '';

commentEl.innerHTML = `
  <div class="comment-content">
    <div class="comment-header">
      <img src="${avatarSrc}" alt="Avatar" class="comment-avatar">
      <div class="comment-user-info">
        <span class="comment-display-name">${comment.user.displayName || comment.user.username}</span>
        <span class="comment-username">@${comment.user.username}</span>
        <span class="comment-time">${formatTimestamp(comment.created_at)}</span>
      </div>
      ${deleteBtn}
    </div>
    <div class="comment-text">${comment.content}</div>
    ${comment.image ? `<img src="${API_URL}${comment.image}" alt="Comment image" class="comment-image">` : ''}
    <div class="comment-actions">
      <div class="comment-action like-action" onclick="likeComment('${comment._id}')">
        <i class="${likeIconClass}" style="${likeColor}"></i>
        <span class="like-count">${comment.likes || 0}</span>
      </div>
      <div class="comment-action reply-action" onclick="replyToComment('${comment._id}', this.closest('.comment-item'))">
        <i class="far fa-comment"></i>
        <span>Cevapla</span>
      </div>
      <div class="comment-action replies-toggle" onclick="toggleReplies('${comment._id}', this)" style="${replyCount > 0 ? 'display: flex;' : 'display: none;'}">
        <i class="fas fa-reply"></i>
        <span class="reply-count">${replyCount}</span>
        <span>Cevapları Göster</span>
      </div>
    </div>
  </div>
`;
    
    commentsList.appendChild(commentEl);
  });
}

// Yorum silme fonksiyonu
async function deleteComment(commentId) {
  if (!confirm('Bu yorumu silmek istediğinizden emin misiniz?')) {
    return;
  }
  
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user._id) {
    showNotification('Lütfen giriş yapın', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId: user._id })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Yorum sayısını azalt
      const tweet = tweets.find(t => t.id === currentTweetForComment);
      if (tweet) {
        tweet.comments -= 1;
      }
      
      // Ekranı güncelle
      renderTweets();
      loadComments(currentTweetForComment); // Yorumları yeniden yükle
      
      showNotification('Yorum silindi', 'success');
    } else {
      showNotification('Yorum silinirken hata oluştu: ' + data.message, 'error');
    }
  } catch (error) {
    console.error('Yorum silme hatası:', error);
    showNotification('Yorum silinirken hata oluştu', 'error');
  }
}

// Kullanıcının beğendiği tweetleri yükle
async function loadLikedTweets() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user._id) {
      showNotification('Lütfen giriş yapın', 'error');
      return;
    }

    const response = await fetch(`${API_URL}/api/user/${user._id}/liked-tweets`);
    const data = await response.json();
    
    if (data.success) {
      const profileContent = document.querySelector('.profile-content');
      
      if (data.tweets.length === 0) {
        profileContent.innerHTML = `
          <div class="no-posts">
            <div class="no-posts-content">
              <h2>Henüz hiçbir gönderiyi beğenmediniz</h2>
              <p>Beğendiğiniz gönderiler burada görünecek.</p>
            </div>
          </div>
        `;
      } else {
        // Beğenilen tweetleri göster
        const likedTweetsHtml = data.tweets.map(tweet => {
          const formattedTweet = {
            id: tweet._id,
            userId: tweet.user._id,
            username: tweet.user.username,
            displayName: tweet.user.displayName || tweet.user.username,
            verified: false,
            avatar: tweet.user.profileImage || '',
            content: tweet.content,
            image: tweet.image || '',
            video: tweet.video || '',
            timestamp: formatTimestamp(tweet.created_at),
            likes: tweet.likes,
            comments: tweet.comments,
            retweets: tweet.retweets,
            views: tweet.views
          };
          
          return createTweetElement(formattedTweet);
        }).join('');
        
        profileContent.innerHTML = likedTweetsHtml;
        
        // Event listener'ları yeniden ekle
        setupTweetEventListeners();
      }
    } else {
      showNotification('Beğenilen gönderiler yüklenirken hata oluştu', 'error');
    }
  } catch (error) {
    console.error('Beğenilen tweetleri yükleme hatası:', error);
    showNotification('Beğenilen gönderiler yüklenirken hata oluştu', 'error');
  }
}

// Kullanıcının kendi postlarını yükle
async function loadUserPosts() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user._id) {
      showNotification('Lütfen giriş yapın', 'error');
      return;
    }

    const response = await fetch(`${API_URL}/api/user/${user._id}/tweets`);
    const data = await response.json();
    
    if (data.success) {
      const profileContent = document.querySelector('.profile-content');
      
      if (data.tweets.length === 0) {
        profileContent.innerHTML = `
          <div class="no-posts">
            <div class="no-posts-content">
              <h2>Henüz hiçbir şey paylaşmadınız</h2>
              <p>Paylaştığınız gönderiler burada görünecek.</p>
            </div>
          </div>
        `;
      } else {
        // Kullanıcının tweetlerini göster
        const userTweetsHtml = data.tweets.map(tweet => {
          const formattedTweet = {
            id: tweet._id,
            userId: tweet.user._id,
            username: tweet.user.username,
            displayName: tweet.user.displayName || tweet.user.username,
            verified: false,
            avatar: tweet.user.profileImage || '',
            content: tweet.content,
            image: tweet.image || '',
            video: tweet.video || '',
            timestamp: formatTimestamp(tweet.created_at),
            likes: tweet.likes,
            comments: tweet.comments,
            retweets: tweet.retweets,
            views: tweet.views
          };
          
          return createTweetElement(formattedTweet);
        }).join('');
        
        profileContent.innerHTML = userTweetsHtml;
        
        // Event listener'ları yeniden ekle
        setupTweetEventListeners();
      }
    } else {
      showNotification('Gönderiler yüklenirken hata oluştu', 'error');
    }
  } catch (error) {
    console.error('Kullanıcı tweetlerini yükleme hatası:', error);
    showNotification('Gönderiler yüklenirken hata oluştu', 'error');
  }
}

// Diğer tab'lar için varsayılan içerik
function showDefaultProfileContent(tabName) {
  const profileContent = document.querySelector('.profile-content');
  profileContent.innerHTML = `
    <div class="no-posts">
      <div class="no-posts-content">
        <h2>${tabName} bölümü</h2>
        <p>Bu bölüm henüz geliştirilme aşamasında.</p>
      </div>
    </div>
  `;
}

// Tweet element'lerindeki event listener'ları yeniden kur
function setupTweetEventListeners() {
  // Like butonları için event listener'lar
  document.querySelectorAll('.like-action').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const tweetElement = e.target.closest('.tweet');
      const tweetId = tweetElement.dataset.tweetId;
      if (tweetId) {
        likeTweet(tweetId);
      }
    });
  });
  
  document.querySelectorAll('.comment-action').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const tweetElement = e.target.closest('.tweet');
      const tweetId = tweetElement.dataset.tweetId;
      if (tweetId) {
        openCommentModal(tweetId);
      }
    });
  });

  document.querySelectorAll('.retweet-action').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      // Retweet fonksiyonalitesi burada eklenebilir
    });
  });
}

// Tek bir tweet element'i oluştur
function createTweetElement(tweet) {
  if (!tweetTemplate) {
    console.error('Tweet template bulunamadı');
    return '';
  }
  
  const tweetEl = tweetTemplate.content.cloneNode(true);
  
  // Tweet ID'sini data attribute olarak ekle
  const tweetContainer = tweetEl.querySelector('.tweet') || tweetEl.firstElementChild;
  if (tweetContainer) {
    tweetContainer.dataset.tweetId = tweet.id;
  }
  
  const avatar = tweetEl.querySelector('.avatar');
  // Avatar URL'ini düzgün ayarla
  if (tweet.avatar && tweet.avatar.trim() !== '') {
    const avatarUrl = tweet.avatar.startsWith('http') 
      ? tweet.avatar 
      : `${API_URL}${tweet.avatar}`;
    avatar.src = avatarUrl;
  } else {
    // Varsayılan avatar
    avatar.src = 'images/logo.png';
  }
  avatar.alt = tweet.displayName || '';
  
  const nameSpan = tweetEl.querySelector('.name');
  nameSpan.textContent = tweet.displayName || '';
  
  // Verified badge'i güvenli şekilde ekle
  if (tweet.verified) {
    const verifiedIcon = document.createElement('i');
    verifiedIcon.className = 'fas fa-check-circle';
    verifiedIcon.style.marginLeft = '4px';
    verifiedIcon.style.color = '#1d9bf0';
    nameSpan.appendChild(verifiedIcon);
  }
  
  const usernameSpan = tweetEl.querySelector('.username');
  usernameSpan.textContent = `@${tweet.username || ''} · ${tweet.timestamp || ''}`;
  
  // Tweet more dropdown sadece kullanıcının kendi tweetlerinde görünsün
  const tweetMore = tweetEl.querySelector('.tweet-more');
  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user._id === tweet.userId) {
    tweetMore.style.display = 'block';
  } else {
    tweetMore.style.display = 'none';
  }
  
  const contentP = tweetEl.querySelector('.post-content p');
  contentP.textContent = tweet.content || '';
  
  // Tweet resmi
  const imageDiv = tweetEl.querySelector('.tweet-image');
  if (tweet.image && tweet.image.trim() !== '') {
    imageDiv.style.display = 'block';
    const imageImg = imageDiv.querySelector('img');
    imageImg.src = tweet.image; // Data URL olarak geldiği için doğrudan kullan
    imageImg.alt = 'Tweet image';
  } else {
    imageDiv.style.display = 'none';
  }
  
  // Tweet videosu
  const videoDiv = tweetEl.querySelector('.tweet-video');
  if (tweet.video && tweet.video.trim() !== '') {
    videoDiv.style.display = 'block';
    const videoEl = videoDiv.querySelector('video');
    const videoSource = videoEl.querySelector('source');
    videoSource.src = tweet.video; // Data URL olarak geldiği için doğrudan kullan
    videoSource.type = getVideoMimeType(tweet.video);
    videoEl.load(); // Video'yu yeniden yükle
  } else {
    videoDiv.style.display = 'none';
  }
  
  // Güvenli şekilde sayıları ata
  const commentCount = tweetEl.querySelector('.comment-count');
  const retweetCount = tweetEl.querySelector('.retweet-count');
  const likeCount = tweetEl.querySelector('.like-count');
  const viewCount = tweetEl.querySelector('.view-count');
  
  if (commentCount) commentCount.textContent = String(tweet.comments || 0);
  if (retweetCount) retweetCount.textContent = String(tweet.retweets || 0);
  if (likeCount) likeCount.textContent = String(tweet.likes || 0);
  if (viewCount) viewCount.textContent = String(tweet.views || 0);
  
  // Event listener'ları ekle
  const commentAction = tweetEl.querySelector('.comment-action');
  const retweetAction = tweetEl.querySelector('.retweet-action');
  const likeAction = tweetEl.querySelector('.like-action');
  
  if (commentAction) {
    commentAction.addEventListener('click', () => openCommentModal(tweet.id));
  }
  if (retweetAction) {
    retweetAction.addEventListener('click', () => retweetPost(tweet.id));
  }
  if (likeAction) {
    likeAction.addEventListener('click', () => likeTweet(tweet.id));
  }
  
  // HTML string olarak döndür
  const tempDiv = document.createElement('div');
  tempDiv.appendChild(tweetEl);
  return tempDiv.innerHTML;
}

// Tweet dropdown yönetimi
function setupTweetDropdowns() {
  // Eğer zaten kurulmuşsa tekrar kurma
  if (tweetDropdownsInitialized) {
    return;
  }
  
  tweetDropdownsInitialized = true;
  
  document.addEventListener('click', function(e) {
    // Delete butonuna doğrudan tıklandığında
    if (e.target.dataset?.action === 'delete' || e.target.closest('[data-action="delete"]')) {
      e.stopPropagation();
      e.preventDefault();
      
      const deleteItem = e.target.closest('[data-action="delete"]') || e.target;
      const tweetElement = deleteItem.closest('.tweet');
      const tweetId = tweetElement?.dataset?.tweetId;
      
      if (tweetId) {
        confirmDeleteTweet(tweetId);
      }
      
      // Dropdown'ı kapat
      document.querySelectorAll('.tweet-dropdown.show').forEach(dropdown => {
        dropdown.classList.remove('show');
      });
      return;
    }
    
    // Delete tweet item'a tıklandığında (fallback)
    if (e.target.closest('.delete-tweet-item')) {
      e.stopPropagation();
      e.preventDefault();
      const tweetElement = e.target.closest('.tweet');
      const tweetId = tweetElement?.dataset?.tweetId;
      
      if (tweetId) {
        confirmDeleteTweet(tweetId);
      }
      
      // Dropdown'ı kapat
      document.querySelectorAll('.tweet-dropdown.show').forEach(dropdown => {
        dropdown.classList.remove('show');
      });
      return;
    }
    
    // Tweet more butonuna tıklandığında
    if (e.target.closest('.tweet-more')) {
      e.stopPropagation();
      const tweetMore = e.target.closest('.tweet-more');
      const dropdown = tweetMore.querySelector('.tweet-dropdown');
      
      // Diğer açık dropdown'ları kapat
      document.querySelectorAll('.tweet-dropdown.show').forEach(dd => {
        if (dd !== dropdown) {
          dd.classList.remove('show');
        }
      });
      
      // Bu dropdown'ı aç/kapat
      dropdown.classList.toggle('show');
      return;
    }
    
    // Başka bir yere tıklandığında tüm dropdown'ları kapat
    document.querySelectorAll('.tweet-dropdown.show').forEach(dropdown => {
      dropdown.classList.remove('show');
    });
  });
}

// Tweet silme onayı
function confirmDeleteTweet(tweetId) {
  if (!tweetId || tweetId === 'undefined' || tweetId === 'null') {
    showNotification('Geçersiz tweet ID', 'error');
    return;
  }
  
  if (confirm('Bu tweet\'i silmek istediğinizden emin misiniz?')) {
    deleteTweet(tweetId);
  }
}

// Tweet silme fonksiyonu
async function deleteTweet(tweetId) {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user._id) {
      showNotification('Lütfen giriş yapın', 'error');
      return;
    }

    // Tweet ID doğrulama
    if (!tweetId || tweetId === 'undefined' || tweetId === 'null') {
      showNotification('Geçersiz tweet ID', 'error');
      return;
    }

    const response = await fetch(`${API_URL}/api/tweets/${tweetId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId: user._id })
    });

    const data = await response.json();

    // HTTP status kodunu kontrol et
    if (!response.ok) {
      if (response.status === 404) {
        showNotification('Tweet bulunamadı veya zaten silinmiş', 'error');
      } else if (response.status === 403) {
        showNotification('Bu tweet\'i silme yetkiniz yok', 'error');
      } else {
        showNotification('Tweet silinirken hata oluştu', 'error');
      }
      return;
    }

    if (data.success) {
      // Local tweet listesinden kaldır (global tweets array'i için)
      tweets = tweets.filter(tweet => tweet.id !== tweetId);
      
      // UI'ı güncelle
      const currentContent = document.querySelector('.content-section.active');
      
      if (currentContent && currentContent.id === 'homeContent') {
        renderTweets();
      } else if (currentContent && currentContent.id === 'profileContent') {
        // Profile'daysak ilgili tab'ı yeniden yükle
        const activeTab = document.querySelector('.profile-tab.active');
        
        if (activeTab) {
          const tabText = activeTab.textContent.trim();
          try {
            if (tabText === 'Posts') {
              await loadUserPosts();
            } else if (tabText === 'Likes') {
              await loadLikedTweets();
            }
          } catch (error) {
            console.error('Tab yeniden yüklenirken hata:', error);
            // Hata olsa bile başarı mesajını göster
          }
        } else {
          // Tab bulunamazsa Posts tab'ını yükle
          try {
            await loadUserPosts();
          } catch (error) {
            console.error('Posts tab yüklenirken hata:', error);
          }
        }
      }
      
      showNotification('Tweet başarıyla silindi', 'success');
    } else {
      showNotification('Tweet silinirken hata oluştu: ' + data.message, 'error');
    }
  } catch (error) {
    console.error('Tweet silme hatası:', error);
    showNotification('Tweet silinirken hata oluştu', 'error');
  }
}

// likeComment fonksiyonunu güvenli hale getir (yaklaşık 2646. satır)
async function likeComment(commentId) {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user._id) {
    showNotification('Lütfen giriş yapın', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/comments/${commentId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId: user._id })
    });

    const data = await response.json();

    if (data.success) {
      // Comment element'i güvenli şekilde bul
      const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
      if (commentElement) {
        const likeCountElement = commentElement.querySelector('.like-count');
        const likeIcon = commentElement.querySelector('.like-action i');
        
        if (likeCountElement && likeIcon) {
          likeCountElement.textContent = data.likes;
          
          if (data.isLiked) {
            likeIcon.className = 'fas fa-heart';
            likeIcon.style.color = '#e0245e';
          } else {
            likeIcon.className = 'far fa-heart';
            likeIcon.style.color = '';
          }
        }
      }
      
      showNotification(data.isLiked ? 'Beğenildi' : 'Beğeni kaldırıldı', 'success');
    } else {
      showNotification('Bir hata oluştu', 'error');
    }
  } catch (error) {
    console.error('Beğeni hatası:', error);
    showNotification('Bir hata oluştu', 'error');
  }
}


function showNotificationsContent() {
  const homeContent = document.getElementById('homeContent');
  const profileContent = document.getElementById('profileContent');
  const notificationsContent = document.getElementById('notificationsContent');
  
  homeContent.classList.remove('active');
  profileContent.classList.remove('active');
  
  notificationsContent.classList.add('active'); 
  loadNotifications();
  setupNotificationTabs();
}


function setupNotificationTabs() {
  const notificationTabs = document.querySelectorAll('.notification-tab');
  notificationTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      notificationTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Tab'a göre bildirimleri filtrele
      const tabType = this.textContent.toLowerCase();
      filterNotifications(tabType);
    });
  });
}

async function loadNotifications() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user._id) {
    showEmptyNotifications();
    return;
  }
  showNotificationsLoading();
  try {
    const response = await fetch(`${API_URL}/api/notifications/${user._id}`);
    const data = await response.json();
    
    if (data.success && data.notifications.length > 0) {
      displayNotifications(data.notifications);
    } else {
      showEmptyNotifications();
    }
  } catch (error) {
    console.error('Bildirimler yüklenirken hata:', error);
    showEmptyNotifications();
  }
}

function displayNotifications(notifications) {
  const notificationsList = document.getElementById('notificationsList');
  const notificationsEmpty = document.getElementById('notificationsEmpty');
  const notificationsLoading = document.getElementById('notificationsLoading');
  
  // Loading ve empty state'leri gizle
  notificationsLoading.style.display = 'none';
  notificationsEmpty.style.display = 'none';
  notificationsList.innerHTML = '';
  
  notifications.forEach(notification => {
    const notificationEl = createNotificationElement(notification);
    notificationsList.appendChild(notificationEl);
  });
}
function createNotificationElement(notification) {
  const notificationEl = document.createElement('div');
  notificationEl.className = `notification-item ${notification.read ? '' : 'unread'}`;
  
  let iconClass, iconColor, actionText;
  
  switch (notification.type) {
    case 'like':
      iconClass = 'fas fa-heart';
      iconColor = 'like';
      actionText = 'liked your post';
      break;
    case 'comment':
      iconClass = 'far fa-comment';
      iconColor = 'comment';
      actionText = 'commented on your post';
      break;
    case 'retweet':
      iconClass = 'fas fa-retweet';
      iconColor = 'retweet';
      actionText = 'retweeted your post';
      break;
    default:
      iconClass = 'fas fa-bell';
      iconColor = 'comment';
      actionText = 'interacted with your post';
  }
  
  const userAvatar = notification.fromUser.profileImage 
    ? (notification.fromUser.profileImage.startsWith('http') 
        ? notification.fromUser.profileImage 
        : `${API_URL}${notification.fromUser.profileImage}`)
    : 'images/logo.png';
  
  notificationEl.innerHTML = `
    <div class="notification-icon ${iconColor}">
      <i class="${iconClass}"></i>
    </div>
    <div class="notification-content">
      <div class="notification-users">
        <img src="${userAvatar}" alt="${notification.fromUser.displayName || notification.fromUser.username}" class="notification-avatar">
      </div>
      <div class="notification-text">
        <span class="username">${notification.fromUser.displayName || notification.fromUser.username}</span>
        <span class="action"> ${actionText}</span>
      </div>
      ${notification.tweet ? `
        <div class="notification-tweet">
          ${notification.tweet.content}
        </div>
      ` : ''}
      <div class="notification-time">
        ${formatTimestamp(notification.created_at)}
      </div>
    </div>
  `;
  
  notificationEl.addEventListener('click', () => {
    markNotificationAsRead(notification._id);
    notificationEl.classList.remove('unread');
  });
  
  return notificationEl;
}

async function markNotificationAsRead(notificationId) {
  try {
    await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Bildirim okundu olarak işaretlenirken hata:', error);
  }
}

// Bildirimleri filtrele
function filterNotifications(type) {
  const notifications = document.querySelectorAll('.notification-item');
  
  notifications.forEach(notification => {
    if (type === 'all') {
      notification.style.display = 'flex';
    } else if (type === 'mentions') {
      const isComment = notification.querySelector('.notification-icon.comment');
      notification.style.display = isComment ? 'flex' : 'none';
    }
  });
}

// Boş bildirimler durumunu göster
function showEmptyNotifications() {
  const notificationsList = document.getElementById('notificationsList');
  const notificationsEmpty = document.getElementById('notificationsEmpty');
  const notificationsLoading = document.getElementById('notificationsLoading');
  
  notificationsList.innerHTML = '';
  notificationsLoading.style.display = 'none';
  notificationsEmpty.style.display = 'block';
}

// Loading durumunu göster
function showNotificationsLoading() {
  const notificationsList = document.getElementById('notificationsList');
  const notificationsEmpty = document.getElementById('notificationsEmpty');
  const notificationsLoading = document.getElementById('notificationsLoading');
  
  notificationsList.innerHTML = '';
  notificationsEmpty.style.display = 'none';
  notificationsLoading.style.display = 'block';
}
function initializeMobileProfileMenu() {
  const profileSection = document.querySelector('.profile-section');
  const mobileProfileTrigger = document.querySelector('.mobile-profile-trigger');
  const mobileProfileMenu = document.getElementById('mobileProfileMenu');
  const mobileProfileOverlay = document.getElementById('mobileProfileOverlay');
  const mobileProfileClose = document.getElementById('mobileProfileClose');
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  
  if (!mobileProfileMenu || !mobileProfileOverlay || !mobileProfileClose) {
    return;
  }
  if (profileSection) {
    profileSection.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (window.innerWidth <= 500) {
        openMobileProfileMenu();
      }
    });
  }
  if (mobileProfileTrigger) {
    mobileProfileTrigger.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      openMobileProfileMenu();
    });
  }
  const mobileMenuItems = mobileProfileMenu.querySelectorAll('.mobile-profile-menu-item');
  mobileMenuItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const action = this.getAttribute('data-action');
      
      switch(action) {
        case 'home':
          closeMobileProfileMenu();
          showHomeContent();
          break;
        case 'notifications':
          closeMobileProfileMenu();
          showNotificationsContent();
          break;
        case 'profile':
          closeMobileProfileMenu();
          showProfileContent();
          break;
        case 'logout':
          handleLogout();
          break;
        default:
          closeMobileProfileMenu();
          break;
      }
    });
  });
  
  mobileProfileClose.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    closeMobileProfileMenu();
  });
  mobileProfileOverlay.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    closeMobileProfileMenu();
  });
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && mobileProfileMenu.classList.contains('open')) {
      closeMobileProfileMenu();
    }
  });
}

function openMobileProfileMenu() {
  const mobileProfileMenu = document.getElementById('mobileProfileMenu');
  const mobileProfileOverlay = document.getElementById('mobileProfileOverlay');
  
  if (mobileProfileMenu && mobileProfileOverlay) {
    mobileProfileMenu.classList.add('open');
    mobileProfileOverlay.classList.add('open');
    document.body.style.overflow = 'hidden'; // Scrolling'i engelle
  }
}

function closeMobileProfileMenu() {
  const mobileProfileMenu = document.getElementById('mobileProfileMenu');
  const mobileProfileOverlay = document.getElementById('mobileProfileOverlay');
  
  if (mobileProfileMenu && mobileProfileOverlay) {
    mobileProfileMenu.classList.remove('open');
    mobileProfileOverlay.classList.remove('open');
    document.body.style.overflow = ''; // Scrolling'i geri aç
  }
}
window.addEventListener('resize', function() {
  if (window.innerWidth > 500) {
    closeMobileProfileMenu();
  }
});

// Logout fonksiyonu
function handleLogout() {
  console.log('Logout işlemi başlatılıyor...');
  
  // LocalStorage'ı temizle
  localStorage.removeItem('user');
  localStorage.removeItem('currentUserId');
  localStorage.removeItem('authToken');
  
  console.log('LocalStorage temizlendi');
  
  // Mobile menüyü kapat
  closeMobileProfileMenu();
  
  // Loading sayfası üzerinden Login sayfasına yönlendir
  console.log('Login sayfasına yönlendiriliyor...');
  
  window.location.href = 'loading.html?target=Login.html';
}

// Mobile back button'ları başlat
function initializeMobileBackButtons() {
  const notificationsMobileBack = document.getElementById('notificationsMobileBack');
  
  if (notificationsMobileBack) {
    notificationsMobileBack.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      showHomeContent();
    });
  }
}
// Yoruma cevap verme fonksiyonu
async function replyToComment(commentId, parentCommentElement) {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user._id) {
    showNotification('Lütfen giriş yapın', 'error');
    return;
  }

  // Mevcut cevap alanını kaldır
  const existingReply = parentCommentElement.querySelector('.reply-container');
  if (existingReply) {
    existingReply.remove();
  }

  // Template'i clone et
  const template = document.getElementById('replyInputTemplate');
  const replyContainer = template.content.cloneNode(true);
  
  // Template verilerini doldur
  const avatar = replyContainer.querySelector('.reply-avatar');
  const username = replyContainer.querySelector('.reply-username');
  const cancelBtn = replyContainer.querySelector('.reply-cancel-btn');
  const submitBtn = replyContainer.querySelector('.reply-submit-btn');
  
  avatar.src = user.profileImage || 'images/logo.png';
  username.textContent = `@${user.username}`;
  
  // Event listener'ları ekle
  cancelBtn.addEventListener('click', function() {
    this.closest('.reply-container').remove();
  });
  
  submitBtn.addEventListener('click', function() {
    submitReply(commentId, this);
  });
  
  // Cevap alanını comment-content'in hemen sonrasına ekle (sağa değil alta)
  const commentContent = parentCommentElement.querySelector('.comment-content');
  const replyContainerElement = replyContainer.querySelector('.reply-container');
  
  // Comment-content'in parent'ına (comment-item) ekle
  parentCommentElement.appendChild(replyContainerElement);
  
  // Textarea'ya focus ver
  const textarea = replyContainerElement.querySelector('.reply-input');
  textarea.focus();
}

// Cevap gönderme fonksiyonu
async function submitReply(commentId, buttonElement) {
  console.log('submitReply çağrıldı:', { commentId, buttonElement });
  
  const user = JSON.parse(localStorage.getItem('user'));
  console.log('Kullanıcı:', user);
  
  const replyContainer = buttonElement.closest('.reply-container');
  
  if (!replyContainer) {
    showNotification('Cevap alanı bulunamadı', 'error');
    return;
  }
  
  const replyInput = replyContainer.querySelector('.reply-input');
  
  if (!replyInput) {
    showNotification('Cevap input alanı bulunamadı', 'error');
    return;
  }
  
  const content = replyInput.value.trim();
  
  if (!content) {
    showNotification('Cevap içeriği boş olamaz', 'error');
    return;
  }
  
  try {
    console.log('API isteği gönderiliyor:', `${API_URL}/api/comments/${commentId}/reply`);
    const response = await fetch(`${API_URL}/api/comments/${commentId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: content,
        userId: user._id
      })
    });
    
    console.log('API yanıtı:', response.status);
    const data = await response.json();
    console.log('API verisi:', data);
    
    if (data.success) {
      showNotification('Cevap başarıyla gönderildi', 'success');
      
      // Reply container'ı kaldır
      replyContainer.remove();
      
      // Comment element'i bul - reply container'ın bir önceki sibling'i comment-content
      const commentContent = replyContainer.previousElementSibling;
      const commentElement = commentContent ? commentContent.closest('.comment-item') : null;
      
      if (commentElement) {
        // Cevap sayısını güncelle
        const replyCountElement = commentElement.querySelector('.reply-count');
        if (replyCountElement) {
          const currentCount = parseInt(replyCountElement.textContent) || 0;
          replyCountElement.textContent = currentCount + 1;
        }
        
        // Cevapları görüntüle butonunu göster (eğer gizliyse)
        const repliesToggle = commentElement.querySelector('.replies-toggle');
        if (repliesToggle) {
          repliesToggle.style.display = 'flex';
          // Buton metnini güncelle
          const toggleText = repliesToggle.querySelector('span:last-child');
          if (toggleText) {
            toggleText.textContent = 'Cevapları Göster';
          }
        }
        
        // Eğer cevaplar açıksa, yeni cevabı ekle
        const repliesContainer = commentElement.querySelector('.replies-container');
        if (repliesContainer && repliesContainer.style.display !== 'none') {
          loadReplies(commentId, repliesContainer);
        }
      }
    } else {
      showNotification(data.message || 'Cevap gönderilemedi', 'error');
    }
  } catch (error) {
    console.error('Detaylı hata:', error);
    showNotification('Bir hata oluştu', 'error');
  }
}

// Cevap iptal etme fonksiyonu
function cancelReply(buttonElement) {
  const replyContainer = buttonElement.closest('.reply-container');
  replyContainer.remove();
}

// Cevapları yükleme fonksiyonu
async function loadReplies(commentId, repliesContainer) {
  try {
    const response = await fetch(`${API_URL}/api/comments/${commentId}/replies`);
    const data = await response.json();
    
    if (data.success) {
      repliesContainer.innerHTML = '';
      
      if (data.replies.length === 0) {
        repliesContainer.innerHTML = '<p class="no-replies">Henüz cevap yok</p>';
      } else {
        data.replies.forEach(reply => {
          const replyElement = createReplyElement(reply);
          repliesContainer.appendChild(replyElement);
        });
      }
    }
  } catch (error) {
    console.error('Cevapları yükleme hatası:', error);
    repliesContainer.innerHTML = '<p class="error-message">Cevaplar yüklenemedi</p>';
  }
}

// Cevap elementi oluşturma fonksiyonu
function createReplyElement(reply) {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  
  // Template'i clone et
  const template = document.getElementById('replyTemplate');
  const replyElement = template.content.cloneNode(true);
  
  // Avatar source'u belirle
  let avatarSrc = 'images/logo.png';
  if (reply.user.profileImage && reply.user.profileImage.trim() !== '') {
    avatarSrc = reply.user.profileImage.startsWith('http') 
      ? reply.user.profileImage 
      : `${API_URL}${reply.user.profileImage}`;
  }
  
  // Template verilerini doldur
  const replyItem = replyElement.querySelector('.reply-item');
  const avatar = replyElement.querySelector('.reply-avatar');
  const displayName = replyElement.querySelector('.reply-display-name');
  const username = replyElement.querySelector('.reply-username');
  const time = replyElement.querySelector('.reply-time');
  const deleteBtn = replyElement.querySelector('.reply-delete-btn');
  const replyText = replyElement.querySelector('.reply-text');
  const replyImage = replyElement.querySelector('.reply-image');
  const likeIcon = replyElement.querySelector('.like-action i');
  const likeCount = replyElement.querySelector('.like-count');
  const likeAction = replyElement.querySelector('.like-action');
  
  // Data attribute'u ekle
  replyItem.dataset.replyId = reply._id;
  
  // Verileri doldur
  avatar.src = avatarSrc;
  displayName.textContent = reply.user.displayName || reply.user.username;
  username.textContent = `@${reply.user.username}`;
  time.textContent = formatTimestamp(reply.created_at);
  replyText.textContent = reply.content;
  
  // Silme butonu kontrolü
  if (currentUser && currentUser._id === reply.user._id) {
    deleteBtn.style.display = 'block';
    deleteBtn.addEventListener('click', function() {
      deleteReply(reply._id);
    });
  }
  
  // Resim kontrolü
  if (reply.image) {
    replyImage.style.display = 'block';
    replyImage.querySelector('img').src = `${API_URL}${reply.image}`;
  }
  
  // Beğeni durumu
  let isLiked = false;
  if (currentUser && reply.likedBy && reply.likedBy.includes(currentUser._id)) {
    isLiked = true;
    likeIcon.className = 'fas fa-heart';
    likeIcon.style.color = '#e91e63';
  }
  
  likeCount.textContent = reply.likes || 0;
  
  // Beğeni event listener'ı
  likeAction.addEventListener('click', function() {
    likeReply(reply._id);
  });
  
  return replyElement.querySelector('.reply-item');
}

// Cevapları göster/gizle fonksiyonu
function toggleReplies(commentId, buttonElement) {
  const commentElement = buttonElement.closest('.comment-item');
  let repliesContainer = commentElement.querySelector('.replies-container');
  
  if (!repliesContainer) {
    // Cevaplar container'ı oluştur
    repliesContainer = document.createElement('div');
    repliesContainer.className = 'replies-container';
    commentElement.appendChild(repliesContainer);
    
    // Cevapları yükle
    loadReplies(commentId, repliesContainer);
    buttonElement.textContent = 'Cevapları Gizle';
  } else {
    // Cevapları göster/gizle
    if (repliesContainer.style.display === 'none') {
      repliesContainer.style.display = 'block';
      buttonElement.textContent = 'Cevapları Gizle';
    } else {
      repliesContainer.style.display = 'none';
      buttonElement.textContent = 'Cevapları Göster';
    }
  }
}

// Cevap silme fonksiyonu
async function deleteReply(replyId) {
  if (!confirm('Bu cevabı silmek istediğinizden emin misiniz?')) {
    return;
  }
  
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user._id) {
    showNotification('Lütfen giriş yapın', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/comments/${replyId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user._id
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('Cevap başarıyla silindi', 'success');
      
      // Cevap elementini kaldır
      const replyElement = document.querySelector(`[data-reply-id="${replyId}"]`);
      if (replyElement) {
        const repliesContainer = replyElement.closest('.replies-container');
        replyElement.remove();
        
        // Kalan cevap sayısını kontrol et
        const remainingReplies = repliesContainer.querySelectorAll('.reply-item');
        
        if (remainingReplies.length === 0) {
          // Hiç cevap kalmadıysa "cevapları görüntüle" butonunu gizle
          const commentElement = repliesContainer.closest('.comment-item');
          const repliesToggle = commentElement.querySelector('.replies-toggle');
          if (repliesToggle) {
            repliesToggle.style.display = 'none';
          }
          
          // Replies container'ı da gizle
          repliesContainer.style.display = 'none';
          
          // Cevap sayısını sıfırla
          const replyCountElement = commentElement.querySelector('.reply-count');
          if (replyCountElement) {
            replyCountElement.textContent = '0';
          }
        } else {
          // Cevap sayısını güncelle
          const commentElement = repliesContainer.closest('.comment-item');
          const replyCountElement = commentElement.querySelector('.reply-count');
          if (replyCountElement) {
            replyCountElement.textContent = remainingReplies.length;
          }
        }
      }
    } else {
      showNotification(data.message || 'Cevap silinemedi', 'error');
    }
  } catch (error) {
    console.error('Cevap silme hatası:', error);
    showNotification('Bir hata oluştu', 'error');
  }
}

// Cevap beğenme fonksiyonu
async function likeReply(replyId) {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user._id) {
    showNotification('Lütfen giriş yapın', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/comments/${replyId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user._id
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      const replyElement = document.querySelector(`[data-reply-id="${replyId}"]`);
      if (replyElement) {
        const likeIcon = replyElement.querySelector('.like-action i');
        const likeCount = replyElement.querySelector('.like-count');
        
        if (data.isLiked) {
          likeIcon.className = 'fas fa-heart';
          likeIcon.style.color = '#e91e63';
        } else {
          likeIcon.className = 'far fa-heart';
          likeIcon.style.color = '';
        }
        
        likeCount.textContent = data.likes;
      }
    }
  } catch (error) {
    console.error('Cevap beğeni hatası:', error);
  }
}

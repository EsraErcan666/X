// API adresini otomatik belirle
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : window.location.origin;

// Sayfa yüklendiğinde login kontrolü
(function() {
  const user = localStorage.getItem('user');
  if (!user) {
    window.location.href = 'Login.html';
  }
})();

// Authentication kontrolü fonksiyonu
function checkAuthentication() {
  const user = localStorage.getItem('user');
  
  // Eğer kullanıcı bilgisi yoksa login sayfasına yönlendir
  if (!user) {
    window.location.href = 'Login.html';
    return false;
  }
  
  try {
    const userData = JSON.parse(user);
    // Kullanıcı verisi geçersizse login sayfasına yönlendir
    if (!userData || !userData._id) {
      localStorage.removeItem('user');
      localStorage.removeItem('currentUserId');
      window.location.href = 'Login.html';
      return false;
    }
  } catch (error) {
    // JSON parse hatası varsa login sayfasına yönlendir
    localStorage.removeItem('user');
    localStorage.removeItem('currentUserId');
    window.location.href = 'Login.html';
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
    const response = await fetch(`${API_URL}/api/tweets`);
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
        views: tweet.views
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

    const data = await response.json();
    
    if (data.success && data.users.length > 0) {
      updateWhoToFollowSection(data.users);
    } else {
      console.log('En çok posta sahip kullanıcı bulunamadı');
    }
  } catch (error) {
    console.error('En çok posta sahip kullanıcıları yükleme hatası:', error);
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
    profileImageSrc = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23657786"/%3E%3C/svg%3E';
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
      // localStorage'ı temizle
      localStorage.removeItem('user');
      localStorage.removeItem('currentUserId');
      window.location.href = 'login.html';
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
    const response = await fetch(`${API_URL}/api/tweets/user/${user._id}`);
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
    
    // Avatar
    const avatar = tweetEl.querySelector('.avatar');
    if (tweet.user.profileImage && tweet.user.profileImage.trim() !== '') {
      const avatarUrl = tweet.user.profileImage.startsWith('http') 
        ? tweet.user.profileImage 
        : `${API_URL}${tweet.user.profileImage}`;
      avatar.src = avatarUrl;
    } else {
      avatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23fff"/%3E%3C/svg%3E';
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
      // Data URL veya dosya yolu olabilir
      if (tweet.image.startsWith('data:')) {
        imageImg.src = tweet.image; // Data URL
      } else if (tweet.image.startsWith('/uploads/')) {
        imageImg.src = `${API_URL}${tweet.image}`; // Eski dosya yolu
      } else {
        imageImg.src = tweet.image; // HTTP URL
      }
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
      // Data URL veya dosya yolu olabilir
      if (tweet.video.startsWith('data:')) {
        videoSource.src = tweet.video; // Data URL
      } else if (tweet.video.startsWith('/uploads/')) {
        videoSource.src = `${API_URL}${tweet.video}`; // Eski dosya yolu
      } else {
        videoSource.src = tweet.video; // HTTP URL
      }
      videoSource.type = getVideoMimeType(tweet.video);
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

function saveProfile() {
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
  if (avatarFile) {
    formData.append('profileImage', avatarFile);
  }
  
  const bannerFile = document.getElementById('bannerUpload').files[0];
  if (bannerFile) {
    formData.append('bannerImage', bannerFile);
  }
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user._id || localStorage.getItem('currentUserId') || '507f1f77bcf86cd799439011';
  fetch(`${API_URL}/api/user/${userId}`, { 
    method: 'PUT',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
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
  })
  .catch(error => {
    console.error('Profil güncelleme hatası:', error);
    showNotification('Profil güncellenirken bir hata oluştu.', 'error');
  });
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
    const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23fff"/%3E%3C/svg%3E';
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
    window.location.href = 'login.html';
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
    modalAvatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23fff"/%3E%3C/svg%3E';
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
      // Local tweet listesindeki like sayısını güncelle
      const tweet = tweets.find(t => t.id === id);
      if (tweet) {
        tweet.likes = data.likes;
        renderTweets();
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
      avatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23fff"/%3E%3C/svg%3E';
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
      // Data URL veya dosya yolu olabilir
      if (tweet.image.startsWith('data:')) {
        imageImg.src = tweet.image; // Data URL
      } else if (tweet.image.startsWith('/uploads/')) {
        imageImg.src = `${API_URL}${tweet.image}`; // Eski dosya yolu
      } else {
        imageImg.src = tweet.image; // HTTP URL
      }
      imageImg.alt = 'Tweet image';
    } else {
      imageDiv.style.display = 'none';
    }
    
    // Tweet videosu
    const videoDiv = tweetEl.querySelector('.tweet-video');
    console.log('renderTweets - Video kontrolü - tweet.video:', tweet.video);
    if (tweet.video && tweet.video.trim() !== '') {
      console.log('renderTweets - Video bulundu, gösteriliyor:', tweet.video);
      videoDiv.style.display = 'block';
      const videoEl = videoDiv.querySelector('video');
      const videoSource = videoEl.querySelector('source');
      // Data URL veya dosya yolu olabilir
      if (tweet.video.startsWith('data:')) {
        videoSource.src = tweet.video; // Data URL
      } else if (tweet.video.startsWith('/uploads/')) {
        videoSource.src = `${API_URL}${tweet.video}`; // Eski dosya yolu
      } else {
        videoSource.src = tweet.video; // HTTP URL
      }
      console.log('renderTweets - Video URL:', tweet.video);
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
    
    tweetEl.querySelector('.comment-action').addEventListener('click', () => commentPost(tweet.id));
    tweetEl.querySelector('.retweet-action').addEventListener('click', () => retweetPost(tweet.id));
    tweetEl.querySelector('.like-action').addEventListener('click', () => likeTweet(tweet.id));
    
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
  
  const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23fff"/%3E%3C/svg%3E';
  const defaultMobileAvatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"%3E%3Ccircle cx="16" cy="16" r="16" fill="%23e1e8ed"/%3E%3Cpath d="M16 6c2.65 0 4.8 2.15 4.8 4.8s-2.15 4.8-4.8 4.8-4.8-2.15-4.8-4.8S13.35 6 16 6zM16 19.2c-5.3 0-9.6 2.7-9.6 6V28h19.2v-2.8c0-3.3-4.3-6-9.6-6z" fill="%23fff"/%3E%3C/svg%3E';
  
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
      sidebarAvatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23fff"/%3E%3C/svg%3E';
    }
  }
  
  if (mobileProfileAvatar) {
    if (user.profileImage) {
      const fullImageUrl = user.profileImage.startsWith('http') 
        ? user.profileImage 
        : `${API_URL}${user.profileImage}`;
      mobileProfileAvatar.src = fullImageUrl;
    } else {
      mobileProfileAvatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"%3E%3Ccircle cx="16" cy="16" r="16" fill="%23e1e8ed"/%3E%3Cpath d="M16 6c2.65 0 4.8 2.15 4.8 4.8s-2.15 4.8-4.8 4.8-4.8-2.15-4.8-4.8S13.35 6 16 6zM16 19.2c-5.3 0-9.6 2.7-9.6 6V28h19.2v-2.8c0-3.3-4.3-6-9.6-6z" fill="%23fff"/%3E%3C/svg%3E';
    }
  }
  
  if (mobileMenuAvatar) {
    if (user.profileImage) {
      const fullImageUrl = user.profileImage.startsWith('http') 
        ? user.profileImage 
        : `${API_URL}${user.profileImage}`;
      mobileMenuAvatar.src = fullImageUrl;
    } else {
      mobileMenuAvatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23fff"/%3E%3C/svg%3E';
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
function openCommentModal(tweetId) {
  currentTweetForComment = tweetId;
  const tweet = tweets.find(t => t.id === tweetId);
  if (!tweet) return;
  
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
      : `http://localhost:${tweet.avatar}`;
    originalAvatar.src = avatarUrl;
  } else {
    originalAvatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23fff"/%3E%3C/svg%3E';
  }
  
  originalName.textContent = tweet.displayName;
  originalUsername.textContent = `@${tweet.username} · ${tweet.timestamp}`;
  originalText.textContent = tweet.content;
  replyUsername.textContent = `@${tweet.username}`;
  
  // Tweet resmi varsa göster
  if (tweet.image && tweet.image.trim() !== '') {
    originalImage.style.display = 'block';
    // Data URL veya dosya yolu olabilir
    if (tweet.image.startsWith('data:')) {
      originalImage.querySelector('img').src = tweet.image; // Data URL
    } else if (tweet.image.startsWith('/uploads/')) {
      originalImage.querySelector('img').src = `${API_URL}${tweet.image}`; // Eski dosya yolu
    } else {
      originalImage.querySelector('img').src = tweet.image; // HTTP URL
    }
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
    commentAvatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23fff"/%3E%3C/svg%3E';
  }
  
  commentModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Yorumları yükle
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
    commentEl.dataset.commentId = comment._id;
    
    // Avatar
    let avatarSrc = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23fff"/%3E%3C/svg%3E';
    if (comment.user.profileImage && comment.user.profileImage.trim() !== '') {
      avatarSrc = comment.user.profileImage.startsWith('http') 
        ? comment.user.profileImage 
        : `${API_URL}${comment.user.profileImage}`;
    }
    
    // Zaman formatı
    const commentTime = formatTimestamp(comment.created_at);
    
    // Yorum resmi
    let imageHtml = '';
    if (comment.image && comment.image.trim() !== '') {
      const imageUrl = comment.image.startsWith('http') 
        ? comment.image 
        : `${API_URL}${comment.image}`;
      imageHtml = `
        <div class="comment-image">
          <img src="${imageUrl}" alt="Comment image" />
        </div>
      `;
    }
    
    // Silme butonu (sadece yorum sahibi için)
    let deleteBtn = '';
    if (currentUser && currentUser._id === comment.user._id) {
      deleteBtn = `<div class="comment-delete-btn" onclick="deleteComment('${comment._id}')"><i class="fas fa-trash"></i></div>`;
    }
    
    commentEl.innerHTML = `
      <img src="${avatarSrc}" alt="User Avatar" class="comment-avatar-small" />
      <div class="comment-content">
        <div class="comment-header">
          <span class="comment-user-name">${comment.user.displayName || comment.user.username}</span>
          <span class="comment-user-username">@${comment.user.username}</span>
          <span class="comment-time">· ${commentTime}</span>
          ${deleteBtn}
        </div>
        <div class="comment-text">${comment.content}</div>
        ${imageHtml}
        <div class="comment-actions-small">
          <div class="comment-action-small" onclick="likeComment('${comment._id}')">
            <i class="far fa-heart"></i>
            <span>${comment.likes || 0}</span>
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
    avatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e1e8ed"/%3E%3Cpath d="M20 8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zM20 24c-6.63 0-12 3.37-12 7.5V35h24v-3.5c0-4.13-5.37-7.5-12-7.5z" fill="%23fff"/%3E%3C/svg%3E';
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
    // Data URL veya dosya yolu olabilir
    if (tweet.image.startsWith('data:')) {
      imageImg.src = tweet.image; // Data URL
    } else if (tweet.image.startsWith('/uploads/')) {
      imageImg.src = `${API_URL}${tweet.image}`; // Eski dosya yolu
    } else {
      imageImg.src = tweet.image; // HTTP URL
    }
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
    // Data URL veya dosya yolu olabilir
    if (tweet.video.startsWith('data:')) {
      videoSource.src = tweet.video; // Data URL
    } else if (tweet.video.startsWith('/uploads/')) {
      videoSource.src = `${API_URL}${tweet.video}`; // Eski dosya yolu
    } else {
      videoSource.src = tweet.video; // HTTP URL
    }
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

// Yorum beğenme fonksiyonu (ileride implement edilebilir)
function likeComment(commentId) {
  console.log('Yorum beğenildi:', commentId);
  // Bu fonksiyon ileride implement edilebilir
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
    : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"%3E%3Ccircle cx="16" cy="16" r="16" fill="%23e1e8ed"/%3E%3Cpath d="M16 6c2.65 0 4.8 2.15 4.8 4.8s-2.15 4.8-4.8 4.8-4.8-2.15-4.8-4.8S13.35 6 16 6zM16 19.2c-5.3 0-9.6 2.7-9.6 6v2.4h19.2v-2.4c0-3.3-4.3-6-9.6-6z" fill="%23657786"/%3E%3C/svg%3E';
  
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
  // LocalStorage'ı temizle
  localStorage.removeItem('user');
  localStorage.removeItem('currentUserId');
  localStorage.removeItem('authToken');
  
  // Mobile menüyü kapat
  closeMobileProfileMenu();
  
  // Login sayfasına yönlendir
  window.location.href = 'Login.html';
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
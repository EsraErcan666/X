let tweetInput, modalTweetInput, tweetList, tweetModal, tweetTemplate, profileTemplate;
let postButton, modalPostButton, closeModalBtn, postButtonMain;

const currentUser = {
  id: 1,
  username: "kullanici",
  displayName: "Kullanıcı Adı",
  avatar: ""
};

let tweets = [
  {
    id: 1,
    userId: 2,
    username: "xpremium",
    displayName: "X Premium",
    verified: true,
    avatar: "",
    content: "X Premium'a abone olun ve gelir paylaşım programımıza katılın!",
    image: "",
    timestamp: "2s",
    likes: 45,
    comments: 5,
    retweets: 12,
    views: 1024
  },
  {
    id: 2,
    userId: 3,
    username: "haberler",
    displayName: "Güncel Haberler",
    verified: true,
    avatar: "",
    content: "Bugün gerçekleşen önemli gelişmeler ve son dakika haberleri için bizi takip edin.",
    timestamp: "5m",
    likes: 128,
    comments: 32,
    retweets: 64,
    views: 8540
  }
];

document.addEventListener("DOMContentLoaded", function() {
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
  
  renderTweets();
  setupEventListeners();
  setupTweetModal();
  setupButtonStates();
  setupProfileMenu();
  loadSidebarUserInfo();
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
      
      if (index === 8) { 
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
  
  if (profileContent.innerHTML.trim() === '<!-- Content will be loaded from profile.html -->') {
    loadProfileContent();
  } else {
    loadUserProfile();
  }
  
  homeContent.classList.remove('active');
  profileContent.classList.add('active');
  setupProfileEventListeners();
}

function showHomeContent() {
  const homeContent = document.getElementById('homeContent');
  const profileContent = document.getElementById('profileContent');
  
  profileContent.classList.remove('active');
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
}

// Kullanıcı profil verilerini API'den çek
function loadUserProfile() {
  // LocalStorage'dan kullanıcı bilgilerini al
  const user = JSON.parse(localStorage.getItem('user'));
  let userId;
  
  if (user && user._id) {
    userId = user._id;
    localStorage.setItem('currentUserId', userId);
  } else {
    userId = localStorage.getItem('currentUserId') || '507f1f77bcf86cd799439011';
  }
  fetch(`http://localhost:3000/api/user/${userId}`) 
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        updateProfileDisplay(data.user);
        populateEditForm(data.user);
        updateSidebarProfile(data.user);
      } else {
        console.error('Kullanıcı verileri yüklenemedi:', data.message);
        showNotification('Kullanıcı bilgileri yüklenemedi', 'error');
      }
    })
    .catch(error => {
      console.error('Profil yükleme hatası:', error);
      showNotification('Profil yüklenirken bir hata oluştu', 'error');
    });
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
      : `http://localhost:3000${user.profileImage}`;
    console.log('Avatar önizleme güncelleniyor:', fullImageUrl);
    avatarPreview.src = fullImageUrl;
  }
  
  if (currentBanner && user.bannerImage) {
    const fullBannerUrl = user.bannerImage.startsWith('http') 
      ? user.bannerImage 
      : `http://localhost:3000${user.bannerImage}`;
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
  profileTabs.forEach(tab => {
    tab.addEventListener("click", function() {
      profileTabs.forEach(t => t.classList.remove("active"));
      this.classList.add("active");
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
  
  const name = document.getElementById('editName').value;
  const bio = document.getElementById('editBio').value;
  const location = document.getElementById('editLocation').value;
  const website = document.getElementById('editWebsite').value;
  
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
  fetch(`http://localhost:3000/api/user/${userId}`, { 
    method: 'PUT',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      updateProfileDisplay(data.user);
      populateEditForm(data.user);
      updateSidebarProfile(data.user);
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
  const profileTitle = document.querySelector('.profile-title h2');
  if (profileTitle) {
    profileTitle.textContent = user.displayName || user.username;
  }
  const profileNameSection = document.querySelector('.profile-name-section h1');
  if (profileNameSection) {
    profileNameSection.textContent = user.displayName || user.username;
  }
  const sidebarProfileName = document.querySelector('.profile-name');
  if (sidebarProfileName) {
    sidebarProfileName.textContent = user.displayName || user.username;
  }

  if (user.profileImage) {
    const fullImageUrl = user.profileImage.startsWith('http') 
      ? user.profileImage 
      : `http://localhost:3000${user.profileImage}`;
      
    const profileAvatar = document.querySelector('.profile-avatar-large img');
    if (profileAvatar) {
      profileAvatar.src = fullImageUrl;
    }
    const sidebarAvatar = document.querySelector('.profile-avatar');
    if (sidebarAvatar) {
      sidebarAvatar.src = fullImageUrl;
    }


  }
  if (user.bannerImage) {
    const fullBannerUrl = user.bannerImage.startsWith('http') 
      ? user.bannerImage 
      : `http://localhost:3000${user.bannerImage}`;
      
    const bannerImage = document.querySelector('.banner-image');
    if (bannerImage) {
      bannerImage.style.backgroundImage = `url(${fullBannerUrl})`;
      bannerImage.style.backgroundSize = 'cover';
      bannerImage.style.backgroundPosition = 'center';
    }
  }
  if (user.bio) {
    let bioElement = document.querySelector('.profile-bio');
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
  }
  if (user.location) {
    let locationElement = document.querySelector('.profile-location');
    if (!locationElement) {
      locationElement = document.createElement('div');
      locationElement.className = 'profile-location';
      const profileMeta = document.querySelector('.profile-meta');
      const joinDate = profileMeta.querySelector('.join-date');
      profileMeta.insertBefore(locationElement, joinDate);
    }
    locationElement.innerHTML = `<i class="fas fa-map-marker-alt"></i> <span>${user.location}</span>`;
    locationElement.style.marginBottom = '12px';
    locationElement.style.fontSize = '15px';
    locationElement.style.color = '#71767b';
  }
  if (user.website) {
    let websiteElement = document.querySelector('.profile-website');
    if (!websiteElement) {
      websiteElement = document.createElement('div');
      websiteElement.className = 'profile-website';
      const profileMeta = document.querySelector('.profile-meta');
      const joinDate = profileMeta.querySelector('.join-date');
      profileMeta.insertBefore(websiteElement, joinDate);
    }
    websiteElement.innerHTML = `<i class="fas fa-link"></i> <a href="${user.website}" target="_blank" rel="noopener noreferrer">${user.website}</a>`;
    websiteElement.style.marginBottom = '12px';
    websiteElement.style.fontSize = '15px';
    websiteElement.style.color = '#71767b';
    
    const link = websiteElement.querySelector('a');
    link.style.color = '#1d9bf0';
    link.style.textDecoration = 'none';
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
  if (text === "") return;
  
  const button = fromModal ? modalPostButton : postButton;
  if (button.disabled) return;

  const tweet = {
    id: Date.now(),
    userId: currentUser.id,
    username: currentUser.username,
    displayName: currentUser.displayName,
    verified: false,
    avatar: currentUser.avatar,
    content: text,
    timestamp: "now",
    likes: 0,
    comments: 0,
    retweets: 0,
    views: 1
  };

  tweets.unshift(tweet);
  input.value = "";
  renderTweets();
  
  if (fromModal) {
    closeTweetModal();
  }
}

function setupTweetModal() {
  window.addEventListener("click", function(event) {
    if (event.target === tweetModal) {
      closeTweetModal();
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
}

function closeTweetModal() {
  tweetModal.classList.remove("active");
  modalTweetInput.value = "";
  document.body.style.overflow = ""; 
  updateModalButtonState(); 
}
function setupButtonStates() {
  postButton.disabled = true;
  postButton.classList.add("disabled");
  
  tweetInput.addEventListener("input", function() {
    if (tweetInput.value.trim() === "") {
      postButton.disabled = true;
      postButton.classList.add("disabled");
    } else {
      postButton.disabled = false;
      postButton.classList.remove("disabled");
    }
  });
  
  modalPostButton.disabled = true;
  modalPostButton.classList.add("disabled");
}

function updateModalButtonState() {
  if (modalTweetInput.value.trim() === "") {
    modalPostButton.disabled = true;
    modalPostButton.classList.add("disabled");
  } else {
    modalPostButton.disabled = false;
    modalPostButton.classList.remove("disabled");
  }
}

function likeTweet(id) {
  const tweet = tweets.find(t => t.id === id);
  if (tweet) {
    tweet.likes++;
    renderTweets();
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
  const tweet = tweets.find(t => t.id === id);
  if (tweet) {
    tweet.comments++;
    renderTweets();
  }
}

function renderTweets() {
  tweetList.innerHTML = "";

  tweets.forEach(tweet => {
    const tweetEl = tweetTemplate.content.cloneNode(true);
    
    const avatar = tweetEl.querySelector('.avatar');
    avatar.src = tweet.avatar;
    avatar.alt = tweet.displayName;
    
    const nameSpan = tweetEl.querySelector('.name');
    nameSpan.textContent = tweet.displayName;
    if (tweet.verified) {
      nameSpan.innerHTML += ' <i class="fas fa-check-circle"></i>';
    }
    const usernameSpan = tweetEl.querySelector('.username');
    usernameSpan.textContent = `@${tweet.username} · ${tweet.timestamp}`;
    
    const contentP = tweetEl.querySelector('.post-content p');
    contentP.textContent = tweet.content;
    
    const imageDiv = tweetEl.querySelector('.tweet-image');
    if (tweet.image) {
      imageDiv.style.display = 'block';
      const imageImg = imageDiv.querySelector('img');
      imageImg.src = tweet.image;
    }
    
    tweetEl.querySelector('.comment-count').textContent = tweet.comments;
    tweetEl.querySelector('.retweet-count').textContent = tweet.retweets;
    tweetEl.querySelector('.like-count').textContent = tweet.likes;
    tweetEl.querySelector('.view-count').textContent = tweet.views;
    
    tweetEl.querySelector('.comment-action').addEventListener('click', () => commentPost(tweet.id));
    tweetEl.querySelector('.retweet-action').addEventListener('click', () => retweetPost(tweet.id));
    tweetEl.querySelector('.like-action').addEventListener('click', () => likeTweet(tweet.id));
    
    tweetList.appendChild(tweetEl);
  });
}


function loadSidebarUserInfo() {
  const user = JSON.parse(localStorage.getItem('user'));
  let userId;
  
  if (user && user._id) {
    userId = user._id;
    localStorage.setItem('currentUserId', userId);
  } else {
    userId = localStorage.getItem('currentUserId') || '507f1f77bcf86cd799439011';
  }
  
  fetch(`http://localhost:3000/api/user/${userId}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        updateSidebarProfile(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        console.error('Sidebar kullanıcı verileri yüklenemedi:', data.message);
      }
    })
    .catch(error => {
      console.error('Sidebar profil yükleme hatası:', error);
    });
}
function updateSidebarProfile(user) {
  const sidebarAvatar = document.querySelector('.profile-avatar');
  if (sidebarAvatar && user.profileImage) {
    const fullImageUrl = user.profileImage.startsWith('http') 
      ? user.profileImage 
      : `http://localhost:3000${user.profileImage}`;
    sidebarAvatar.src = fullImageUrl;
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

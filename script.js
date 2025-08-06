let tweetInput, modalTweetInput, tweetList, tweetModal, tweetTemplate;
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
  postButton = document.querySelector('.tweet-actions button');
  modalPostButton = document.getElementById('modalPostButton');
  closeModalBtn = document.querySelector('.close-modal');
  postButtonMain = document.querySelector('.post-button');
  
  renderTweets();
  setupEventListeners();
  setupTweetModal();
  setupButtonStates();
  setupProfileMenu();
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
  menuItems.forEach(item => {
    item.addEventListener("click", function() {
      menuItems.forEach(i => i.classList.remove("active"));
      this.classList.add("active");
    });
  });
  
  postButtonMain.addEventListener("click", function() {
    openTweetModal();
  });
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

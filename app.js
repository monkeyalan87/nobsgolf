// ===== GLOBAL STATE =====
let currentUser = null;
let allEvents = [];
let allPlayers = [];
let allPosts = [];
let currentView = 'newsfeed';
let selectedEventId = null;
let selectedPhotoFile = null;
let currentMonth = new Date();

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    setupEventListeners();
});

// ===== AUTHENTICATION =====
function initializeAuth() {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadUserProfile();
        } else {
            showScreen('loginScreen');
        }
    });
}

async function loadUserProfile() {
    try {
        const userRef = firebase.database().ref(`users/${currentUser.uid}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (userData) {
            document.getElementById('userDisplayName').textContent = userData.displayName || 'User';
            showScreen('mainApp');
            loadAllData();
        } else {
            // First time login, create user profile
            await createUserProfile();
        }
    } catch (error) {
        showToast('Error loading profile', 'error');
        console.error(error);
    }
}

async function createUserProfile() {
    const name = prompt('Please enter your name:') || 'User';
    const handicap = parseFloat(prompt('Please enter your handicap:') || '18');
    
    try {
        await firebase.database().ref(`users/${currentUser.uid}`).set({
            displayName: name,
            email: currentUser.email,
            handicap: handicap,
            joinedDate: new Date().toISOString(),
            eventsPlayed: 0,
            leaguePoints: 0
        });
        
        loadUserProfile();
    } catch (error) {
        showToast('Error creating profile', 'error');
        console.error(error);
    }
}

// ===== SETUP EVENT LISTENERS =====
function setupEventListeners() {
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.dataset.tab;
            document.getElementById('signinForm').classList.toggle('hidden', tabName !== 'signin');
            document.getElementById('signupForm').classList.toggle('hidden', tabName !== 'signup');
        });
    });
    
    // Auth buttons
    document.getElementById('signinBtn').addEventListener('click', handleSignIn);
    document.getElementById('signupBtn').addEventListener('click', handleSignUp);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Social auth buttons
    document.getElementById('googleSignInBtn').addEventListener('click', () => handleGoogleSignIn());
    document.getElementById('googleSignUpBtn').addEventListener('click', () => handleGoogleSignIn(true));
    document.getElementById('appleSignInBtn').addEventListener('click', () => handleAppleSignIn());
    document.getElementById('appleSignUpBtn').addEventListener('click', () => handleAppleSignIn(true));
    
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });
    
    // Add event buttons
    const addEventBtn = document.getElementById('addEventBtn');
    const addEventBtn2 = document.getElementById('addEventBtn2');
    if (addEventBtn) {
        addEventBtn.addEventListener('click', () => openEventModal());
    }
    if (addEventBtn2) {
        addEventBtn2.addEventListener('click', () => openEventModal());
    }
    
    // Newsfeed
    const postBtn = document.getElementById('postBtn');
    const addPhotoBtn = document.getElementById('addPhotoBtn');
    const photoInput = document.getElementById('photoInput');
    
    console.log('Photo upload elements:', { postBtn: !!postBtn, addPhotoBtn: !!addPhotoBtn, photoInput: !!photoInput });
    
    if (postBtn) {
        postBtn.addEventListener('click', createPost);
    }
    if (addPhotoBtn && photoInput) {
        addPhotoBtn.addEventListener('click', () => {
            console.log('Photo button clicked, opening file picker...');
            photoInput.click();
        });
        photoInput.addEventListener('change', handlePhotoSelect);
    } else {
        console.error('Photo upload elements missing!', { addPhotoBtn, photoInput });
    }
    
    // Feed filters
    document.querySelectorAll('.feed-filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.feed-filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            filterPosts(tab.dataset.filter);
        });
    });
    
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            filterEvents(tab.dataset.filter);
        });
    });
    
    // Modal controls
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAllModals();
        });
    });
    
    // Save buttons
    document.getElementById('saveEventBtn').addEventListener('click', saveEvent);
    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
    
    // Profile button
    document.getElementById('editProfileBtn').addEventListener('click', openEditProfileModal);
    
    // Profile photo upload
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const profilePhotoInput = document.getElementById('profilePhotoInput');
    
    console.log('Profile photo elements:', { changePhotoBtn: !!changePhotoBtn, profilePhotoInput: !!profilePhotoInput });
    
    if (changePhotoBtn && profilePhotoInput) {
        changePhotoBtn.addEventListener('click', () => {
            console.log('Profile photo button clicked, opening file picker...');
            profilePhotoInput.click();
        });
        profilePhotoInput.addEventListener('change', handleProfilePhotoUpload);
    } else {
        console.error('Profile photo elements missing!', { changePhotoBtn, profilePhotoInput });
    }
    
    // Search
    document.getElementById('playerSearch').addEventListener('input', (e) => {
        filterPlayers(e.target.value);
    });
    
    // League season filter
    document.getElementById('leagueSeasonFilter').addEventListener('change', (e) => {
        loadLeagueStandings(e.target.value);
    });
}

// ===== AUTH HANDLERS =====
async function handleSignIn() {
    const email = document.getElementById('signinEmail').value;
    const password = document.getElementById('signinPassword').value;
    
    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
        document.getElementById('authError').textContent = error.message;
    }
}

async function handleSignUp() {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const handicap = parseFloat(document.getElementById('signupHandicap').value) || 18;
    
    if (!name || !email || !password) {
        document.getElementById('authError').textContent = 'Please fill in all fields';
        return;
    }
    
    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await firebase.database().ref(`users/${user.uid}`).set({
            displayName: name,
            email: email,
            handicap: handicap,
            joinedDate: new Date().toISOString(),
            eventsPlayed: 0,
            leaguePoints: 0
        });
        
    } catch (error) {
        document.getElementById('authError').textContent = error.message;
    }
}

async function handleGoogleSignIn(isSignUp = false) {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
        prompt: 'select_account'
    });
    
    try {
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        
        // Check if user profile exists
        const userRef = firebase.database().ref(`users/${user.uid}`);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            // First time Google sign-in, create profile
            const handicap = isSignUp ? 
                parseFloat(prompt('Please enter your handicap:', '18') || '18') : 18;
            
            await userRef.set({
                displayName: user.displayName || 'User',
                email: user.email,
                handicap: handicap,
                joinedDate: new Date().toISOString(),
                eventsPlayed: 0,
                leaguePoints: 0,
                authProvider: 'google'
            });
        }
        
    } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            document.getElementById('authError').textContent = error.message;
        }
    }
}

async function handleAppleSignIn(isSignUp = false) {
    const provider = new firebase.auth.OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    
    try {
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        
        // Check if user profile exists
        const userRef = firebase.database().ref(`users/${user.uid}`);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            // First time Apple sign-in, create profile
            const displayName = user.displayName || 
                prompt('Please enter your name:', '') || 'User';
            const handicap = isSignUp ? 
                parseFloat(prompt('Please enter your handicap:', '18') || '18') : 18;
            
            await userRef.set({
                displayName: displayName,
                email: user.email || 'private@apple.com',
                handicap: handicap,
                joinedDate: new Date().toISOString(),
                eventsPlayed: 0,
                leaguePoints: 0,
                authProvider: 'apple'
            });
        }
        
    } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            document.getElementById('authError').textContent = error.message;
        }
    }
}

async function handleLogout() {
    try {
        await firebase.auth().signOut();
        currentUser = null;
        allEvents = [];
        allPlayers = [];
        showScreen('loginScreen');
    } catch (error) {
        showToast('Error logging out', 'error');
    }
}

// ===== DATA LOADING =====
function loadAllData() {
    loadEvents();
    loadPlayers();
    loadPosts();
    updateComposerAvatar();
}

function loadEvents() {
    const eventsRef = firebase.database().ref('events');
    
    eventsRef.on('value', (snapshot) => {
        allEvents = [];
        snapshot.forEach((childSnapshot) => {
            allEvents.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
        renderCalendar();
        renderUpcomingEvents();
        renderAllEvents();
    });
}

function loadPlayers() {
    const usersRef = firebase.database().ref('users');
    
    usersRef.on('value', (snapshot) => {
        allPlayers = [];
        snapshot.forEach((childSnapshot) => {
            allPlayers.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        renderPlayers();
    });
}

function loadPosts() {
    const postsRef = firebase.database().ref('posts');
    
    postsRef.on('value', (snapshot) => {
        allPosts = [];
        snapshot.forEach((childSnapshot) => {
            allPosts.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        // Sort by timestamp (newest first)
        allPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        renderPosts();
    });
}

// ===== NEWSFEED FUNCTIONS =====
function updateComposerAvatar() {
    if (!currentUser) return;
    
    firebase.database().ref(`users/${currentUser.uid}`).once('value').then(snapshot => {
        const userData = snapshot.val();
        if (userData) {
            const initials = userData.displayName.split(' ').map(n => n[0]).join('');
            document.getElementById('composerAvatar').textContent = initials;
        }
    });
}

function handlePhotoSelect(event) {
    console.log('handlePhotoSelect called', event);
    const file = event.target.files[0];
    console.log('Selected file:', file);
    
    if (!file) {
        console.log('No file selected');
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        console.error('Invalid file type:', file.type);
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showToast('Image must be less than 5MB', 'error');
        console.error('File too large:', file.size);
        return;
    }
    
    selectedPhotoFile = file;
    console.log('Photo selected successfully, creating preview...');
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('photoPreview');
        if (!preview) {
            console.error('photoPreview element not found!');
            return;
        }
        preview.innerHTML = `
            <img src="${e.target.result}" alt="Preview">
            <div class="photo-preview-controls">
                <span>Photo ready to upload</span>
                <button onclick="clearPhoto()" class="secondary-btn small">Remove</button>
            </div>
        `;
        preview.classList.remove('hidden');
        console.log('Preview displayed');
    };
    reader.onerror = (error) => {
        console.error('FileReader error:', error);
    };
    reader.readAsDataURL(file);
}

function clearPhoto() {
    selectedPhotoFile = null;
    document.getElementById('photoPreview').classList.add('hidden');
    document.getElementById('photoInput').value = '';
}

async function createPost() {
    const content = document.getElementById('postContent').value.trim();
    
    if (!content && !selectedPhotoFile) {
        showToast('Please write something or add a photo', 'error');
        return;
    }
    
    try {
        const userData = (await firebase.database().ref(`users/${currentUser.uid}`).once('value')).val();
        
        const postData = {
            authorId: currentUser.uid,
            authorName: userData.displayName,
            content: content,
            timestamp: new Date().toISOString(),
            likes: 0,
            likedBy: {},
            comments: {}
        };
        
        // If there's a photo, convert to base64
        if (selectedPhotoFile) {
            const base64 = await fileToBase64(selectedPhotoFile);
            postData.photoData = base64;
            postData.hasPhoto = true;
        }
        
        // Determine post type
        if (content.toLowerCase().includes('match report') || content.toLowerCase().includes('round report')) {
            postData.type = 'report';
        } else if (selectedPhotoFile) {
            postData.type = 'photo';
        } else {
            postData.type = 'message';
        }
        
        await firebase.database().ref('posts').push(postData);
        
        // Clear form
        document.getElementById('postContent').value = '';
        clearPhoto();
        
        showToast('Posted successfully!', 'success');
        
    } catch (error) {
        console.error('Error creating post:', error);
        showToast('Error creating post', 'error');
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function renderPosts() {
    filterPosts('all');
}

function filterPosts(filter) {
    const container = document.getElementById('postsList');
    
    let filteredPosts = [...allPosts];
    
    if (filter === 'reports') {
        filteredPosts = filteredPosts.filter(post => post.type === 'report');
    } else if (filter === 'photos') {
        filteredPosts = filteredPosts.filter(post => post.hasPhoto);
    }
    
    if (filteredPosts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📰</div>
                <div class="empty-state-text">No posts yet. Be the first to share!</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredPosts.map(post => createPostHTML(post)).join('');
    
    // Add event listeners for post actions
    container.querySelectorAll('.post-action[data-action="like"]').forEach(btn => {
        btn.addEventListener('click', () => toggleLike(btn.dataset.postId));
    });
    
    container.querySelectorAll('.post-action[data-action="comment"]').forEach(btn => {
        btn.addEventListener('click', () => toggleComments(btn.dataset.postId));
    });
    
    container.querySelectorAll('.comment-submit').forEach(btn => {
        btn.addEventListener('click', () => addComment(btn.dataset.postId));
    });
    
    container.querySelectorAll('.post-image').forEach(img => {
        img.addEventListener('click', () => {
            window.open(img.src, '_blank');
        });
    });
}

function createPostHTML(post) {
    const author = allPlayers.find(p => p.id === post.authorId);
    const initials = author ? author.displayName.split(' ').map(n => n[0]).join('') : '?';
    const timeAgo = getTimeAgo(post.timestamp);
    
    const isLiked = post.likedBy && post.likedBy[currentUser.uid];
    const likeCount = post.likes || 0;
    const commentCount = post.comments ? Object.keys(post.comments).length : 0;
    
    let badge = '';
    if (post.type === 'report') {
        badge = '<span class="post-badge">Match Report</span>';
    }
    
    return `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-author">
                    <div class="post-avatar">${initials}</div>
                    <div class="post-author-info">
                        <h4>${post.authorName}</h4>
                        <div class="post-timestamp">${timeAgo}</div>
                    </div>
                </div>
                ${badge}
            </div>
            
            ${post.content ? `<div class="post-content">${post.content}</div>` : ''}
            
            ${post.photoData ? `<img src="${post.photoData}" alt="Post photo" class="post-image">` : ''}
            
            <div class="post-footer">
                <button class="post-action ${isLiked ? 'liked' : ''}" data-action="like" data-post-id="${post.id}">
                    <span>${isLiked ? '👍' : '👍🏻'}</span>
                    <span>${likeCount}</span>
                </button>
                <button class="post-action" data-action="comment" data-post-id="${post.id}">
                    <span>💬</span>
                    <span>${commentCount}</span>
                </button>
            </div>
            
            <div class="comments-section hidden" id="comments-${post.id}">
                ${renderComments(post)}
                <div class="comment-input-wrapper">
                    <input type="text" placeholder="Write a comment..." id="comment-input-${post.id}">
                    <button class="comment-submit" data-post-id="${post.id}">Post</button>
                </div>
            </div>
        </div>
    `;
}

function renderComments(post) {
    if (!post.comments || Object.keys(post.comments).length === 0) {
        return '';
    }
    
    return Object.entries(post.comments).map(([commentId, comment]) => {
        const author = allPlayers.find(p => p.id === comment.authorId);
        const initials = author ? author.displayName.split(' ').map(n => n[0]).join('') : '?';
        const timeAgo = getTimeAgo(comment.timestamp);
        
        return `
            <div class="comment">
                <div class="comment-avatar">${initials}</div>
                <div class="comment-content">
                    <div class="comment-author">${comment.authorName}</div>
                    <div class="comment-text">${comment.text}</div>
                    <div class="comment-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleLike(postId) {
    try {
        const post = allPosts.find(p => p.id === postId);
        const isLiked = post.likedBy && post.likedBy[currentUser.uid];
        
        const updates = {};
        if (isLiked) {
            // Unlike
            updates[`posts/${postId}/likedBy/${currentUser.uid}`] = null;
            updates[`posts/${postId}/likes`] = (post.likes || 1) - 1;
        } else {
            // Like
            updates[`posts/${postId}/likedBy/${currentUser.uid}`] = true;
            updates[`posts/${postId}/likes`] = (post.likes || 0) + 1;
        }
        
        await firebase.database().ref().update(updates);
        
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('Error updating like', 'error');
    }
}

function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    commentsSection.classList.toggle('hidden');
}

async function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    
    if (!text) return;
    
    try {
        const userData = (await firebase.database().ref(`users/${currentUser.uid}`).once('value')).val();
        
        const commentData = {
            authorId: currentUser.uid,
            authorName: userData.displayName,
            text: text,
            timestamp: new Date().toISOString()
        };
        
        await firebase.database().ref(`posts/${postId}/comments`).push(commentData);
        
        input.value = '';
        
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('Error adding comment', 'error');
    }
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffMs = now - postTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return postTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

async function loadLeagueStandings(season = '2025') {
    try {
        // Get all events for the season that count for league
        const leagueEvents = allEvents.filter(event => {
            const eventYear = new Date(event.date).getFullYear().toString();
            return eventYear === season && event.countsForLeague;
        });
        
        // Calculate points for each player
        const playerStats = {};
        
        for (const player of allPlayers) {
            playerStats[player.id] = {
                name: player.displayName,
                handicap: player.handicap,
                points: 0,
                eventsPlayed: 0
            };
        }
        
        // Calculate points from scores
        for (const event of leagueEvents) {
            if (event.scores) {
                const scores = Object.entries(event.scores);
                scores.sort((a, b) => a[1] - b[1]); // Sort by score
                
                scores.forEach(([playerId, score], index) => {
                    if (playerStats[playerId]) {
                        const points = Math.max(0, scores.length - index);
                        playerStats[playerId].points += points;
                        playerStats[playerId].eventsPlayed++;
                    }
                });
            }
        }
        
        // Convert to array and sort
        const standings = Object.entries(playerStats)
            .map(([id, stats]) => ({ id, ...stats }))
            .sort((a, b) => b.points - a.points);
        
        renderLeagueTable(standings, leagueEvents.length);
        
    } catch (error) {
        console.error('Error loading league standings:', error);
    }
}

// ===== CALENDAR RENDERING =====
function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Update month display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    // Get calendar days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const daysInPrevMonth = prevLastDay.getDate();
    
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    
    // Add day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    // Add previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        addCalendarDay(day, true, new Date(year, month - 1, day));
    }
    
    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
        addCalendarDay(day, false, new Date(year, month, day));
    }
    
    // Add next month days
    const remainingDays = 42 - calendarGrid.children.length + 7; // +7 for headers
    for (let day = 1; day <= remainingDays; day++) {
        addCalendarDay(day, true, new Date(year, month + 1, day));
    }
}

function addCalendarDay(day, otherMonth, date) {
    const calendarGrid = document.getElementById('calendarGrid');
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    if (otherMonth) {
        dayElement.classList.add('other-month');
    }
    
    // Check if it's today
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
        dayElement.classList.add('today');
    }
    
    // Check if there's an event on this day
    const hasEvent = allEvents.some(event => {
        const eventDate = new Date(event.date);
        return eventDate.toDateString() === date.toDateString();
    });
    
    if (hasEvent) {
        dayElement.classList.add('has-event');
    }
    
    dayElement.textContent = day;
    dayElement.addEventListener('click', () => {
        if (hasEvent) {
            showEventsForDate(date);
        }
    });
    
    calendarGrid.appendChild(dayElement);
}

function changeMonth(delta) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    renderCalendar();
}

function showEventsForDate(date) {
    const dateEvents = allEvents.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.toDateString() === date.toDateString();
    });
    
    if (dateEvents.length > 0) {
        openEventDetails(dateEvents[0].id);
    }
}

// ===== EVENT RENDERING =====
function renderUpcomingEvents() {
    const container = document.getElementById('upcomingEventsList');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingEvents = allEvents
        .filter(event => new Date(event.date) >= today)
        .slice(0, 5);
    
    if (upcomingEvents.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">No upcoming events</div></div>';
        return;
    }
    
    container.innerHTML = upcomingEvents.map(event => createEventCardHTML(event)).join('');
    
    // Add click handlers
    container.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', () => {
            openEventDetails(card.dataset.eventId);
        });
    });
}

function renderAllEvents() {
    filterEvents('all');
}

function filterEvents(filter) {
    const container = document.getElementById('eventsList');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let filteredEvents = [...allEvents];
    
    if (filter === 'upcoming') {
        filteredEvents = filteredEvents.filter(event => new Date(event.date) >= today);
    } else if (filter === 'past') {
        filteredEvents = filteredEvents.filter(event => new Date(event.date) < today);
    }
    
    if (filteredEvents.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏌️</div><div class="empty-state-text">No events found</div></div>';
        return;
    }
    
    container.innerHTML = filteredEvents.map(event => createEventCardHTML(event)).join('');
    
    // Add click handlers
    container.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', () => {
            openEventDetails(card.dataset.eventId);
        });
    });
}

function createEventCardHTML(event) {
    const eventDate = new Date(event.date);
    const participantCount = event.participants ? Object.keys(event.participants).length : 0;
    const isPast = eventDate < new Date();
    
    // Map venue to course image
    const courseImageMap = {
        'Conwy Golf Club': 'conwy-golf-club.jpg',
        'Manchester Golf Club': 'manchester-golf-club.jpg',
        'Dunham Forest Golf Club': 'dunham-forest.jpg',
        'Caldy Golf Club': 'caldy-golf-club.jpg',
        'Vale Royal Golf Club': 'vale-royal.jpg',
        'Porthmadog Golf Club': 'porthmadog.jpg',
        'Royal St David\'s Golf Club': 'royal-st-davids.jpg',
        'Prestatyn Golf Club': 'prestatyn-golf-club.jpg',
        'Leasowe Golf Club': 'leasowe-golf-club.jpg'
    };
    
    const courseImage = courseImageMap[event.venue] || 'logo.jpg';
    
    return `
        <div class="event-card" data-event-id="${event.id}">
            <div class="event-card-image">
                <img src="course-images/${courseImage}" alt="${event.venue}" onerror="this.src='logo.jpg'">
                ${event.countsForLeague ? '<span class="event-badge league">League Event</span>' : ''}
            </div>
            <div class="event-card-header">
                <div>
                    <div class="event-card-title">${event.name}</div>
                    <div class="event-card-date">${formatDate(eventDate)}</div>
                </div>
            </div>
            <div class="event-card-details">
                <div class="event-detail">📍 ${event.venue}</div>
                <div class="event-detail">⏰ ${event.time}</div>
                <div class="event-detail">💷 £${event.cost.toFixed(2)}</div>
            </div>
            <div class="event-participants">
                <span>${participantCount} / ${event.maxPlayers} players</span>
                <div class="event-participants-avatars">
                    ${getParticipantAvatars(event.participants)}
                </div>
            </div>
        </div>
    `;
}

function getParticipantAvatars(participants) {
    if (!participants) return '';
    
    const participantIds = Object.keys(participants).slice(0, 3);
    return participantIds.map(id => {
        const player = allPlayers.find(p => p.id === id);
        const initials = player ? player.displayName.split(' ').map(n => n[0]).join('') : '?';
        return `<div class="participant-avatar">${initials}</div>`;
    }).join('');
}

// ===== LEAGUE RENDERING =====
function renderLeagueTable(standings, totalEvents) {
    const container = document.getElementById('leagueTable');
    
    // Update stats
    document.getElementById('totalEvents').textContent = totalEvents;
    const userStanding = standings.find(s => s.id === currentUser.uid);
    if (userStanding) {
        const userPosition = standings.indexOf(userStanding) + 1;
        document.getElementById('userPosition').textContent = userPosition;
        document.getElementById('userPoints').textContent = userStanding.points;
    }
    
    // Render table
    let html = `
        <div class="league-row header">
            <div>Pos</div>
            <div>Player</div>
            <div>Points</div>
            <div>Events</div>
        </div>
    `;
    
    standings.forEach((player, index) => {
        const isCurrentUser = player.id === currentUser.uid;
        const position = index + 1;
        const positionClass = position <= 3 ? 'top3' : '';
        
        html += `
            <div class="league-row ${isCurrentUser ? 'current-user' : ''}">
                <div class="league-position ${positionClass}">${position}</div>
                <div class="league-player">
                    <div class="league-avatar">${player.name.split(' ').map(n => n[0]).join('')}</div>
                    <div>
                        <div class="league-name">${player.name}</div>
                        <div class="league-handicap">HCP: ${player.handicap}</div>
                    </div>
                </div>
                <div class="league-points">${player.points}</div>
                <div class="league-events">${player.eventsPlayed}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ===== PLAYERS RENDERING =====
function renderPlayers() {
    const container = document.getElementById('playersList');
    
    if (allPlayers.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">No players found</div></div>';
        return;
    }
    
    container.innerHTML = allPlayers.map(player => createPlayerCardHTML(player)).join('');
}

function createPlayerCardHTML(player) {
    const initials = player.displayName.split(' ').map(n => n[0]).join('');
    
    return `
        <div class="player-card">
            <div class="player-card-header">
                <div class="player-card-avatar">${initials}</div>
                <div class="player-card-info">
                    <h3>${player.displayName}</h3>
                    <div class="player-card-handicap">Handicap: ${player.handicap}</div>
                </div>
            </div>
            <div class="player-card-stats">
                <div class="player-stat">
                    <div class="player-stat-value">${player.eventsPlayed || 0}</div>
                    <div class="player-stat-label">Events</div>
                </div>
                <div class="player-stat">
                    <div class="player-stat-value">${player.leaguePoints || 0}</div>
                    <div class="player-stat-label">Points</div>
                </div>
            </div>
        </div>
    `;
}

function filterPlayers(searchTerm) {
    const filteredPlayers = allPlayers.filter(player =>
        player.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const container = document.getElementById('playersList');
    if (filteredPlayers.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No players found</div></div>';
    } else {
        container.innerHTML = filteredPlayers.map(player => createPlayerCardHTML(player)).join('');
    }
}

// ===== PROFILE RENDERING =====
function renderProfile() {
    if (!currentUser) return;
    
    firebase.database().ref(`users/${currentUser.uid}`).once('value').then(snapshot => {
        const userData = snapshot.val();
        
        // Display profile photo or initials
        updateProfilePhoto(userData);
        
        // Display basic info
        document.getElementById('profileName').textContent = userData.displayName || 'Not set';
        document.getElementById('profileEmail').textContent = userData.email || 'Not set';
        document.getElementById('profileHandicap').textContent = userData.handicap || '-';
        document.getElementById('profilePhone').textContent = userData.phone || 'Not set';
        document.getElementById('profileEventsPlayed').textContent = userData.eventsPlayed || 0;
        document.getElementById('profileLeaguePoints').textContent = userData.leaguePoints || 0;
        
        // Format and display member since date
        if (userData.joinedDate) {
            const joinDate = new Date(userData.joinedDate);
            document.getElementById('profileMemberSince').textContent = joinDate.toLocaleDateString('en-GB', { 
                month: 'long', 
                year: 'numeric' 
            });
        }
        
        // Calculate financial summary
        calculateFinancialSummary();
        
        // Load registered events
        loadRegisteredEvents();
    });
}

function calculateFinancialSummary() {
    const currentYear = new Date().getFullYear();
    
    // Get user's events for current year
    const userEvents = allEvents.filter(event => 
        event.participants && 
        event.participants[currentUser.uid] &&
        new Date(event.date).getFullYear() === currentYear
    );
    
    let totalPaid = 0;
    let totalOwed = 0;
    let totalCommitted = 0;
    
    userEvents.forEach(event => {
        const cost = event.cost || 0;
        totalCommitted += cost;
        
        if (event.participants[currentUser.uid].paid) {
            totalPaid += cost;
        } else {
            totalOwed += cost;
        }
    });
    
    document.getElementById('totalPaid').textContent = `£${totalPaid.toFixed(2)}`;
    document.getElementById('totalOwed').textContent = `£${totalOwed.toFixed(2)}`;
    document.getElementById('totalCommitted').textContent = `£${totalCommitted.toFixed(2)}`;
}

function updateProfilePhoto(userData) {
    const photoDisplay = document.getElementById('profilePhotoDisplay');
    const initialsDisplay = document.getElementById('profilePhotoInitials');
    
    if (userData.photoData) {
        // Show uploaded photo
        photoDisplay.style.background = 'none';
        photoDisplay.innerHTML = `<img src="${userData.photoData}" alt="Profile photo">`;
    } else {
        // Show initials
        const initials = getInitials(userData.displayName || userData.email || 'U');
        initialsDisplay.textContent = initials;
        photoDisplay.style.background = 'var(--primary-blue)';
    }
}

function loadRegisteredEvents() {
    const container = document.getElementById('registeredEventsList');
    
    // Get all events where user is registered
    const userEvents = allEvents.filter(event => 
        event.participants && event.participants[currentUser.uid]
    );
    
    // Update count
    const currentYear = new Date().getFullYear();
    const eventsThisYear = userEvents.filter(event => 
        new Date(event.date).getFullYear() === currentYear
    ).length;
    document.getElementById('profileEventsThisYear').textContent = eventsThisYear;
    
    if (userEvents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <div class="empty-state-text">No registered events yet</div>
            </div>
        `;
        return;
    }
    
    // Sort by date (newest first)
    userEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Set up filter listeners
    setupEventFilterListeners(userEvents);
    
    // Display all events by default
    displayFilteredEvents(userEvents, 'all');
}

function setupEventFilterListeners(userEvents) {
    const filterBtns = document.querySelectorAll('.event-filters .filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            displayFilteredEvents(userEvents, btn.dataset.filter);
        });
    });
}

function displayFilteredEvents(userEvents, filter) {
    const container = document.getElementById('registeredEventsList');
    const now = new Date();
    
    let filteredEvents = userEvents;
    
    if (filter === 'upcoming') {
        filteredEvents = userEvents.filter(event => new Date(event.date) >= now);
    } else if (filter === 'past') {
        filteredEvents = userEvents.filter(event => new Date(event.date) < now);
    }
    
    if (filteredEvents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏌️</div>
                <div class="empty-state-text">No ${filter === 'all' ? '' : filter + ' '}events</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredEvents.map(event => {
        const participant = event.participants[currentUser.uid];
        const isPaid = participant.paid;
        const eventDate = new Date(event.date);
        const isPast = eventDate < now;
        
        return `
            <div class="registered-event-item">
                <div class="registered-event-header">
                    <span class="registered-event-name">${event.name}</span>
                    <span class="payment-badge ${isPaid ? 'paid' : 'unpaid'}">
                        ${isPaid ? '✓ Paid' : 'Unpaid'}
                    </span>
                </div>
                <div class="registered-event-details">
                    <span>📅 ${formatDate(eventDate)}</span>
                    <span>📍 ${event.venue}</span>
                    <span>💰 £${event.cost.toFixed(2)}</span>
                    ${isPast ? '<span>✓ Completed</span>' : ''}
                </div>
                ${!isPaid ? `
                    <button class="mark-paid-btn" onclick="markAsPaidFromProfile('${event.id}')">
                        Mark as Paid
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function markAsPaidFromProfile(eventId) {
    try {
        await firebase.database().ref(`events/${eventId}/participants/${currentUser.uid}/paid`).set(true);
        showToast('Marked as paid', 'success');
        renderProfile(); // Refresh profile to update financial summary
    } catch (error) {
        showToast('Error updating payment status', 'error');
        console.error(error);
    }
}

function loadPaymentHistory() {
    const container = document.getElementById('paymentHistoryList');
    const userEvents = allEvents.filter(event => 
        event.participants && event.participants[currentUser.uid]
    );
    
    const paidEvents = userEvents.filter(event => 
        event.participants[currentUser.uid].paid
    );
    
    if (paidEvents.length === 0) {
        container.innerHTML = '<div class="empty-state-text">No payment history</div>';
        return;
    }
    
    container.innerHTML = paidEvents.map(event => `
        <div class="payment-item">
            <div>
                <div class="payment-event">${event.name}</div>
                <div class="payment-date">${formatDate(new Date(event.date))}</div>
            </div>
            <div class="payment-amount">£${event.cost.toFixed(2)}</div>
        </div>
    `).join('');
}

// ===== MODALS =====
function openEventModal(eventId = null) {
    const modal = document.getElementById('eventModal');
    modal.classList.add('active');
    
    if (eventId) {
        // Edit mode
        const event = allEvents.find(e => e.id === eventId);
        document.getElementById('eventModalTitle').textContent = 'Edit Event';
        document.getElementById('eventId').value = eventId;
        document.getElementById('eventName').value = event.name;
        document.getElementById('eventVenue').value = event.venue;
        document.getElementById('eventDate').value = event.date;
        document.getElementById('eventTime').value = event.time;
        document.getElementById('eventCost').value = event.cost;
        document.getElementById('eventMaxPlayers').value = event.maxPlayers;
        document.getElementById('eventDescription').value = event.description || '';
        document.getElementById('eventCountsForLeague').checked = event.countsForLeague;
    } else {
        // Add mode
        document.getElementById('eventModalTitle').textContent = 'Add Event';
        document.getElementById('eventId').value = '';
        document.getElementById('eventName').value = '';
        document.getElementById('eventVenue').value = '';
        document.getElementById('eventDate').value = '';
        document.getElementById('eventTime').value = '09:00';
        document.getElementById('eventCost').value = '';
        document.getElementById('eventMaxPlayers').value = '16';
        document.getElementById('eventDescription').value = '';
        document.getElementById('eventCountsForLeague').checked = true;
    }
}

function openEventDetails(eventId) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) return;
    
    selectedEventId = eventId;
    const modal = document.getElementById('eventDetailsModal');
    modal.classList.add('active');
    
    document.getElementById('eventDetailsTitle').textContent = event.name;
    
    const isParticipant = event.participants && event.participants[currentUser.uid];
    const isPaid = isParticipant && event.participants[currentUser.uid].paid;
    
    // Show/hide action buttons
    document.getElementById('joinEventBtn').classList.toggle('hidden', isParticipant);
    document.getElementById('leaveEventBtn').classList.toggle('hidden', !isParticipant);
    document.getElementById('markPaidBtn').classList.toggle('hidden', !isParticipant || isPaid);
    
    // Event details
    const eventDate = new Date(event.date);
    const isPast = eventDate < new Date();
    
    let detailsHTML = `
        <div class="event-card-details">
            <div class="event-detail">📍 ${event.venue}</div>
            <div class="event-detail">📅 ${formatDate(eventDate)}</div>
            <div class="event-detail">⏰ ${event.time}</div>
            <div class="event-detail">💷 £${event.cost.toFixed(2)} per player</div>
            <div class="event-detail">👥 Max ${event.maxPlayers} players</div>
            ${event.countsForLeague ? '<div class="event-detail">🏆 Counts for League</div>' : ''}
        </div>
    `;
    
    if (event.description) {
        detailsHTML += `<p style="margin-top: 16px;">${event.description}</p>`;
    }
    
    document.getElementById('eventDetailsContent').innerHTML = detailsHTML;
    
    // Participants list
    renderParticipantsList(event);
    
    // Setup button handlers
    document.getElementById('joinEventBtn').onclick = () => joinEvent(eventId);
    document.getElementById('leaveEventBtn').onclick = () => leaveEvent(eventId);
    document.getElementById('markPaidBtn').onclick = () => markAsPaid(eventId);
}

function renderParticipantsList(event) {
    const container = document.getElementById('participantsList');
    const participantCount = event.participants ? Object.keys(event.participants).length : 0;
    
    document.getElementById('participantCount').textContent = participantCount;
    
    if (participantCount === 0) {
        container.innerHTML = '<div class="empty-state-text">No participants yet</div>';
        return;
    }
    
    const participantHTML = Object.entries(event.participants).map(([userId, data]) => {
        const player = allPlayers.find(p => p.id === userId);
        
        // If player not found in allPlayers yet, try to load from Firebase
        if (!player) {
            // Show loading placeholder
            firebase.database().ref(`users/${userId}`).once('value').then(snapshot => {
                const userData = snapshot.val();
                if (userData) {
                    // Add to allPlayers
                    allPlayers.push({ id: userId, ...userData });
                    // Re-render participants list
                    renderParticipantsList(event);
                }
            });
            
            return `
                <div class="league-row">
                    <div class="league-player" style="grid-column: span 2;">
                        <div class="league-avatar">?</div>
                        <div>
                            <div class="league-name">Loading...</div>
                            <div class="league-handicap">HCP: -</div>
                        </div>
                    </div>
                    <div style="text-align: right; color: var(--text-secondary);">
                        ⏳ Pending
                    </div>
                </div>
            `;
        }
        
        const initials = player.displayName.split(' ').map(n => n[0]).join('');
        const paidStatus = data.paid ? '✓ Paid' : '⏳ Pending';
        
        return `
            <div class="league-row">
                <div class="league-player" style="grid-column: span 2;">
                    <div class="league-avatar">${initials}</div>
                    <div>
                        <div class="league-name">${player.displayName}</div>
                        <div class="league-handicap">HCP: ${player.handicap}</div>
                    </div>
                </div>
                <div style="text-align: right; color: ${data.paid ? 'var(--success-color)' : 'var(--text-secondary)'};">
                    ${paidStatus}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = participantHTML;
}

function openEditProfileModal() {
    firebase.database().ref(`users/${currentUser.uid}`).once('value').then(snapshot => {
        const userData = snapshot.val();
        document.getElementById('editProfileName').value = userData.displayName;
        document.getElementById('editProfileHandicap').value = userData.handicap;
        document.getElementById('editProfilePhone').value = userData.phone || '';
        
        document.getElementById('editProfileModal').classList.add('active');
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ===== EVENT ACTIONS =====
async function saveEvent() {
    const eventId = document.getElementById('eventId').value;
    const eventData = {
        name: document.getElementById('eventName').value,
        venue: document.getElementById('eventVenue').value,
        date: document.getElementById('eventDate').value,
        time: document.getElementById('eventTime').value,
        cost: parseFloat(document.getElementById('eventCost').value),
        maxPlayers: parseInt(document.getElementById('eventMaxPlayers').value),
        description: document.getElementById('eventDescription').value,
        countsForLeague: document.getElementById('eventCountsForLeague').checked,
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString()
    };
    
    if (!eventData.name || !eventData.venue || !eventData.date) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        if (eventId) {
            // Update existing event
            await firebase.database().ref(`events/${eventId}`).update(eventData);
            showToast('Event updated successfully', 'success');
        } else {
            // Create new event
            await firebase.database().ref('events').push(eventData);
            showToast('Event created successfully', 'success');
        }
        
        closeAllModals();
    } catch (error) {
        showToast('Error saving event', 'error');
        console.error(error);
    }
}

async function joinEvent(eventId) {
    console.log('Attempting to join event:', eventId);
    console.log('Current user:', currentUser);
    
    try {
        const participantData = {
            joinedAt: new Date().toISOString(),
            paid: false
        };
        
        console.log('Participant data:', participantData);
        console.log('Database path:', `events/${eventId}/participants/${currentUser.uid}`);
        
        await firebase.database().ref(`events/${eventId}/participants/${currentUser.uid}`).set(participantData);
        
        console.log('Successfully joined event!');
        showToast('Successfully joined event', 'success');
        
        // Reload the event data and refresh the modal
        const eventSnapshot = await firebase.database().ref(`events/${eventId}`).once('value');
        const updatedEvent = { id: eventId, ...eventSnapshot.val() };
        
        // Update the event in allEvents array
        const eventIndex = allEvents.findIndex(e => e.id === eventId);
        if (eventIndex !== -1) {
            allEvents[eventIndex] = updatedEvent;
        }
        
        // Refresh the modal to show updated participants
        openEventDetails(eventId);
        
    } catch (error) {
        console.error('Error joining event:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        showToast(`Error joining event: ${error.message}`, 'error');
    }
}

async function leaveEvent(eventId) {
    if (!confirm('Are you sure you want to leave this event?')) return;
    
    try {
        await firebase.database().ref(`events/${eventId}/participants/${currentUser.uid}`).remove();
        showToast('Left event', 'success');
        
        // Reload the event data and refresh the modal
        const eventSnapshot = await firebase.database().ref(`events/${eventId}`).once('value');
        const updatedEvent = { id: eventId, ...eventSnapshot.val() };
        
        // Update the event in allEvents array
        const eventIndex = allEvents.findIndex(e => e.id === eventId);
        if (eventIndex !== -1) {
            allEvents[eventIndex] = updatedEvent;
        }
        
        // Refresh the modal to show updated participants
        openEventDetails(eventId);
        
    } catch (error) {
        showToast('Error leaving event', 'error');
        console.error(error);
    }
}

async function markAsPaid(eventId) {
    try {
        await firebase.database().ref(`events/${eventId}/participants/${currentUser.uid}/paid`).set(true);
        showToast('Marked as paid', 'success');
        openEventDetails(eventId); // Refresh
    } catch (error) {
        showToast('Error updating payment status', 'error');
        console.error(error);
    }
}

async function saveProfile() {
    const name = document.getElementById('editProfileName').value;
    const handicap = parseFloat(document.getElementById('editProfileHandicap').value);
    const phone = document.getElementById('editProfilePhone').value;
    
    if (!name || isNaN(handicap)) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    try {
        const updates = {
            displayName: name,
            handicap: handicap
        };
        
        // Only add phone if it's provided
        if (phone && phone.trim() !== '') {
            updates.phone = phone.trim();
        }
        
        await firebase.database().ref(`users/${currentUser.uid}`).update(updates);
        
        showToast('Profile updated', 'success');
        closeAllModals();
        renderProfile();
        document.getElementById('userDisplayName').textContent = name;
    } catch (error) {
        showToast('Error updating profile', 'error');
        console.error(error);
    }
}

async function handleProfilePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast('Image must be less than 2MB', 'error');
        return;
    }
    
    try {
        showToast('Uploading photo...', 'info');
        
        // Convert to base64
        const photoData = await fileToBase64(file);
        
        // Save to Firebase
        await firebase.database().ref(`users/${currentUser.uid}`).update({
            photoData: photoData
        });
        
        showToast('Photo updated', 'success');
        renderProfile();
        
        // Reset input
        event.target.value = '';
    } catch (error) {
        showToast('Error uploading photo', 'error');
        console.error(error);
    }
}

// ===== VIEW SWITCHING =====
function switchView(viewName) {
    currentView = viewName;
    
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    const targetView = document.getElementById(`${viewName}View`);
    if (targetView) {
        targetView.classList.add('active');
        
        // Load view-specific data
        if (viewName === 'league') {
            loadLeagueStandings('2025');
        } else if (viewName === 'profile') {
            renderProfile();
        } else if (viewName === 'events') {
            // Re-render events when switching to events tab
            renderAllEvents();
        }
    }
}

// ===== UTILITY FUNCTIONS =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatDate(date) {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
}

function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return parts.map(n => n[0]).join('').toUpperCase();
}

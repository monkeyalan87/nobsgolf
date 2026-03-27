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
    
    // Submit scorecard
    document.getElementById('submitScorecardBtn').addEventListener('click', submitScorecard);
    
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
        loadLeagueStandingsV2(e.target.value);
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
        
        // Auto-seed 2026 events if database is empty
        if (allEvents.length === 0) {
            seedDefaultEvents();
            return; // Will re-trigger via the .on('value') listener
        }
        
        allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
        renderCalendar();
        renderUpcomingEvents();
        renderAllEvents();
    });
}
async function seedDefaultEvents() {
    console.log('Seeding 2026 default events...');
    const events = {
        "event_conwy": {
            name: "Conwy Golf Club",
            venue: "Conwy Golf Club",
            date: "2026-04-30",
            time: "09:00",
            cost: 45,
            maxPlayers: 16,
            description: "Championship links course on the North Wales coast with stunning views of Conwy Mountain, the estuary, and the Great Orme. Host of the 2021 Curtis Cup and Wales' only Open Qualifying venue.",
            countsForLeague: true,
            createdBy: "admin",
            createdAt: "2026-01-30T00:00:00.000Z",
        },
        "event_manchester": {
            name: "Manchester Golf Club",
            venue: "Manchester Golf Club, Middleton",
            date: "2026-05-15",
            time: "09:30",
            cost: 50,
            maxPlayers: 16,
            description: "Harry Colt masterpiece set on 247 acres of moorland and heathland. Widely regarded as Lancashire's best inland course, just 20 minutes from Manchester city centre.",
            countsForLeague: true,
            createdBy: "admin",
            createdAt: "2026-01-30T00:00:00.000Z",
        },
        "event_dunham": {
            name: "Dunham Forest Golf Club",
            venue: "Dunham Forest Golf Club",
            date: "2026-06-19",
            time: "10:00",
            cost: 40,
            maxPlayers: 16,
            description: "Parkland course set in beautiful Cheshire countryside. Challenging layout with mature trees and well-maintained greens. A hidden gem in the North West.",
            countsForLeague: true,
            createdBy: "admin",
            createdAt: "2026-01-30T00:00:00.000Z",
        },
        "event_caldy": {
            name: "Caldy Golf Club",
            venue: "Caldy Golf Club, Wirral",
            date: "2026-07-17",
            time: "09:00",
            cost: 55,
            maxPlayers: 16,
            description: "Stunning heathland/links course on the Wirral Peninsula with panoramic views over the Dee Estuary to Wales. One of England's finest courses with superb conditions year-round.",
            countsForLeague: true,
            createdBy: "admin",
            createdAt: "2026-01-30T00:00:00.000Z",
        },
        "event_valeroyal": {
            name: "Vale Royal Golf Club",
            venue: "Vale Royal Abbey Golf Club",
            date: "2026-08-28",
            time: "10:00",
            cost: 35,
            maxPlayers: 16,
            description: "Picturesque parkland course set in the grounds of the historic Vale Royal Abbey in Cheshire. Tree-lined fairways and challenging water features make for a memorable round.",
            countsForLeague: true,
            createdBy: "admin",
            createdAt: "2026-01-30T00:00:00.000Z",
        },
        "event_porthmadog": {
            name: "Annual Away Trip - Porthmadog",
            venue: "Porthmadog Golf Club",
            date: "2026-09-17",
            time: "09:00",
            cost: 40,
            maxPlayers: 16,
            description: "DAY 1 of Annual Away Trip. Traditional Welsh links course with spectacular views of Snowdonia, Harlech Castle, and Cardigan Bay. Known locally as 'The Borth', this seaside course offers a true links challenge.",
            countsForLeague: true,
            createdBy: "admin",
            createdAt: "2026-01-30T00:00:00.000Z",
        },
        "event_royalstdavids": {
            name: "Annual Away Trip - Royal St David's",
            venue: "Royal St David's Golf Club, Harlech",
            date: "2026-09-18",
            time: "09:00",
            cost: 65,
            maxPlayers: 16,
            description: "DAY 2 of Annual Away Trip. Championship links ranked in the World's Top 100. Nestled below the dramatic Harlech Castle with stunning mountain and sea views. A bucket-list course for any golfer.",
            countsForLeague: true,
            createdBy: "admin",
            createdAt: "2026-01-30T00:00:00.000Z",
        },
        "event_prestatyn": {
            name: "Prestatyn Golf Club",
            venue: "Prestatyn Golf Club",
            date: "2026-10-16",
            time: "09:30",
            cost: 40,
            maxPlayers: 16,
            description: "Classic links course on the North Wales coast. Natural terrain with challenging dunes, undulating fairways, and fast greens. Views across the Irish Sea make this a must-play venue.",
            countsForLeague: true,
            createdBy: "admin",
            createdAt: "2026-01-30T00:00:00.000Z",
        },
        "event_leasowe": {
            name: "Christmas Team Game & Lunch",
            venue: "Leasowe Golf Club",
            date: "2026-12-18",
            time: "10:00",
            cost: 45,
            maxPlayers: 20,
            description: "Season finale! Christmas team competition followed by festive lunch at the clubhouse. Links course on the Wirral with views of Liverpool Bay. A fun day to round off the year with prizes, food, and Christmas cheer!",
            countsForLeague: false,
            createdBy: "admin",
            createdAt: "2026-01-30T00:00:00.000Z",
        }
    };
    
    try {
        const updates = {};
        for (const [key, event] of Object.entries(events)) {
            updates[`events/${key}`] = event;
        }
        await firebase.database().ref().update(updates);
        console.log('2026 events seeded successfully');
        showToast('2026 season events loaded', 'success');
    } catch (error) {
        console.error('Error seeding events:', error);
        showToast('Error loading events: ' + error.message, 'error');
    }
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
            // Prefer scorecards (new system) over legacy scores
            if (event.scorecards) {
                const scores = Object.entries(event.scorecards)
                    .filter(([, card]) => card.stableford > 0)
                    .map(([playerId, card]) => ({ playerId, stableford: card.stableford }))
                    .sort((a, b) => b.stableford - a.stableford); // Highest Stableford first
                
                scores.forEach(({ playerId }, index) => {
                    if (playerStats[playerId]) {
                        const points = Math.max(0, scores.length - index);
                        playerStats[playerId].points += points;
                        playerStats[playerId].eventsPlayed++;
                    }
                });
            } else if (event.scores) {
                // Legacy: scores stored as stableford points (higher = better)
                const scores = Object.entries(event.scores);
                scores.sort((a, b) => b[1] - a[1]); // Highest stableford first
                
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
    
    // Show course data if available
    const course = findCourseData(event.venue);
    if (course) {
        detailsHTML += `
            <div style="display:flex; justify-content:space-around; background:#f0f8ff; border-radius:8px; padding:8px; margin-top:12px; font-size:13px; font-weight:600; color:var(--primary-blue);">
                <span>Par ${course.par}</span>
                <span>CR ${course.courseRating}</span>
                <span>Slope ${course.slope}</span>
            </div>
        `;
    }
    
    if (event.description) {
        detailsHTML += `<p style="margin-top: 16px;">${event.description}</p>`;
    }
    
    document.getElementById('eventDetailsContent').innerHTML = detailsHTML;
    
    // Participants list
    renderParticipantsList(event);
    
    // Render scores section
    renderEventScoresSummary(event);
    
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
    // Stop live scoreboard listener when closing event details
    if (liveScoreboardRef) {
        liveScoreboardRef.off();
        liveScoreboardRef = null;
    }
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
            loadLeagueStandingsV2('2026');
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
// ===== COURSE DATA =====
// Par, Stroke Index per hole + Course Rating & Slope for yellow tees
const COURSE_DATA = {
    'Conwy Golf Club': {
        courseRating: 71.0, slope: 133, par: 72,
        holes: [
            { par: 4, si: 13 }, { par: 3, si: 15 }, { par: 4, si: 9 },
            { par: 4, si: 5 },  { par: 4, si: 1 },  { par: 3, si: 17 },
            { par: 4, si: 7 },  { par: 4, si: 3 },  { par: 5, si: 11 },
            { par: 5, si: 10 }, { par: 4, si: 4 },  { par: 5, si: 6 },
            { par: 3, si: 12 }, { par: 5, si: 16 }, { par: 3, si: 18 },
            { par: 4, si: 8 },  { par: 4, si: 2 },  { par: 4, si: 14 }
        ]
    },
    'Manchester Golf Club': {
        courseRating: 70.0, slope: 128, par: 72,
        holes: [
            { par: 4, si: 11 }, { par: 4, si: 5 },  { par: 3, si: 17 },
            { par: 4, si: 3 },  { par: 5, si: 9 },  { par: 4, si: 13 },
            { par: 4, si: 7 },  { par: 3, si: 15 }, { par: 5, si: 1 },
            { par: 4, si: 6 },  { par: 4, si: 12 }, { par: 4, si: 2 },
            { par: 3, si: 16 }, { par: 4, si: 10 }, { par: 4, si: 4 },
            { par: 3, si: 18 }, { par: 4, si: 8 },  { par: 4, si: 14 }
        ]
    },
    'Manchester Golf Club, Middleton': {
        courseRating: 70.0, slope: 128, par: 72,
        holes: [
            { par: 4, si: 11 }, { par: 4, si: 5 },  { par: 3, si: 17 },
            { par: 4, si: 3 },  { par: 5, si: 9 },  { par: 4, si: 13 },
            { par: 4, si: 7 },  { par: 3, si: 15 }, { par: 5, si: 1 },
            { par: 4, si: 6 },  { par: 4, si: 12 }, { par: 4, si: 2 },
            { par: 3, si: 16 }, { par: 4, si: 10 }, { par: 4, si: 4 },
            { par: 3, si: 18 }, { par: 4, si: 8 },  { par: 4, si: 14 }
        ]
    },
    'Dunham Forest Golf Club': {
        courseRating: 70.9, slope: 143, par: 72,
        holes: [
            { par: 4, si: 7 },  { par: 3, si: 15 }, { par: 4, si: 11 },
            { par: 5, si: 3 },  { par: 4, si: 1 },  { par: 4, si: 13 },
            { par: 4, si: 5 },  { par: 3, si: 17 }, { par: 5, si: 9 },
            { par: 4, si: 4 },  { par: 4, si: 10 }, { par: 5, si: 2 },
            { par: 3, si: 18 }, { par: 4, si: 8 },  { par: 4, si: 6 },
            { par: 4, si: 14 }, { par: 3, si: 16 }, { par: 5, si: 12 }
        ]
    },
    'Caldy Golf Club': {
        courseRating: 71.3, slope: 130, par: 72,
        holes: [
            { par: 5, si: 11 }, { par: 4, si: 7 },  { par: 4, si: 3 },
            { par: 4, si: 13 }, { par: 3, si: 17 }, { par: 4, si: 5 },
            { par: 4, si: 1 },  { par: 3, si: 15 }, { par: 5, si: 9 },
            { par: 4, si: 4 },  { par: 4, si: 10 }, { par: 4, si: 2 },
            { par: 4, si: 12 }, { par: 3, si: 18 }, { par: 5, si: 6 },
            { par: 4, si: 8 },  { par: 4, si: 14 }, { par: 3, si: 16 }
        ]
    },
    'Caldy Golf Club, Wirral': {
        courseRating: 71.3, slope: 130, par: 72,
        holes: [
            { par: 5, si: 11 }, { par: 4, si: 7 },  { par: 4, si: 3 },
            { par: 4, si: 13 }, { par: 3, si: 17 }, { par: 4, si: 5 },
            { par: 4, si: 1 },  { par: 3, si: 15 }, { par: 5, si: 9 },
            { par: 4, si: 4 },  { par: 4, si: 10 }, { par: 4, si: 2 },
            { par: 4, si: 12 }, { par: 3, si: 18 }, { par: 5, si: 6 },
            { par: 4, si: 8 },  { par: 4, si: 14 }, { par: 3, si: 16 }
        ]
    },
    'Vale Royal Abbey Golf Club': {
        courseRating: 69.8, slope: 125, par: 72,
        holes: [
            { par: 4, si: 5 },  { par: 4, si: 9 },  { par: 3, si: 17 },
            { par: 5, si: 3 },  { par: 4, si: 7 },  { par: 4, si: 11 },
            { par: 4, si: 1 },  { par: 3, si: 15 }, { par: 5, si: 13 },
            { par: 4, si: 6 },  { par: 4, si: 4 },  { par: 5, si: 10 },
            { par: 3, si: 18 }, { par: 4, si: 2 },  { par: 4, si: 12 },
            { par: 4, si: 8 },  { par: 3, si: 16 }, { par: 4, si: 14 }
        ]
    },
    'Porthmadog Golf Club': {
        courseRating: 69.2, slope: 120, par: 71,
        holes: [
            { par: 4, si: 10 }, { par: 4, si: 4 },  { par: 4, si: 14 },
            { par: 4, si: 2 },  { par: 3, si: 16 }, { par: 4, si: 8 },
            { par: 5, si: 6 },  { par: 4, si: 12 }, { par: 3, si: 18 },
            { par: 4, si: 3 },  { par: 3, si: 15 }, { par: 4, si: 1 },
            { par: 4, si: 11 }, { par: 4, si: 5 },  { par: 5, si: 7 },
            { par: 3, si: 17 }, { par: 5, si: 9 },  { par: 4, si: 13 }
        ]
    },
    "Royal St David's Golf Club": {
        courseRating: 72.0, slope: 129, par: 69,
        holes: [
            { par: 4, si: 9 },  { par: 4, si: 3 },  { par: 4, si: 1 },
            { par: 4, si: 11 }, { par: 4, si: 7 },  { par: 4, si: 13 },
            { par: 4, si: 5 },  { par: 5, si: 15 }, { par: 3, si: 17 },
            { par: 4, si: 4 },  { par: 4, si: 10 }, { par: 4, si: 2 },
            { par: 4, si: 8 },  { par: 3, si: 14 }, { par: 4, si: 6 },
            { par: 4, si: 12 }, { par: 4, si: 16 }, { par: 3, si: 18 }
        ]
    },
    "Royal St David's Golf Club, Harlech": {
        courseRating: 72.0, slope: 129, par: 69,
        holes: [
            { par: 4, si: 9 },  { par: 4, si: 3 },  { par: 4, si: 1 },
            { par: 4, si: 11 }, { par: 4, si: 7 },  { par: 4, si: 13 },
            { par: 4, si: 5 },  { par: 5, si: 15 }, { par: 3, si: 17 },
            { par: 4, si: 4 },  { par: 4, si: 10 }, { par: 4, si: 2 },
            { par: 4, si: 8 },  { par: 3, si: 14 }, { par: 4, si: 6 },
            { par: 4, si: 12 }, { par: 4, si: 16 }, { par: 3, si: 18 }
        ]
    },
    'Prestatyn Golf Club': {
        courseRating: 71.0, slope: 128, par: 72,
        holes: [
            { par: 4, si: 5 },  { par: 4, si: 11 }, { par: 5, si: 3 },
            { par: 3, si: 17 }, { par: 4, si: 7 },  { par: 4, si: 1 },
            { par: 4, si: 13 }, { par: 4, si: 9 },  { par: 5, si: 15 },
            { par: 3, si: 14 }, { par: 4, si: 4 },  { par: 4, si: 8 },
            { par: 4, si: 10 }, { par: 4, si: 2 },  { par: 3, si: 18 },
            { par: 5, si: 6 },  { par: 4, si: 12 }, { par: 3, si: 16 }
        ]
    },
    'Leasowe Golf Club': {
        courseRating: 70.1, slope: 131, par: 71,
        holes: [
            { par: 4, si: 17 }, { par: 4, si: 9 },  { par: 3, si: 13 },
            { par: 4, si: 1 },  { par: 4, si: 7 },  { par: 5, si: 11 },
            { par: 4, si: 5 },  { par: 4, si: 15 }, { par: 4, si: 3 },
            { par: 4, si: 4 },  { par: 4, si: 16 }, { par: 3, si: 18 },
            { par: 4, si: 8 },  { par: 4, si: 14 }, { par: 4, si: 6 },
            { par: 4, si: 2 },  { par: 3, si: 10 }, { par: 4, si: 12 }
        ]
    }
};
// ===== STABLEFORD CALCULATION ENGINE =====
function getCourseHandicap(handicapIndex, slope) {
    return Math.round(handicapIndex * slope / 113);
}
function getStrokesForHole(courseHandicap, holeSI) {
    // Full strokes: how many times does the SI fit in 18 allocations
    let strokes = 0;
    if (courseHandicap >= holeSI) strokes++;
    if (courseHandicap >= 18 + holeSI) strokes++;
    if (courseHandicap >= 36 + holeSI) strokes++;
    return strokes;
}
function calculateStablefordPoints(grossScore, par, strokesReceived) {
    if (!grossScore || grossScore <= 0) return 0;
    const netScore = grossScore - strokesReceived;
    const diff = netScore - par;
    // 2 = par, +1 per under, -1 per over, min 0
    const points = Math.max(0, 2 - diff);
    return points;
}
function getScoreClass(grossScore, par) {
    if (!grossScore) return '';
    const diff = grossScore - par;
    if (diff <= -2) return 'score-eagle';
    if (diff === -1) return 'score-birdie';
    if (diff === 0) return 'score-par';
    if (diff === 1) return 'score-bogey';
    return 'score-double';
}
function getPointsClass(pts) {
    if (pts >= 5) return 'pts-5';
    if (pts >= 4) return 'pts-4';
    if (pts >= 3) return 'pts-3';
    if (pts >= 2) return 'pts-2';
    if (pts >= 1) return 'pts-1';
    return 'pts-0';
}
// ===== SOCIETY AUTO-HANDICAP RULES =====
function getHandicapChange(stablefordPoints, isWinner = false) {
    let change = 0;
    if (stablefordPoints <= 17) change = 2;
    else if (stablefordPoints <= 29) change = 1;
    else if (stablefordPoints <= 37) change = 0;
    else if (stablefordPoints <= 42) change = -1;
    else change = -2; // 43+
    
    if (isWinner) change -= 1; // Event winner gets additional -1
    return change;
}
function getHandicapChangeText(stablefordPoints, isWinner = false) {
    const baseChange = getHandicapChange(stablefordPoints, false);
    const totalChange = getHandicapChange(stablefordPoints, isWinner);
    
    let text = `${stablefordPoints} Stableford points → `;
    
    if (baseChange > 0) text += `+${baseChange}`;
    else if (baseChange === 0) text += 'No change';
    else text += `${baseChange}`;
    
    if (isWinner) {
        text += ` (+ Winner bonus: -1) = ${totalChange > 0 ? '+' : ''}${totalChange}`;
    }
    
    return text;
}
// ===== FIND COURSE DATA =====
function findCourseData(venue) {
    // Direct match first
    if (COURSE_DATA[venue]) return COURSE_DATA[venue];
    
    // Partial match
    const venueLower = venue.toLowerCase();
    for (const [key, data] of Object.entries(COURSE_DATA)) {
        if (venueLower.includes(key.toLowerCase()) || key.toLowerCase().includes(venueLower)) {
            return data;
        }
    }
    
    // Try matching first word(s)
    const venueWords = venueLower.split(' ').slice(0, 2).join(' ');
    for (const [key, data] of Object.entries(COURSE_DATA)) {
        if (key.toLowerCase().startsWith(venueWords)) {
            return data;
        }
    }
    
    return null;
}
// ===== SCORECARD MODAL LOGIC =====
let currentScorecardEventId = null;
let currentScorecardCourseData = null;
let currentScorecardCourseHcp = 0;
let scorecardScores = new Array(18).fill(null);
function openScorecardModal(eventId) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) return;
    
    const courseData = findCourseData(event.venue);
    if (!courseData) {
        showToast('Course data not available for ' + event.venue, 'error');
        return;
    }
    
    currentScorecardEventId = eventId;
    currentScorecardCourseData = courseData;
    scorecardScores = new Array(18).fill(null);
    
    // Get player's handicap
    firebase.database().ref(`users/${currentUser.uid}`).once('value').then(snapshot => {
        const userData = snapshot.val();
        const handicapIndex = userData.handicap || 18;
        currentScorecardCourseHcp = getCourseHandicap(handicapIndex, courseData.slope);
        
        // Check for existing scorecard
        if (event.scorecards && event.scorecards[currentUser.uid]) {
            const existing = event.scorecards[currentUser.uid];
            if (existing.holeScores) {
                scorecardScores = [...existing.holeScores];
            }
        }
        
        // Update header info
        document.getElementById('scorecardCourse').textContent = event.venue.split(',')[0];
        document.getElementById('scorecardHcpIndex').textContent = handicapIndex.toFixed(1);
        document.getElementById('scorecardCourseHcp').textContent = currentScorecardCourseHcp;
        document.getElementById('scorecardModalTitle').textContent = 'Enter Scorecard';
        
        // Build scorecard grid
        buildScorecardGrid('scorecardFront9', 0, 9);
        buildScorecardGrid('scorecardBack9', 9, 18);
        
        // Set front/back par
        const front9Par = courseData.holes.slice(0, 9).reduce((s, h) => s + h.par, 0);
        const back9Par = courseData.holes.slice(9, 18).reduce((s, h) => s + h.par, 0);
        document.getElementById('front9Par').textContent = front9Par;
        document.getElementById('back9Par').textContent = back9Par;
        document.getElementById('totalPar').textContent = courseData.par;
        
        updateScorecardTotals();
        
        // Show modal
        document.getElementById('scorecardModal').classList.add('active');
    });
}
function buildScorecardGrid(containerId, startHole, endHole) {
    const container = document.getElementById(containerId);
    const courseData = currentScorecardCourseData;
    
    let html = '';
    for (let i = startHole; i < endHole; i++) {
        const hole = courseData.holes[i];
        const strokes = getStrokesForHole(currentScorecardCourseHcp, hole.si);
        const strokeDots = strokes > 0 ? '•'.repeat(strokes) : '';
        const existingScore = scorecardScores[i];
        const scoreClass = existingScore ? getScoreClass(existingScore, hole.par) : '';
        
        html += `
            <div class="scorecard-hole">
                <div class="hole-number">${i + 1}</div>
                <div class="hole-par">P${hole.par}</div>
                <div class="hole-si">SI ${hole.si}</div>
                <div class="hole-strokes">${strokeDots}</div>
                <input type="number" 
                    class="hole-score-input ${scoreClass}" 
                    id="holeScore${i}" 
                    min="1" max="15" 
                    inputmode="numeric"
                    pattern="[0-9]*"
                    value="${existingScore || ''}"
                    data-hole="${i}"
                    onfocus="this.select()"
                    oninput="handleScoreInput(this, ${i})">
                <div class="hole-points ${existingScore ? getPointsClass(calculateStablefordPoints(existingScore, hole.par, getStrokesForHole(currentScorecardCourseHcp, hole.si))) : 'pts-0'}" id="holePoints${i}">
                    ${existingScore ? calculateStablefordPoints(existingScore, hole.par, getStrokesForHole(currentScorecardCourseHcp, hole.si)) : '-'}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}
let scoreSaveTimeout = null;

function handleScoreInput(input, holeIndex) {
    let val = parseInt(input.value);
    if (isNaN(val) || val < 1) {
        scorecardScores[holeIndex] = null;
    } else {
        if (val > 15) val = 15;
        scorecardScores[holeIndex] = val;
    }
    
    const hole = currentScorecardCourseData.holes[holeIndex];
    const strokes = getStrokesForHole(currentScorecardCourseHcp, hole.si);
    const points = scorecardScores[holeIndex] ? calculateStablefordPoints(scorecardScores[holeIndex], hole.par, strokes) : 0;
    
    // Update score color
    input.className = 'hole-score-input ' + (scorecardScores[holeIndex] ? getScoreClass(scorecardScores[holeIndex], hole.par) : '');
    
    // Update points
    const pointsEl = document.getElementById(`holePoints${holeIndex}`);
    pointsEl.textContent = scorecardScores[holeIndex] ? points : '-';
    pointsEl.className = 'hole-points ' + (scorecardScores[holeIndex] ? getPointsClass(points) : 'pts-0');
    
    updateScorecardTotals();
    
    // Auto-advance to next hole
    if (scorecardScores[holeIndex] && holeIndex < 17) {
        const nextInput = document.getElementById(`holeScore${holeIndex + 1}`);
        if (nextInput && input.value.length >= 1) {
            setTimeout(() => nextInput.focus(), 150);
        }
    }
    
    // Auto-save to Firebase after short debounce (live scoring)
    if (scoreSaveTimeout) clearTimeout(scoreSaveTimeout);
    scoreSaveTimeout = setTimeout(() => autoSaveScorecard(), 600);
}

async function autoSaveScorecard() {
    if (!currentScorecardEventId || !currentScorecardCourseData) return;
    
    const courseData = currentScorecardCourseData;
    let totalPoints = 0;
    let totalGross = 0;
    let holesCompleted = 0;
    
    for (let i = 0; i < 18; i++) {
        const score = scorecardScores[i];
        if (score) {
            const hole = courseData.holes[i];
            const strokes = getStrokesForHole(currentScorecardCourseHcp, hole.si);
            totalPoints += calculateStablefordPoints(score, hole.par, strokes);
            totalGross += score;
            holesCompleted++;
        }
    }
    
    try {
        const scorecardData = {
            holeScores: scorecardScores,
            totalGross: totalGross,
            stablefordPoints: totalPoints,
            holesCompleted: holesCompleted,
            courseHandicap: currentScorecardCourseHcp,
            handicapIndex: parseFloat(document.getElementById('scorecardHcpIndex').textContent),
            isFinalized: false,
            lastUpdated: new Date().toISOString()
        };
        
        await firebase.database().ref(`events/${currentScorecardEventId}/scorecards/${currentUser.uid}`).set(scorecardData);
        
        // Also save stableford for legacy league compatibility
        await firebase.database().ref(`events/${currentScorecardEventId}/scores/${currentUser.uid}`).set(totalPoints);
        
        // Brief save indicator
        const saveIndicator = document.getElementById('liveSaveStatus');
        if (saveIndicator) {
            saveIndicator.textContent = '✓ Saved';
            saveIndicator.className = 'live-save-status saved';
            setTimeout(() => {
                saveIndicator.textContent = 'Live';
                saveIndicator.className = 'live-save-status live';
            }, 1500);
        }
    } catch (error) {
        console.error('Auto-save error:', error);
        const saveIndicator = document.getElementById('liveSaveStatus');
        if (saveIndicator) {
            saveIndicator.textContent = '✗ Error';
            saveIndicator.className = 'live-save-status error';
        }
    }
}
function updateScorecardTotals() {
    const courseData = currentScorecardCourseData;
    let front9Gross = 0, back9Gross = 0;
    let front9Points = 0, back9Points = 0;
    let totalGross = 0, totalPoints = 0;
    let holesCompleted = 0;
    
    for (let i = 0; i < 18; i++) {
        const score = scorecardScores[i];
        if (score) {
            const hole = courseData.holes[i];
            const strokes = getStrokesForHole(currentScorecardCourseHcp, hole.si);
            const pts = calculateStablefordPoints(score, hole.par, strokes);
            
            if (i < 9) {
                front9Gross += score;
                front9Points += pts;
            } else {
                back9Gross += score;
                back9Points += pts;
            }
            totalGross += score;
            totalPoints += pts;
            holesCompleted++;
        }
    }
    
    document.getElementById('front9Gross').textContent = front9Gross || '-';
    document.getElementById('front9Points').textContent = front9Points;
    document.getElementById('back9Gross').textContent = back9Gross || '-';
    document.getElementById('back9Points').textContent = back9Points;
    document.getElementById('totalGross').textContent = totalGross || '-';
    document.getElementById('totalStableford').textContent = totalPoints;
    
    // Running totals
    document.getElementById('runningStableford').textContent = totalPoints;
    document.getElementById('runningGross').textContent = totalGross || '-';
    
    const vsPar = totalGross - courseData.holes.slice(0, holesCompleted).reduce((s, h) => s + h.par, 0);
    const vsParEl = document.getElementById('runningVsPar');
    if (holesCompleted === 0) {
        vsParEl.textContent = 'E';
    } else {
        vsParEl.textContent = vsPar === 0 ? 'E' : (vsPar > 0 ? `+${vsPar}` : `${vsPar}`);
        vsParEl.style.color = vsPar < 0 ? 'var(--success-color)' : vsPar > 0 ? 'var(--error-color)' : '';
    }
    
    // Handicap preview
    const previewEl = document.getElementById('handicapChangePreview');
    const detailEl = document.getElementById('hcpPreviewDetail');
    
    if (holesCompleted === 18) {
        previewEl.classList.remove('hidden');
        const change = getHandicapChange(totalPoints, false);
        const changeText = getHandicapChangeText(totalPoints, false);
        
        const currentHcp = parseFloat(document.getElementById('scorecardHcpIndex').textContent);
        const newHcp = Math.max(0, currentHcp + change);
        
        let colorClass = change > 0 ? 'hcp-change-positive' : change < 0 ? 'hcp-change-negative' : 'hcp-change-neutral';
        
        detailEl.innerHTML = `
            <div>${changeText}</div>
            <div class="${colorClass}" style="font-size: 18px; margin-top: 6px;">
                ${currentHcp.toFixed(1)} → ${newHcp.toFixed(1)}
                (${change > 0 ? '+' : ''}${change})
            </div>
        `;
    } else {
        previewEl.classList.add('hidden');
    }
}
async function submitScorecard() {
    const holesCompleted = scorecardScores.filter(s => s !== null).length;
    
    if (holesCompleted < 18) {
        if (!confirm(`You've completed ${holesCompleted}/18 holes. Finalize round anyway? (Handicap adjustment only applies to full 18-hole rounds.)`)) return;
    }
    
    const courseData = currentScorecardCourseData;
    let totalPoints = 0;
    let totalGross = 0;
    
    for (let i = 0; i < 18; i++) {
        const score = scorecardScores[i];
        if (score) {
            const hole = courseData.holes[i];
            const strokes = getStrokesForHole(currentScorecardCourseHcp, hole.si);
            totalPoints += calculateStablefordPoints(score, hole.par, strokes);
            totalGross += score;
        }
    }
    
    try {
        // Save finalized scorecard
        const scorecardData = {
            holeScores: scorecardScores,
            totalGross: totalGross,
            stablefordPoints: totalPoints,
            holesCompleted: holesCompleted,
            courseHandicap: currentScorecardCourseHcp,
            handicapIndex: parseFloat(document.getElementById('scorecardHcpIndex').textContent),
            isFinalized: true,
            submittedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };
        
        await firebase.database().ref(`events/${currentScorecardEventId}/scorecards/${currentUser.uid}`).set(scorecardData);
        await firebase.database().ref(`events/${currentScorecardEventId}/scores/${currentUser.uid}`).set(totalPoints);
        
        // Apply handicap adjustment if all 18 holes completed
        if (holesCompleted === 18) {
            await applyHandicapAdjustment(totalPoints, currentScorecardEventId);
        }
        
        showToast(`Round finalized! ${totalPoints} Stableford points`, 'success');
        
        // Stop the live listener for this event's scorecards
        if (liveScoreboardRef) {
            liveScoreboardRef.off();
            liveScoreboardRef = null;
        }
        
        closeAllModals();
        openEventDetails(currentScorecardEventId);
        
    } catch (error) {
        console.error('Error finalizing scorecard:', error);
        showToast('Error finalizing scorecard', 'error');
    }
}
async function applyHandicapAdjustment(stablefordPoints, eventId) {
    try {
        const userRef = firebase.database().ref(`users/${currentUser.uid}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        const currentHandicap = userData.handicap || 18;
        
        // Check if this player is the winner (determined later when all scorecards are in)
        // For now, apply base change only. Winner bonus applied separately.
        const change = getHandicapChange(stablefordPoints, false);
        const newHandicap = Math.max(0, Math.min(54, currentHandicap + change));
        
        if (change !== 0) {
            await userRef.update({ handicap: newHandicap });
            
            // Log the adjustment
            await firebase.database().ref(`handicapHistory/${currentUser.uid}`).push({
                eventId: eventId,
                date: new Date().toISOString(),
                stablefordPoints: stablefordPoints,
                previousHandicap: currentHandicap,
                newHandicap: newHandicap,
                change: change,
                isWinnerBonus: false
            });
            
            const changeText = change > 0 ? `+${change}` : `${change}`;
            showToast(`Handicap adjusted: ${currentHandicap.toFixed(1)} → ${newHandicap.toFixed(1)} (${changeText})`, change > 0 ? 'error' : 'success');
        }
    } catch (error) {
        console.error('Error applying handicap adjustment:', error);
    }
}
// ===== LIVE LEADERBOARD =====
let liveScoreboardRef = null;

function renderEventScoresSummary(event) {
    const container = document.getElementById('eventScoresSummary');
    const enterBtn = document.getElementById('enterScorecardBtn');
    const viewBtn = document.getElementById('viewScorecardBtn');
    
    const isParticipant = event.participants && event.participants[currentUser.uid];
    const courseData = findCourseData(event.venue);
    const hasSubmitted = event.scorecards && event.scorecards[currentUser.uid];
    const eventDate = new Date(event.date);
    const isPast = eventDate < new Date();
    const isEventDay = isToday(eventDate);
    
    // Show enter scorecard button - available on event day, day after, or any past event
    if (isParticipant && courseData && (isPast || isEventDay)) {
        enterBtn.classList.remove('hidden');
        const isFinalized = hasSubmitted && event.scorecards[currentUser.uid].isFinalized;
        if (isFinalized) {
            enterBtn.textContent = '📋 View Scorecard';
        } else if (hasSubmitted) {
            enterBtn.textContent = '🏌️ Continue Round';
        } else {
            enterBtn.textContent = '🏌️ Start Round';
        }
        enterBtn.onclick = () => openScorecardModal(event.id);
    } else {
        enterBtn.classList.add('hidden');
    }
    
    // View scorecard button (for finalized rounds)
    if (hasSubmitted && event.scorecards[currentUser.uid].isFinalized) {
        viewBtn.classList.remove('hidden');
        viewBtn.onclick = () => openScorecardModal(event.id);
    } else {
        viewBtn.classList.add('hidden');
    }
    
    // Set up real-time listener for live leaderboard on event day
    if (liveScoreboardRef) {
        liveScoreboardRef.off();
        liveScoreboardRef = null;
    }
    
    if (isEventDay || isPast) {
        liveScoreboardRef = firebase.database().ref(`events/${event.id}/scorecards`);
        liveScoreboardRef.on('value', (snapshot) => {
            const liveScorecards = snapshot.val() || {};
            renderLiveLeaderboard(container, liveScorecards, courseData, isEventDay, event);
        });
    } else {
        // No scores yet for future events
        if (courseData) {
            container.innerHTML = '<div style="text-align:center; color:var(--text-secondary); padding:12px; font-size:13px;">Live leaderboard available on event day</div>';
        } else {
            container.innerHTML = '<div style="text-align:center; color:var(--text-secondary); padding:12px; font-size:13px;">Course data not available for scoring</div>';
        }
    }
}

function renderLiveLeaderboard(container, scorecards, courseData, isLive, event) {
    if (!scorecards || Object.keys(scorecards).length === 0) {
        if (isLive) {
            container.innerHTML = `
                <div style="text-align:center; padding:16px;">
                    <div class="live-badge">● LIVE</div>
                    <div style="color:var(--text-secondary); font-size:13px; margin-top:8px;">Waiting for scores...</div>
                </div>`;
        } else {
            container.innerHTML = '<div style="text-align:center; color:var(--text-secondary); padding:12px;">No scorecards submitted yet</div>';
        }
        return;
    }
    
    // Build leaderboard entries
    const entries = Object.entries(scorecards)
        .map(([playerId, data]) => {
            const player = allPlayers.find(p => p.id === playerId);
            const holesCompleted = data.holesCompleted || (data.holeScores ? data.holeScores.filter(s => s !== null && s > 0).length : 0);
            return {
                playerId,
                name: player ? player.displayName : 'Unknown',
                stablefordPoints: data.stablefordPoints || 0,
                totalGross: data.totalGross || 0,
                courseHandicap: data.courseHandicap || 0,
                holesCompleted: holesCompleted,
                isFinalized: data.isFinalized || false,
                lastUpdated: data.lastUpdated || ''
            };
        })
        .sort((a, b) => {
            // Sort by: finalized first, then stableford desc, then holes completed desc
            if (a.isFinalized !== b.isFinalized) return b.isFinalized - a.isFinalized;
            if (b.stablefordPoints !== a.stablefordPoints) return b.stablefordPoints - a.stablefordPoints;
            return b.holesCompleted - a.holesCompleted;
        });
    
    let html = '';
    
    // Live badge
    const anyActive = entries.some(e => !e.isFinalized && e.holesCompleted > 0);
    if (isLive || anyActive) {
        html += '<div class="live-badge">● LIVE</div>';
    }
    
    html += `
        <div class="scores-leaderboard">
            <div class="score-leaderboard-row header">
                <span>#</span>
                <span>Player</span>
                <span>Thru</span>
                <span>Pts</span>
            </div>
    `;
    
    entries.forEach((sc, index) => {
        const posClass = index === 0 ? 'pos-1' : index === 1 ? 'pos-2' : index === 2 ? 'pos-3' : '';
        const isMe = sc.playerId === currentUser.uid;
        const thruText = sc.isFinalized ? 'F' : sc.holesCompleted > 0 ? sc.holesCompleted : '-';
        const thruClass = sc.isFinalized ? 'thru-final' : sc.holesCompleted > 0 ? 'thru-active' : 'thru-waiting';
        
        // Time since last update
        let lastUpdateText = '';
        if (!sc.isFinalized && sc.lastUpdated && sc.holesCompleted > 0) {
            const mins = Math.floor((Date.now() - new Date(sc.lastUpdated).getTime()) / 60000);
            if (mins < 2) lastUpdateText = 'just now';
            else if (mins < 60) lastUpdateText = `${mins}m ago`;
        }
        
        html += `
            <div class="score-leaderboard-row ${isMe ? 'current-user' : ''}">
                <span class="score-position ${posClass}">${index + 1}</span>
                <span class="score-player-name">
                    ${sc.name} 
                    <small style="color:var(--text-secondary);">(${sc.courseHandicap})</small>
                    ${lastUpdateText ? `<span class="last-update-badge">${lastUpdateText}</span>` : ''}
                </span>
                <span class="score-thru ${thruClass}">${thruText}</span>
                <span class="score-stableford">${sc.stablefordPoints}</span>
            </div>
        `;
    });
    
    html += `</div>`;
    
    // Handicap rules info
    html += `<div style="text-align: center; margin-top: 8px;">
        <button class="hcp-info-btn" onclick="document.getElementById('handicapRulesModal').classList.add('active')" title="View handicap rules">ℹ</button>
        <span style="font-size: 12px; color: var(--text-secondary); margin-left: 4px;">Auto-handicap rules</span>
    </div>`;
    
    container.innerHTML = html;
}
function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}
// ===== UPDATE LEAGUE STANDINGS TO USE STABLEFORD =====
// ===== ORDER OF MERIT POINTS TABLE =====
const OOM_POINTS = [15, 12, 10, 8, 6, 5, 4, 3, 2, 1]; // Positions 1-10
const OOM_BEST_OF = 5; // Best 5 event scores count
async function loadLeagueStandingsV2(season = '2026') {
    try {
        const leagueEvents = allEvents.filter(event => {
            const eventYear = new Date(event.date).getFullYear().toString();
            return eventYear === season && event.countsForLeague;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Build per-event results: for each event, rank players by Stableford and assign OOM points
        const playerEventPoints = {}; // { playerId: [{ eventId, eventName, stableford, oomPoints, position, isCounted }] }
        
        for (const player of allPlayers) {
            playerEventPoints[player.id] = [];
        }
        
        for (const event of leagueEvents) {
            let rankedPlayers = [];
            
            // Get Stableford scores from scorecards (preferred) or legacy scores
            if (event.scorecards) {
                rankedPlayers = Object.entries(event.scorecards)
                    .map(([playerId, data]) => ({
                        playerId,
                        stableford: data.stablefordPoints || data.stableford || 0
                    }))
                    .filter(p => p.stableford > 0)
                    .sort((a, b) => b.stableford - a.stableford);
            } else if (event.scores) {
                rankedPlayers = Object.entries(event.scores)
                    .map(([playerId, stableford]) => ({ playerId, stableford }))
                    .filter(p => p.stableford > 0)
                    .sort((a, b) => b.stableford - a.stableford);
            }
            
            // Assign OOM points by position (top 10 only)
            rankedPlayers.forEach((entry, index) => {
                const oomPts = index < OOM_POINTS.length ? OOM_POINTS[index] : 0;
                if (playerEventPoints[entry.playerId]) {
                    playerEventPoints[entry.playerId].push({
                        eventId: event.id,
                        eventName: event.name,
                        venue: event.venue,
                        date: event.date,
                        stableford: entry.stableford,
                        oomPoints: oomPts,
                        position: index + 1,
                        isCounted: false // will be set below
                    });
                }
            });
        }
        
        // For each player, determine best 5 events
        const standings = [];
        
        for (const [playerId, events] of Object.entries(playerEventPoints)) {
            if (events.length === 0) continue;
            
            const player = allPlayers.find(p => p.id === playerId);
            if (!player) continue;
            
            // Sort by OOM points descending to find best 5
            const sortedEvents = [...events].sort((a, b) => b.oomPoints - a.oomPoints);
            
            // Mark best 5 as counted
            sortedEvents.forEach((ev, i) => {
                ev.isCounted = i < OOM_BEST_OF;
            });
            
            // Also mark them in the original chronological array
            const countedEventIds = new Set(
                sortedEvents.filter(e => e.isCounted).map(e => e.eventId)
            );
            events.forEach(ev => {
                ev.isCounted = countedEventIds.has(ev.eventId);
            });
            
            const totalOomPoints = sortedEvents
                .filter(e => e.isCounted)
                .reduce((sum, e) => sum + e.oomPoints, 0);
            
            const totalStableford = events.reduce((sum, e) => sum + e.stableford, 0);
            const bestRound = Math.max(...events.map(e => e.stableford), 0);
            
            standings.push({
                id: playerId,
                name: player.displayName,
                handicap: player.handicap,
                oomPoints: totalOomPoints,
                totalStableford: totalStableford,
                eventsPlayed: events.length,
                bestRound: bestRound,
                eventResults: events // chronological
            });
        }
        
        // Sort: OOM points desc, then total Stableford desc as tiebreaker
        standings.sort((a, b) => b.oomPoints - a.oomPoints || b.totalStableford - a.totalStableford);
        
        renderOOMTable(standings, leagueEvents);
        
    } catch (error) {
        console.error('Error loading OOM standings:', error);
    }
}
function renderOOMTable(standings, leagueEvents) {
    const container = document.getElementById('leagueTable');
    const breakdownContainer = document.getElementById('oomEventBreakdown');
    const eventsPlayed = leagueEvents.filter(e => {
        return e.scorecards && Object.keys(e.scorecards).length > 0 ||
               e.scores && Object.keys(e.scores).length > 0;
    }).length;
    
    // Update header stats
    document.getElementById('totalEvents').textContent = `${eventsPlayed} / ${leagueEvents.length}`;
    
    const userStanding = standings.find(s => s.id === currentUser.uid);
    if (userStanding) {
        const userPos = standings.indexOf(userStanding) + 1;
        document.getElementById('userPosition').textContent = userPos <= 3 
            ? ['🥇','🥈','🥉'][userPos - 1] + ' ' + userPos 
            : userPos;
        document.getElementById('userPoints').textContent = userStanding.oomPoints;
    } else {
        document.getElementById('userPosition').textContent = '-';
        document.getElementById('userPoints').textContent = '0';
    }
    
    if (standings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏆</div>
                <div class="empty-state-text">No results yet this season</div>
            </div>`;
        breakdownContainer.innerHTML = '';
        return;
    }
    
    // Build short event name headers for the breakdown columns
    const eventHeaders = leagueEvents.map(e => {
        const shortName = e.venue.split(' ')[0].replace(',', '');
        return { id: e.id, short: shortName, date: e.date };
    });
    
    // Main standings table
    let html = `
        <div class="oom-table">
            <div class="oom-row oom-header">
                <div class="oom-pos">#</div>
                <div class="oom-player">Player</div>
                <div class="oom-total">OOM</div>
                <div class="oom-played">Played</div>
                <div class="oom-best">Best</div>
            </div>
    `;
    
    standings.forEach((player, index) => {
        const pos = index + 1;
        const isMe = player.id === currentUser.uid;
        const posDisplay = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
        const initials = player.name.split(' ').map(n => n[0]).join('');
        
        html += `
            <div class="oom-row ${isMe ? 'oom-current-user' : ''}" onclick="togglePlayerBreakdown('${player.id}')">
                <div class="oom-pos">${posDisplay}</div>
                <div class="oom-player">
                    <div class="oom-avatar">${initials}</div>
                    <div class="oom-player-info">
                        <div class="oom-name">${player.name}</div>
                        <div class="oom-hcp">HCP ${player.handicap}</div>
                    </div>
                </div>
                <div class="oom-total">${player.oomPoints}</div>
                <div class="oom-played">${player.eventsPlayed}</div>
                <div class="oom-best">${player.bestRound}</div>
            </div>
            <div class="oom-breakdown hidden" id="breakdown-${player.id}">
                ${renderPlayerBreakdown(player, eventHeaders)}
            </div>
        `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
    
    // Event-by-event results cards
    let breakdownHtml = '<h3 class="oom-section-title">Event Results</h3>';
    
    leagueEvents.forEach(event => {
        const hasResults = (event.scorecards && Object.keys(event.scorecards).length > 0) ||
                           (event.scores && Object.keys(event.scores).length > 0);
        const eventDate = new Date(event.date);
        const isPast = eventDate < new Date();
        const shortDate = eventDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        
        if (!hasResults) {
            if (!isPast) {
                breakdownHtml += `
                    <div class="oom-event-card upcoming">
                        <div class="oom-event-header">
                            <span class="oom-event-name">${event.name}</span>
                            <span class="oom-event-date">${shortDate}</span>
                        </div>
                        <div class="oom-event-status">Upcoming</div>
                    </div>`;
            }
            return;
        }
        
        // Get ranked results for this event
        let results = [];
        if (event.scorecards) {
            results = Object.entries(event.scorecards)
                .map(([pid, data]) => ({
                    pid,
                    stableford: data.stablefordPoints || data.stableford || 0
                }))
                .filter(r => r.stableford > 0)
                .sort((a, b) => b.stableford - a.stableford);
        } else if (event.scores) {
            results = Object.entries(event.scores)
                .map(([pid, stableford]) => ({ pid, stableford }))
                .filter(r => r.stableford > 0)
                .sort((a, b) => b.stableford - a.stableford);
        }
        
        breakdownHtml += `
            <div class="oom-event-card">
                <div class="oom-event-header">
                    <span class="oom-event-name">${event.name}</span>
                    <span class="oom-event-date">${shortDate}</span>
                </div>
                <div class="oom-event-results">
        `;
        
        results.forEach((r, i) => {
            const player = allPlayers.find(p => p.id === r.pid);
            const name = player ? player.displayName : 'Unknown';
            const pts = i < OOM_POINTS.length ? OOM_POINTS[i] : 0;
            const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            const isMe = r.pid === currentUser.uid;
            
            breakdownHtml += `
                <div class="oom-result-row ${isMe ? 'oom-result-me' : ''}">
                    <span class="oom-result-pos ${posClass}">${i + 1}</span>
                    <span class="oom-result-name">${name}</span>
                    <span class="oom-result-stableford">${r.stableford} pts</span>
                    <span class="oom-result-oom ${pts > 0 ? 'has-pts' : ''}">${pts > 0 ? '+' + pts : '-'}</span>
                </div>
            `;
        });
        
        breakdownHtml += `</div></div>`;
    });
    
    breakdownContainer.innerHTML = breakdownHtml;
    
    // Wire up the "How it works" toggle
    const toggle = document.getElementById('oomRulesToggle');
    if (toggle) {
        toggle.onclick = () => {
            const content = document.getElementById('oomRulesContent');
            content.classList.toggle('hidden');
            toggle.textContent = content.classList.contains('hidden') 
                ? 'How it works ▾' : 'How it works ▴';
        };
    }
}
function renderPlayerBreakdown(player, eventHeaders) {
    if (!player.eventResults || player.eventResults.length === 0) {
        return '<div class="oom-no-results">No results</div>';
    }
    
    let html = '<div class="oom-player-events">';
    
    player.eventResults.forEach(ev => {
        const shortVenue = ev.venue ? ev.venue.split(' ')[0].replace(',', '') : ev.eventName;
        const evDate = new Date(ev.date);
        const shortDate = evDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const countedClass = ev.isCounted ? 'counted' : 'dropped';
        
        html += `
            <div class="oom-player-event ${countedClass}">
                <div class="oom-pe-info">
                    <span class="oom-pe-venue">${shortVenue}</span>
                    <span class="oom-pe-date">${shortDate}</span>
                </div>
                <div class="oom-pe-scores">
                    <span class="oom-pe-pos">${getOrdinal(ev.position)}</span>
                    <span class="oom-pe-stableford">${ev.stableford} pts</span>
                    <span class="oom-pe-oom ${ev.oomPoints > 0 ? 'has-pts' : ''}">${ev.oomPoints > 0 ? '+' + ev.oomPoints : '-'}</span>
                </div>
                ${!ev.isCounted ? '<span class="oom-pe-dropped">dropped</span>' : ''}
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}
function togglePlayerBreakdown(playerId) {
    const el = document.getElementById(`breakdown-${playerId}`);
    if (el) el.classList.toggle('hidden');
}
function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
// (duplicate findCourseData removed — using version above)
// (System 2 scoring code removed — using scorecardModal system above with society auto-handicap rules)

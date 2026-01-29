// ===== GLOBAL STATE =====
let currentUser = null;
let allEvents = [];
let allPlayers = [];
let currentView = 'calendar';
let currentMonth = new Date();
let selectedEventId = null;

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
    document.getElementById('addEventBtn').addEventListener('click', () => openEventModal());
    document.getElementById('addEventBtn2').addEventListener('click', () => openEventModal());
    
    // Calendar navigation
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    
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
    renderCalendar();
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
    
    return `
        <div class="event-card" data-event-id="${event.id}">
            <div class="event-card-header">
                <div>
                    <div class="event-card-title">${event.name}</div>
                    <div class="event-card-date">${formatDate(eventDate)}</div>
                </div>
                ${event.countsForLeague ? '<span class="event-badge league">League Event</span>' : ''}
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
        
        document.getElementById('profileName').textContent = userData.displayName;
        document.getElementById('profileEmail').textContent = userData.email;
        document.getElementById('profileHandicap').textContent = userData.handicap;
        document.getElementById('profileEventsPlayed').textContent = userData.eventsPlayed || 0;
        document.getElementById('profileLeaguePoints').textContent = userData.leaguePoints || 0;
        
        // Load payment history
        loadPaymentHistory();
    });
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
        if (!player) return '';
        
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
    try {
        await firebase.database().ref(`events/${eventId}/participants/${currentUser.uid}`).set({
            joinedAt: new Date().toISOString(),
            paid: false
        });
        
        showToast('Successfully joined event', 'success');
        closeAllModals();
    } catch (error) {
        showToast('Error joining event', 'error');
        console.error(error);
    }
}

async function leaveEvent(eventId) {
    if (!confirm('Are you sure you want to leave this event?')) return;
    
    try {
        await firebase.database().ref(`events/${eventId}/participants/${currentUser.uid}`).remove();
        showToast('Left event', 'success');
        closeAllModals();
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
    
    if (!name || isNaN(handicap)) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    try {
        await firebase.database().ref(`users/${currentUser.uid}`).update({
            displayName: name,
            handicap: handicap
        });
        
        showToast('Profile updated', 'success');
        closeAllModals();
        renderProfile();
        document.getElementById('userDisplayName').textContent = name;
    } catch (error) {
        showToast('Error updating profile', 'error');
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

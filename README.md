# Northern Old Boys Society Golf Manager

Progressive Web App for managing the Northern Old Boys Society golf calendar, events, and member participation.

## Live Site

https://nobsgolf.co.uk

## Features

- 📅 Event calendar and management
- ⛳ Member registration and profiles
- 🏆 League standings tracking
- 💰 Payment tracking
- 📱 Mobile-responsive PWA
- 🔐 Firebase authentication (Email, Google, Apple Sign-In)
- 📰 Social newsfeed

## Setup

### 1. Firebase Configuration

Update `firebase-config.js` with your Firebase project credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 2. Firebase Security Rules

Import `database-rules.json` to your Firebase Realtime Database.

### 3. Import Events

Import `2026-NOBS-EVENTS.json` to Firebase to populate the 2026 season calendar.

### 4. Deploy

Push to GitHub - the site is configured for GitHub Pages deployment.

## Technologies

- Vanilla JavaScript
- Firebase (Auth, Realtime Database)
- CSS3 (responsive design)
- PWA (Progressive Web App)

## 2026 Season

- 9 events scheduled
- Courses across North Wales and Cheshire
- Annual away trip to Porthmadog & Royal St David's
- Christmas team game at Leasowe

---

**Northern Old Boys Society** • Est. [Year] • North Wales & Cheshire Golf

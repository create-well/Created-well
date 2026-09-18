/* ============================================
   CR8W Create Well Dashboard v3 — App Logic
   Hub + Geyser + Person routing, full CRUD
   ============================================ */

const CGI_BIN = 'cgi-bin';

// ============================================
// State
// ============================================
let currentView = 'hub'; // 'hub' | 'geyser' | 'playground' | 'sunshine' | 'monny' | 'bingle'
let currentPerson = null;
let currentPersonTab = 'overview';
let currentGeyserTab = 'overview';
let currentPlaygroundTab = 'calculator';
let currentFilter = 'all';
let currentGeyserPersonFilter = 'all';
let currentGeyserStatusFilter = 'all';
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();

// Data caches (in-memory only)
let actionItems = [];
let momentumItems = [];
let sharedItems = [];
let wellNotes = [];
let stationsData = [];
let announcementsData = [];
let brainDumps = [];

// ============================================
// Person Data
// ============================================
const PERSONS = {
    sunshine: {
        name: 'Sunshine',
        role: 'ManiGen 5/1 · Emotional Authority',
        expression: 'Lead / Internal Expression',
        color: '#D4A5A5',
        emoji: '☀️',
        authority: 'emotional',
        energyReminder: {
            type: 'Emotional Wave',
            text: 'Remember your 72-hour decision timer. Ride the wave — don\'t decide at the peak or the valley. Your clarity comes through the full cycle.',
            detail: 'Triple Split: Big decisions need your full team present. All three centers need time to process.'
        }
    },
    monny: {
        name: 'Monny',
        fullName: 'Monica',
        role: 'Generator 5/1 · Sacral Authority',
        expression: 'Bridge / Embodied Expression',
        color: '#A9D6F8',
        emoji: '🌊',
        authority: 'sacral',
        energyReminder: {
            type: 'Sacral Check',
            text: 'Tune into your gut response today. What lights you up? What gets a full-body yes? Trust that "uh-huh" or "nuh-uh."',
            detail: '5/1 Foundation: Research and investigate before externalizing. Your depth is your power.'
        }
    },
    bingle: {
        name: 'Bingle',
        role: 'Projector 2/4 · Ego Authority',
        expression: 'External Expression / Distiller',
        color: '#D4A574',
        emoji: '✨',
        authority: 'ego',
        energyReminder: {
            type: 'Invitation Check',
            text: 'Is there an invitation to respond to today? Wait for recognition before diving in. Your energy is precious — spend it where it\'s seen.',
            detail: 'Energy Budget: Projector energy is finite and potent. Rest isn\'t lazy — it\'s strategy.'
        }
    }
};

// ============================================
// Wellsheet / Check-in Prompts
// ============================================
const WELLSHEET_PROMPTS = {
    sunshine: [
        "Where on your emotional wave are you right now?",
        "What download came through this morning?",
        "What's your body telling you about today's agenda?",
        "Which of your three splits needs attention today?",
        "What's one thing you want to manifest into the space today?",
        "Are you creating from overflow or depletion?",
        "What sparked you this week that you haven't shared yet?"
    ],
    monny: [
        "What's your sacral saying yes to right now?",
        "What's the bridge you're building today?",
        "Where are you in your investigation cycle?",
        "What needs embodying before it gets shared?",
        "Is your gut pulling you toward refinement or creation?",
        "What context needs your anchor energy most?",
        "What would a full-body yes feel like right now?"
    ],
    bingle: [
        "Is there an invitation waiting for your response?",
        "How's your energy budget looking today?",
        "What's ready to be distilled from the flow?",
        "Where can your 2/4 genius see what others can't?",
        "What clarity arrived during your rest time?",
        "Who in your network needs connecting today?",
        "What needs your external expression gift?"
    ]
};

// ============================================
// Calendar Events
// ============================================
const CALENDAR_EVENTS = [
    { date: '2026-04-15', title: 'CR8W HARD LAUNCH 🚀', time: 'All Day', location: 'Taverna Costera', type: 'launch', persons: ['sunshine', 'monny', 'bingle'] },
    { date: '2026-03-03', title: 'BHD Meeting', time: '10am', type: 'bhd', persons: ['sunshine', 'monny', 'bingle'] },
    { date: '2026-03-10', title: 'BHD Meeting', time: '10am', type: 'bhd', persons: ['sunshine', 'monny', 'bingle'] },
    { date: '2026-03-17', title: 'BHD Meeting', time: '10am', type: 'bhd', persons: ['sunshine', 'monny', 'bingle'] },
    { date: '2026-03-24', title: 'BHD Meeting', time: '10am', type: 'bhd', persons: ['sunshine', 'monny', 'bingle'] },
    { date: '2026-03-31', title: 'BHD Meeting', time: '10am', type: 'bhd', persons: ['sunshine', 'monny', 'bingle'] },
    { date: '2026-04-07', title: 'BHD Meeting', time: '10am', type: 'bhd', persons: ['sunshine', 'monny', 'bingle'] },
    { date: '2026-03-05', title: 'Deep Work Day 🧘', time: 'All Day', type: 'personal', persons: ['sunshine'] },
    { date: '2026-03-12', title: 'Deep Work Day 🧘', time: 'All Day', type: 'personal', persons: ['monny'] },
    { date: '2026-03-19', title: 'Deep Work Day 🧘', time: 'All Day', type: 'personal', persons: ['bingle'] },
    { date: '2026-03-26', title: 'Deep Work Day 🧘', time: 'All Day', type: 'personal', persons: ['sunshine', 'monny'] },
    { date: '2026-03-06', title: 'Monshine Session', time: '2pm', type: 'personal', persons: ['sunshine', 'monny'] },
    { date: '2026-03-08', title: 'Istorya Crossover', time: '11am', type: 'personal', persons: ['monny'] },
    { date: '2026-03-15', title: 'NYC Workshop Prep', time: '3pm', type: 'personal', persons: ['bingle'] },
    { date: '2026-04-01', title: 'Pitch Deck Due', time: '', type: 'cr8w', persons: ['sunshine'] },
    { date: '2026-04-05', title: 'Intro Video Draft Due', time: '', type: 'cr8w', persons: ['bingle'] },
    { date: '2026-04-10', title: 'Final Walkthrough', time: '4pm', location: 'Taverna Costera', type: 'cr8w', persons: ['sunshine', 'monny', 'bingle'] },
];

// ============================================
// Glossary
// ============================================
const GLOSSARY = [
    { term: 'Geyser', def: 'CR8W event format & workspace tool — where creative energy erupts into form.' },
    { term: 'Decomprocess', def: 'Debrief + process — the reflective unwinding after shared experiences.' },
    { term: 'Wellsheet', def: 'Pre-meeting self-reflection across 3 levels of depth.' },
    { term: 'Titration', def: 'The funnel of idea refinement: Sunshine ideates → Monny bridges → Bingle distills → Operationalize.' },
    { term: 'Co-Hoe', def: 'Team collaborator — the people you build with, create with, and grow with.' },
    { term: 'Undercurrent', def: 'The deeper point of perspective in storytelling — what\'s flowing beneath the surface.' },
    { term: 'Hoe-flow', def: 'How each member uniquely shows up in the collective.' },
    { term: 'IndividuWell', def: 'Individual creative wellness practice — your personal well before the shared one.' },
    { term: 'Ofcoursement', def: 'Synchronicity acknowledgment — when the universe says "of course."' },
    { term: 'Monnyfesting', def: 'Monny-specific manifesting — when the sacral generator brings visions into embodied reality.' }
];

// ============================================
// Milestones
// ============================================
const MILESTONES = [
    { text: 'Venue confirmed (Taverna Costera)', done: false },
    { text: 'Sponsorship goal: $0 / $10,000', done: false },
    { text: 'Invite list: 33 / 100', done: false },
    { text: '33 guests confirmed', done: true },
    { text: 'Pitch deck complete', done: false },
    { text: 'Intro video drafted', done: false },
    { text: 'Activation stations confirmed', done: false },
    { text: 'Music / DJ secured', done: false }
];

// Stations loaded from API (fallback defaults)
const STATIONS_FALLBACK = [
    { emoji: '🎨', name: 'Art Well', status: 'Planning', description: 'Live painting and communal art creation — guests contribute to a shared canvas.', owner: 'sunshine' },
    { emoji: '📸', name: 'Photo Booth', status: 'Planning', description: 'Styled portrait station capturing guests in their element at the event.', owner: 'bingle' },
    { emoji: '🎵', name: 'Sound Bath', status: 'Exploring', description: 'Immersive ambient soundscape for grounding and intentional arrivals.', owner: 'monny' },
    { emoji: '✍️', name: 'Letter Station', status: 'Confirmed', description: 'Write a letter to yourself, a future version, or someone you love.', owner: 'sunshine' },
    { emoji: '🌿', name: 'Plant Bar', status: 'Exploring', description: 'Each guest takes home a plant as a living reminder of the night.', owner: 'monny' },
    { emoji: '🔮', name: 'HD Reading', status: 'TBD', description: 'Human Design mini-readings — know your type, authority, and profile.', owner: 'bingle' }
];

// Google Calendar embed config (only calendar src needed now; Gmail links are generic)
const GOOGLE_ACCOUNTS = {
    sunshine: { calendarSrc: '' },
    monny: { calendarSrc: 'ako%40panganay.co' },
    bingle: { calendarSrc: '' }
};

// Guest Journey Steps
const GUEST_JOURNEY = [
    { step: 1, icon: '💌', title: 'Invitation', desc: 'Personal, curated invites sent to the 100-person guest list. Each invite feels intentional.', status: 'in_progress' },
    { step: 2, icon: '✅', title: 'RSVP', desc: '33 confirmed so far. Goal: 100. RSVP link goes live with follow-up sequence.', status: 'in_progress' },
    { step: 3, icon: '🚗', title: 'Arrival', desc: 'Guests arrive at Taverna Costera. Parking, directional signage, and greeter team ready.', status: 'planning' },
    { step: 4, icon: '🤝', title: 'Welcome', desc: 'Warm arrival moment — welcome drink, name card, orientation to the space.', status: 'planning' },
    { step: 5, icon: '⚡', title: 'Activations', desc: 'Free flow through the 6 activation stations. 45–60 minute open exploration window.', status: 'planning' },
    { step: 6, icon: '🕯️', title: 'Ceremony', desc: 'Gathering circle — collective intention-setting, CR8W introduction, and community moment.', status: 'planning' },
    { step: 7, icon: '🌊', title: 'Debrief', desc: 'Decomprocess — small group reflection. What moved you tonight? What are you taking home?', status: 'planning' }
];

// Inspirational Quotes (now includes HD-themed quotes)
const QUOTES = [
    "Here, is where you fall in love with the process.",
    "Flow over force.",
    "Creating doesn't have to be hard — it can be soft.",
    "We don't just tolerate the work — it's a life force in which we thrive.",
    "Here we speak life into ourselves and into others.",
    "There is more than enough room at the top.",
    "The well was always there. They just had to dig deep enough to find it.",
    "Accessible entry. Deeper medicine.",
    "Trust the response. Your body knows before your mind catches up.",
    "Emotional clarity is not the absence of feeling — it's the full ride through.",
    "The invitation is the permission slip your genius was waiting for.",
    "You weren't designed to do it all. You were designed to do what lights you up.",
    "Satisfaction is the signature of a life lived in alignment.",
    "Wait for the wave. The answer lives in the stillness after the storm.",
    "Your aura speaks louder than your words ever could.",
    "Strategy isn't limitation — it's liberation.",
    "The sacral doesn't lie. Learn its language.",
    "Rest is a Projector's most productive state."
];

// ============================================
// Helper: get current stations (API data or fallback)
// ============================================
function getStations() {
    return stationsData.length > 0 ? stationsData : STATIONS_FALLBACK;
}
function getAnnouncements() {
    return announcementsData;
}

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    updateCountdown();
    updateBHDBanner();
    setRotatingQuote();

    // Check hash for initial route
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    loadAllData();

    // Auto-refresh data every 60 seconds for live sync
    setInterval(() => {
        loadAllData();
    }, 60000);
});

function handleHashChange() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'geyser') {
        showGeyserView();
    } else if (hash === 'playground') {
        showPlaygroundView();
    } else if (hash === 'workdocs') {
        showWorkDocsView();
    } else if (hash && PERSONS[hash]) {
        showPersonView(hash);
    } else {
        showHubView();
    }
}

async function loadAllData() {
    try {
        const [actRes, momRes, sharedRes, notesRes, stationsRes, annRes, dumpRes] = await Promise.all([
            fetchAPI('/actions'),
            fetchAPI('/momentum'),
            fetchAPI('/shared'),
            fetchAPI('/notes'),
            fetchAPI('/stations'),
            fetchAPI('/announcements'),
            fetchAPI('/brain_dumps')
        ]);
        if (Array.isArray(actRes)) actionItems = actRes;
        if (Array.isArray(momRes)) momentumItems = momRes;
        if (Array.isArray(sharedRes)) sharedItems = sharedRes;
        if (Array.isArray(notesRes)) wellNotes = notesRes;
        if (Array.isArray(stationsRes)) stationsData = stationsRes;
        if (Array.isArray(annRes)) announcementsData = annRes;
        if (Array.isArray(dumpRes)) brainDumps = dumpRes;
    } catch (e) {
        console.log('API not available, using empty state:', e);
    }

    // Re-render if in a person or geyser view
    if (currentPerson) {
        renderPersonTab();
    } else if (currentView === 'geyser') {
        renderGeyserTab();
    } else if (currentView === 'playground') {
        // Playground has no dynamic data to re-render
    }
    // Update Hub Geyser Command Center with live announcements
    renderHubAnnouncements();
    renderBrainDumpList();

    // Update last synced time
    const syncTimeEl = document.getElementById('notion-sync-time');
    if (syncTimeEl) {
        const now = new Date();
        syncTimeEl.textContent = 'Last synced: ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
}

// ============================================
// API Helpers
// ============================================
async function fetchAPI(route, options = {}) {
    try {
        const routeName = route.replace('/', '');
        const url = `${CGI_BIN}/api.py?route=${routeName}`;
        const res = await fetch(url, options);
        return await res.json();
    } catch (e) {
        console.error('API error:', e);
        return null;
    }
}

// ============================================
// Navigation
// ============================================
function navigateTo(view) {
    if (view === 'hub') {
        window.location.hash = '';
        showHubView();
    } else if (view === 'geyser') {
        window.location.hash = 'geyser';
        showGeyserView();
    } else if (view === 'playground') {
        window.location.hash = 'playground';
        showPlaygroundView();
    } else if (view === 'workdocs') {
        window.location.hash = 'workdocs';
        showWorkDocsView();
    } else if (PERSONS[view]) {
        window.location.hash = view;
        showPersonView(view);
    }
    updateNavActive(view);
}

function showHubView() {
    currentView = 'hub';
    currentPerson = null;
    document.body.className = '';

    document.getElementById('view-hub').classList.remove('hidden');
    document.getElementById('view-geyser').classList.add('hidden');
    document.getElementById('view-person').classList.add('hidden');
    document.getElementById('view-playground').classList.add('hidden');
    document.getElementById('view-workdocs').classList.add('hidden');

    updateNavActive('hub');
    updateCountdown();
    updateBHDBanner();
    setRotatingQuote();

    // Update GCC countdown
    const launch = new Date('2026-04-15T00:00:00');
    const now = new Date();
    const diff = Math.ceil((launch - now) / (1000 * 60 * 60 * 24));
    const el = document.getElementById('gcc-countdown');
    if (el) el.textContent = diff;

    // Smooth scroll to top on view change
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showGeyserView() {
    currentView = 'geyser';
    currentPerson = null;
    document.body.className = '';

    document.getElementById('view-hub').classList.add('hidden');
    document.getElementById('view-geyser').classList.remove('hidden');
    document.getElementById('view-person').classList.add('hidden');
    document.getElementById('view-playground').classList.add('hidden');
    document.getElementById('view-workdocs').classList.add('hidden');

    // Update geyser countdown
    const launch = new Date('2026-04-15T00:00:00');
    const now = new Date();
    const diff = Math.ceil((launch - now) / (1000 * 60 * 60 * 24));
    const el = document.getElementById('geyser-days');
    if (el) el.textContent = diff;

    updateNavActive('geyser');

    // Activate default tab (overview) or current
    switchGeyserTab(currentGeyserTab);

    // Smooth scroll to top on view change
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPersonView(person) {
    currentView = person;
    currentPerson = person;
    currentPersonTab = 'overview';
    document.body.className = 'person-' + person;

    document.getElementById('view-hub').classList.add('hidden');
    document.getElementById('view-geyser').classList.add('hidden');
    document.getElementById('view-person').classList.remove('hidden');
    document.getElementById('view-playground').classList.add('hidden');
    document.getElementById('view-workdocs').classList.add('hidden');

    // Set up person header
    const p = PERSONS[person];
    document.getElementById('person-emoji').textContent = p.emoji;
    document.getElementById('person-name').textContent = p.name;
    document.getElementById('person-role').textContent = `${p.role} · ${p.expression}`;

    // Date
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    document.getElementById('person-date').textContent = now.toLocaleDateString('en-US', options) + ' · ' + timeStr;

    updateNavActive(person);

    // Reset tabs
    document.querySelectorAll('.person-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === 'overview');
    });
    document.querySelectorAll('.person-tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('ptab-overview').classList.remove('hidden');

    renderPersonTab();

    // Smooth scroll to top on view change
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPlaygroundView() {
    currentView = 'playground';
    currentPerson = null;
    document.body.className = '';

    document.getElementById('view-hub').classList.add('hidden');
    document.getElementById('view-geyser').classList.add('hidden');
    document.getElementById('view-person').classList.add('hidden');
    document.getElementById('view-playground').classList.remove('hidden');
    document.getElementById('view-workdocs').classList.add('hidden');

    updateNavActive('playground');

    // Activate default or current playground tab
    switchPlaygroundTab(currentPlaygroundTab);

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showWorkDocsView() {
    currentView = 'workdocs';
    currentPerson = null;
    document.body.className = '';

    document.getElementById('view-hub').classList.add('hidden');
    document.getElementById('view-geyser').classList.add('hidden');
    document.getElementById('view-person').classList.add('hidden');
    document.getElementById('view-playground').classList.add('hidden');
    document.getElementById('view-workdocs').classList.remove('hidden');

    updateNavActive('workdocs');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchPlaygroundTab(tab) {
    currentPlaygroundTab = tab;

    document.querySelectorAll('.playground-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.pgtab === tab);
    });

    document.querySelectorAll('.playground-tab-content').forEach(el => el.classList.add('hidden'));
    const tabEl = document.getElementById('pgtab-' + tab);
    if (tabEl) {
        tabEl.classList.remove('hidden');
        tabEl.style.animation = 'none';
        tabEl.offsetHeight;
        tabEl.style.animation = '';
    }
}

function updateNavActive(view) {
    // Desktop nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.view === view);
    });
    // Mobile nav
    document.querySelectorAll('.mobile-menu-link').forEach(link => {
        link.classList.toggle('active', link.dataset.view === view);
    });
    // Logo highlight when on hub
    const navLeft = document.querySelector('.nav-left');
    if (navLeft) {
        navLeft.classList.toggle('nav-left-active', view === 'hub');
    }
}

function switchPersonTab(tab) {
    currentPersonTab = tab;

    document.querySelectorAll('.person-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });

    document.querySelectorAll('.person-tab-content').forEach(el => el.classList.add('hidden'));
    const tabEl = document.getElementById('ptab-' + tab);
    if (tabEl) {
        tabEl.classList.remove('hidden');
        tabEl.style.animation = 'none';
        tabEl.offsetHeight;
        tabEl.style.animation = '';
    }

    renderPersonTab();
}

function switchGeyserTab(tab) {
    currentGeyserTab = tab;

    document.querySelectorAll('.geyser-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.gtab === tab);
    });

    document.querySelectorAll('.geyser-tab-content').forEach(el => el.classList.add('hidden'));
    const tabEl = document.getElementById('gtab-' + tab);
    if (tabEl) {
        tabEl.classList.remove('hidden');
        tabEl.style.animation = 'none';
        tabEl.offsetHeight;
        tabEl.style.animation = '';
    }

    renderGeyserTab();
}

function renderPersonTab() {
    if (!currentPerson) return;
    if (currentPersonTab === 'overview') renderOverview();
    else if (currentPersonTab === 'calendar') renderCalendar();
    else if (currentPersonTab === 'actions') renderActions();
    else if (currentPersonTab === 'hdprofile') renderHDProfile();
    else if (currentPersonTab === 'well') renderWell();
}

function renderGeyserTab() {
    if (currentGeyserTab === 'overview') renderGeyserOverview();
    else if (currentGeyserTab === 'journey') renderGeyserJourney();
    else if (currentGeyserTab === 'stations') renderGeyserStations();
    else if (currentGeyserTab === 'tasks') renderGeyserTasks();
    else if (currentGeyserTab === 'forum') renderGeyserForum();
}

// Mobile menu
function toggleMobileMenu() {
    document.getElementById('mobile-menu-overlay').classList.toggle('open');
}
function closeMobileMenu() {
    document.getElementById('mobile-menu-overlay').classList.remove('open');
}

// ============================================
// Countdown & Quote
// ============================================
function updateCountdown() {
    const launch = new Date('2026-04-15T00:00:00');
    const now = new Date();
    const diff = Math.ceil((launch - now) / (1000 * 60 * 60 * 24));
    const el = document.getElementById('countdown-days');
    if (el) el.textContent = diff;
    const el2 = document.getElementById('gcc-countdown');
    if (el2) el2.textContent = diff;
}

function setRotatingQuote() {
    const el = document.getElementById('rotating-quote');
    if (el) {
        const idx = Math.floor(Math.random() * QUOTES.length);
        el.textContent = QUOTES[idx];
    }
}

// ============================================
// GEYSER: Overview Tab
// ============================================
function renderGeyserOverview() {
    const container = document.getElementById('gtab-overview');
    if (!container) return;

    const launch = new Date('2026-04-15T00:00:00');
    const now = new Date();
    const daysLeft = Math.ceil((launch - now) / (1000 * 60 * 60 * 24));

    const stations = getStations();
    const announcements = getAnnouncements();
    const doneCount = MILESTONES.filter(m => m.done).length;
    const progress = Math.round((doneCount / MILESTONES.length) * 100);

    const totalTasks = actionItems.length;
    const doneTasks = actionItems.filter(i => i.status === 'done').length;
    const highPriority = actionItems.filter(i => i.priority === 'high' && i.status !== 'done').length;

    // Top announcements / urgent items
    const topAnnouncements = announcements.slice(0, 3);

    let html = `
        <!-- Top Announcements -->
        ${topAnnouncements.length > 0 ? `
        <div class="geyser-announcements-banner">
            <div class="gab-header">
                <span class="gab-icon">🔥</span>
                <span class="gab-title">Top Priority Right Now</span>
                <button class="gab-add-btn" onclick="showAddAnnouncementModal()" title="Add announcement">+</button>
            </div>
            <div class="gab-list">
                ${topAnnouncements.map(a => `
                    <div class="gab-item">
                        <span class="gcc-priority-badge ${a.priority}">${a.priority.toUpperCase()}</span>
                        <span class="gab-text">${a.text}</span>
                        <button class="gab-dismiss" onclick="dismissAnnouncement(${a.id})" title="Dismiss">&times;</button>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        <!-- Big Countdown -->
        <div class="geyser-big-countdown">
            <div class="gbc-num">${daysLeft}</div>
            <div class="gbc-label">days until<br>April 15, 2026</div>
        </div>

        <!-- Stats Grid -->
        <div class="geyser-stats-grid">
            <a href="https://docs.google.com/document/d/13SM9bqiUQ8-Rwfs9YC5XWlLscf_Lgg2H-y_gdDYFE0s/edit?usp=drive_web&ouid=114253660751168989061" target="_blank" rel="noopener noreferrer" class="geyser-stat-card geyser-stat-card-link">
                <div class="geyser-stat-num">33</div>
                <div class="geyser-stat-label">Confirmed<br>Guests</div>
                <div class="geyser-stat-sub">of 100 goal</div>
                <span class="geyser-stat-action">Open List ↗</span>
            </a>
            <a href="https://drive.google.com/drive/folders/1d9OyYZusS0yyYsfwtjLkz1ss0KYPzl5a?usp=drive_link" target="_blank" rel="noopener noreferrer" class="geyser-stat-card geyser-stat-card-link">
                <div class="geyser-stat-num">$0</div>
                <div class="geyser-stat-label">Sponsorship<br>Raised</div>
                <div class="geyser-stat-sub">of $10K goal</div>
                <span class="geyser-stat-action">Open Folder ↗</span>
            </a>
            <a href="#" onclick="switchGeyserTab('stations'); return false;" class="geyser-stat-card geyser-stat-card-link">
                <div class="geyser-stat-num">${stations.filter(s=>s.status==='Confirmed').length}</div>
                <div class="geyser-stat-label">Stations<br>Confirmed</div>
                <div class="geyser-stat-sub">of ${stations.length} total</div>
                <span class="geyser-stat-action">View Stations →</span>
            </a>
            <a href="#" onclick="switchGeyserTab('tasks'); return false;" class="geyser-stat-card geyser-stat-card-link geyser-stat-urgent">
                <div class="geyser-stat-num">${highPriority}</div>
                <div class="geyser-stat-label">High Priority<br>Open Tasks</div>
                <div class="geyser-stat-sub">need action</div>
                <span class="geyser-stat-action">View Tasks →</span>
            </a>
        </div>

        <!-- Milestones -->
        <div class="geyser-section">
            <h3 class="geyser-section-title">🚀 Launch Milestones</h3>
            <div class="card">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.82rem">
                    <span style="font-weight:600;color:var(--text-primary)">${doneCount} of ${MILESTONES.length} complete</span>
                    <span style="color:var(--text-muted)">${progress}%</span>
                </div>
                <div class="launch-progress-bar">
                    <div class="launch-progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="milestones-grid">
                    ${MILESTONES.map(m => `
                        <div class="milestone-item ${m.done ? 'done-milestone' : ''}">
                            <div class="milestone-check ${m.done ? 'done' : ''}">${m.done ? '✓' : ''}</div>
                            <span class="milestone-text">${m.text}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Team Assignments -->
        <div class="geyser-section">
            <h3 class="geyser-section-title">👥 Team Assignments Summary</h3>
            <div class="geyser-team-grid">
                ${Object.entries(PERSONS).map(([key, p]) => {
                    const personTasks = actionItems.filter(i => i.person === key);
                    const openTasks = personTasks.filter(i => i.status !== 'done');
                    const stationsOwned = stations.filter(s => s.owner === key);
                    return `
                        <div class="geyser-team-card" onclick="navigateTo('${key}')" style="border-top: 3px solid ${p.color}">
                            <div class="gtc-top">
                                <span class="gtc-emoji">${p.emoji}</span>
                                <div>
                                    <div class="gtc-name">${p.name}</div>
                                    <div class="gtc-role">${p.role.split('·')[0].trim()}</div>
                                </div>
                            </div>
                            <div class="gtc-stats">
                                <span class="gtc-stat">${openTasks.length} open tasks</span>
                                <span class="gtc-divider">·</span>
                                <span class="gtc-stat">${stationsOwned.length} stations</span>
                            </div>
                            ${openTasks.filter(t => t.priority === 'high').length > 0 ? `
                                <div class="gtc-urgent">${openTasks.filter(t=>t.priority==='high').length} high priority</div>
                            ` : ''}
                        </div>`;
                }).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================
// GEYSER: Guest Journey Tab
// ============================================
function renderGeyserJourney() {
    const container = document.getElementById('gtab-journey');
    if (!container) return;

    const statusLabel = { in_progress: 'In Progress', planning: 'Planning', done: 'Done' };
    const statusClass = { in_progress: 'journey-status-active', planning: 'journey-status-planning', done: 'journey-status-done' };

    let html = `
        <div class="geyser-section">
            <h3 class="geyser-section-title">💌 Guest Experience Flow</h3>
            <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:20px;line-height:1.6">
                The complete guest journey from invitation to debrief. Each step maps to a team owner and action items. Current invite status: <strong>33 confirmed</strong> of 100 goal.
            </p>
            <div class="journey-timeline">
                ${GUEST_JOURNEY.map((step, idx) => `
                    <div class="journey-step">
                        <div class="journey-connector ${idx === 0 ? 'journey-connector-first' : ''}">
                            <div class="journey-step-icon">${step.icon}</div>
                            ${idx < GUEST_JOURNEY.length - 1 ? '<div class="journey-line"></div>' : ''}
                        </div>
                        <div class="journey-step-body">
                            <div class="journey-step-header">
                                <span class="journey-step-num">Step ${step.step}</span>
                                <span class="journey-step-title">${step.title}</span>
                                <span class="journey-status-badge ${statusClass[step.status]}">${statusLabel[step.status]}</span>
                            </div>
                            <p class="journey-step-desc">${step.desc}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="geyser-section">
            <h3 class="geyser-section-title">📊 Invite Pipeline</h3>
            <div class="card">
                <div style="margin-bottom:12px">
                    <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:6px">
                        <span style="font-weight:600">Confirmed RSVPs</span>
                        <span style="color:var(--deep-rust);font-weight:600">33 / 100</span>
                    </div>
                    <div class="launch-progress-bar">
                        <div class="launch-progress-fill" style="width:33%"></div>
                    </div>
                </div>
                <div class="geyser-invite-breakdown">
                    <div class="gib-item">
                        <div class="gib-dot" style="background:#6BAF6B"></div>
                        <span>33 Confirmed</span>
                    </div>
                    <div class="gib-item">
                        <div class="gib-dot" style="background:var(--camel-sun)"></div>
                        <span>Pending outreach (slots 1–50): Sunshine</span>
                    </div>
                    <div class="gib-item">
                        <div class="gib-dot" style="background:var(--bingle)"></div>
                        <span>Pending outreach (slots 51–100): Bingle</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================
// GEYSER: Stations Tab
// ============================================
function renderGeyserStations() {
    const container = document.getElementById('gtab-stations');
    if (!container) return;

    const stations = getStations();

    const statusColors = {
        'Confirmed': { bg: '#E0F0E0', color: '#3A7A3A', dot: '#6BAF6B' },
        'Planning': { bg: '#FFF3D6', color: '#8A6A20', dot: '#D4A771' },
        'Exploring': { bg: '#EAF4FC', color: '#3A6A8A', dot: '#A9D6F8' },
        'TBD': { bg: '#F0F0F0', color: '#666', dot: '#A89888' }
    };

    const confirmed = stations.filter(s => s.status === 'Confirmed').length;
    const planning = stations.filter(s => s.status === 'Planning').length;
    const exploring = stations.filter(s => s.status === 'Exploring').length;
    const tbd = stations.filter(s => s.status === 'TBD').length;

    let html = `
        <div class="geyser-section">
            <div class="geyser-station-summary">
                <span class="gss-item" style="color:#3A7A3A"><span style="background:#6BAF6B" class="gss-dot"></span>${confirmed} Confirmed</span>
                <span class="gss-item" style="color:#8A6A20"><span style="background:#D4A771" class="gss-dot"></span>${planning} Planning</span>
                <span class="gss-item" style="color:#3A6A8A"><span style="background:#A9D6F8" class="gss-dot"></span>${exploring} Exploring</span>
                <span class="gss-item" style="color:#666"><span style="background:#A89888" class="gss-dot"></span>${tbd} TBD</span>
            </div>
        </div>
        <div class="geyser-section">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h3 class="geyser-section-title" style="margin-bottom:0">⚡ Activation Stations</h3>
                <button class="btn-add" onclick="showAddStationModal()">+ Add Station</button>
            </div>
            <div class="geyser-stations-grid">
                ${stations.map(s => {
                    const sc = statusColors[s.status] || statusColors['TBD'];
                    const owner = PERSONS[s.owner];
                    const desc = s.description || s.desc || '';
                    return `
                        <div class="geyser-station-card" id="station-card-${s.id}">
                            <div class="gsc-top">
                                <span class="gsc-emoji">${s.emoji}</span>
                                <select class="station-status-select" onchange="updateStationStatus(${s.id || 0}, this.value)" title="Change status">
                                    ${['Confirmed','Planning','Exploring','TBD'].map(st => 
                                        `<option value="${st}" ${s.status === st ? 'selected' : ''}>${st}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="gsc-name">${s.name}</div>
                            <p class="gsc-desc">${desc}</p>
                            <div class="gsc-owner" style="color:${owner ? owner.color : 'var(--text-muted)'}">
                                ${owner ? owner.emoji + ' ' + owner.name : 'Unassigned'}
                                <select class="station-owner-select" onchange="updateStationOwner(${s.id || 0}, this.value)" title="Change owner">
                                    <option value="" ${!s.owner ? 'selected' : ''}>Unassigned</option>
                                    ${Object.entries(PERSONS).map(([k, p]) => 
                                        `<option value="${k}" ${s.owner === k ? 'selected' : ''}>${p.emoji} ${p.name}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>`;
                }).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================
// GEYSER: Team Tasks Tab
// ============================================
function filterGeyserPerson(person) {
    currentGeyserPersonFilter = person;
    document.querySelectorAll('.geyser-person-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.person === person);
    });
    renderGeyserTasks();
}

function filterGeyserStatus(status) {
    currentGeyserStatusFilter = status;
    document.querySelectorAll('#geyser-status-filter .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });
    renderGeyserTasks();
}

function renderGeyserTasks() {
    const list = document.getElementById('geyser-actions-list');
    if (!list) return;

    let filtered = [...actionItems];

    if (currentGeyserPersonFilter !== 'all') {
        filtered = filtered.filter(i => i.person === currentGeyserPersonFilter);
    }
    if (currentGeyserStatusFilter !== 'all') {
        filtered = filtered.filter(i => i.status === currentGeyserStatusFilter);
    }

    // Sort: high priority first, then by person
    filtered.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.person.localeCompare(b.person);
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">No tasks match these filters</div>
            </div>`;
        return;
    }

    list.innerHTML = filtered.map((item, idx) => {
        const p = PERSONS[item.person];
        const personColor = p ? p.color : '#A89888';
        const personEmoji = p ? p.emoji : '👤';
        return `
            <div class="action-row ${item.status === 'done' ? 'done-row' : ''}" style="animation-delay: ${idx * 0.025}s">
                <div class="geyser-task-person-dot" style="background:${personColor}" title="${capitalize(item.person)}">
                    <span class="gtpd-emoji">${personEmoji}</span>
                </div>
                <button class="action-status-btn status-${item.status}" onclick="cycleStatusGeyser(${item.id})" title="Click to change status">
                    ${item.status === 'done' ? '✓' : item.status === 'in_progress' ? '◐' : item.status === 'blocked' ? '✕' : ''}
                </button>
                <div class="action-info">
                    <div class="action-title">${item.title}</div>
                    <div class="action-meta">
                        <span style="color:${personColor};font-weight:600">${capitalize(item.person)}</span>
                        <span><span class="action-priority-dot dot-${item.priority}"></span> ${item.priority}</span>
                        ${item.source ? `<span>📎 ${item.source}</span>` : ''}
                        ${item.due_date ? `<span>📅 ${formatDate(item.due_date)}</span>` : ''}
                        ${item.category ? `<span>🏷 ${item.category}</span>` : ''}
                    </div>
                </div>
                <select class="action-status-select" onchange="updateStatusGeyser(${item.id}, this.value)">
                    <option value="todo" ${item.status === 'todo' ? 'selected' : ''}>To Do</option>
                    <option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="done" ${item.status === 'done' ? 'selected' : ''}>Done</option>
                    <option value="blocked" ${item.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                </select>
            </div>`;
    }).join('');
}

async function cycleStatusGeyser(id) {
    const statusOrder = ['todo', 'in_progress', 'done', 'blocked'];
    const item = actionItems.find(i => i.id === id);
    if (!item) return;
    const currentIdx = statusOrder.indexOf(item.status);
    const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length];
    await updateStatusGeyser(id, nextStatus);
}

async function updateStatusGeyser(id, newStatus) {
    const item = actionItems.find(i => i.id === id);
    if (item) item.status = newStatus;
    renderGeyserTasks();

    try {
        await fetchAPI('/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus })
        });
    } catch (e) {
        console.error('Failed to update status:', e);
    }
}

// ============================================
// GEYSER: Forum Tab
// ============================================
function renderGeyserForum() {
    const container = document.getElementById('gtab-forum');
    if (!container) return;

    let html = `
        <div class="geyser-section">
            <h3 class="geyser-section-title">💬 The Collective Forum</h3>
            <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px">
                Shared notes, questions, and thoughts from the collective. Synced with The Well in each personal dashboard.
            </p>
            <div class="notes-area">
                <div class="note-input-wrap">
                    <input type="text" class="note-input" id="geyser-note-input"
                        placeholder="Drop a thought, question, or note for the collective..."
                        onkeypress="if(event.key==='Enter')addGeyserNote()">
                    <button class="spark-btn" onclick="addGeyserNote()">Post</button>
                </div>
                <div class="geyser-forum-author-select">
                    <label style="font-family:var(--font-label);font-size:0.72rem;color:var(--text-muted);letter-spacing:0.04em;text-transform:uppercase">Posting as:</label>
                    <select id="geyser-forum-author" class="action-status-select">
                        <option value="sunshine">☀️ Sunshine</option>
                        <option value="monny">🌊 Monny</option>
                        <option value="bingle">✨ Bingle</option>
                        <option value="collective">🌀 Collective</option>
                    </select>
                </div>
                <div id="geyser-notes-list">
                    ${renderNotesList(wellNotes)}
                </div>
            </div>
        </div>

        <div class="geyser-section">
            <h3 class="geyser-section-title">🤝 Shared Alignment Items</h3>
            <div class="shared-items-list">
                ${sharedItems.map(item => `
                    <div class="shared-item">
                        <span class="shared-item-cat">${item.category}</span>
                        <span>${item.title}</span>
                    </div>
                `).join('')}
                ${sharedItems.length === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;font-style:italic;padding:12px">No shared items yet</div>' : ''}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Shared helper to render notes list HTML (used by both Geyser Forum and Person Well)
function renderNotesList(notes) {
    if (!notes || notes.length === 0) {
        return '<div style="color:var(--text-muted);font-size:0.85rem;font-style:italic;padding:12px">The forum is quiet... be the first to drop a note 🫧</div>';
    }
    return notes.map(n => {
        const p = PERSONS[n.author];
        const color = p ? p.color : 'var(--deep-rust)';
        return `
            <div class="note-card">
                <div class="note-author" style="color:${color}">${p ? p.emoji + ' ' : ''}${capitalize(n.author)}</div>
                <div class="note-content">${n.content}</div>
                <div class="note-time">${formatTimestamp(n.created_at)}</div>
            </div>`;
    }).join('');
}

// Optimized: only update the notes list div instead of full re-render
function updateNotesDisplay() {
    const geyserList = document.getElementById('geyser-notes-list');
    if (geyserList) geyserList.innerHTML = renderNotesList(wellNotes);
    const wellList = document.getElementById('notes-list');
    if (wellList) wellList.innerHTML = renderNotesList(wellNotes);
}

async function addGeyserNote() {
    const input = document.getElementById('geyser-note-input');
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;

    const authorSelect = document.getElementById('geyser-forum-author');
    const author = authorSelect ? authorSelect.value : 'collective';

    const newNote = { author, content };
    const temp = { ...newNote, id: Date.now(), created_at: new Date().toISOString() };
    wellNotes.unshift(temp);
    input.value = '';
    // Only update notes list, not full forum re-render
    updateNotesDisplay();

    try {
        const result = await fetchAPI('/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newNote)
        });
        if (result && result.id) {
            const idx = wellNotes.findIndex(i => i.id === temp.id);
            if (idx !== -1) wellNotes[idx] = result;
        }
    } catch (e) {
        console.error('Failed to add note:', e);
    }
}

// ============================================
// Overview Tab (Person)
// ============================================
function renderOverview() {
    if (!currentPerson) return;
    const container = document.getElementById('ptab-overview');
    const person = PERSONS[currentPerson];
    const personItems = actionItems.filter(i => i.person === currentPerson);
    const personMomentum = momentumItems.filter(i => i.person === currentPerson);
    const personEvents = CALENDAR_EVENTS
        .filter(e => e.persons.includes(currentPerson))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .filter(e => new Date(e.date) >= new Date(new Date().toDateString()))
        .slice(0, 5);

    // Energy check-in prompt
    const prompts = WELLSHEET_PROMPTS[currentPerson];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const prompt = prompts[dayOfYear % prompts.length];

    let html = '';

    // Energy Check-in
    html += `
        <div class="energy-checkin">
            <span class="energy-checkin-icon">🫧</span>
            <div>
                <div class="energy-checkin-label">Today's Check-in</div>
                <div class="energy-checkin-text">${prompt}</div>
            </div>
        </div>`;

    // Generic Google Quick Access bar
    html += `
        <div class="person-google-bar">
            <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer" class="pgb-link">✉️ Gmail</a>
            <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" class="pgb-link">📅 Calendar</a>
            <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer" class="pgb-link">📁 Drive</a>
            <a href="https://drive.google.com/drive/folders/1r0OS_HTJIxTpcPSLYr_hNceeqLxF-Hlj?usp=drive_link" target="_blank" rel="noopener noreferrer" class="pgb-link pgb-shared">📦 Shared Drive</a>
        </div>`;

    html += '<div class="overview-grid">';

    // Card 1: Energy/Role Reminder
    html += `
        <div class="card" style="animation-delay: 0.05s">
            <div class="card-header">
                <span class="card-title">${person.emoji} Your Flow Today</span>
                <span class="card-badge">${person.authority} authority</span>
            </div>
            <div class="role-reminder">
                <span class="role-type">${person.role} · ${person.expression}</span>
                <strong>${person.energyReminder.type}:</strong> ${person.energyReminder.text}
                <br><br>
                <em>${person.energyReminder.detail}</em>
            </div>
        </div>`;

    // Card 2: Due Soon
    const urgentItems = personItems.filter(i => i.status !== 'done').sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        return 1;
    });
    const dueSoon = urgentItems.filter(i => i.due_date).slice(0, 5);
    html += `
        <div class="card" style="animation-delay: 0.1s">
            <div class="card-header">
                <span class="card-title">🔥 Due Soon</span>
                <span class="card-badge">${dueSoon.length} items</span>
            </div>
            ${dueSoon.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">✨</div><div class="empty-state-text">All caught up — breathe.</div></div>' :
                dueSoon.map(item => `
                    <div class="card-item">
                        <span class="card-item-status status-${item.status}"></span>
                        <span style="flex:1">${item.title}</span>
                        ${item.due_date ? `<span style="font-size:0.72rem;color:var(--text-muted)">${formatDate(item.due_date)}</span>` : ''}
                    </div>
                `).join('')}
        </div>`;

    // Person-specific cards
    if (currentPerson === 'sunshine') {
        html += renderSunshineCards(personItems, personMomentum);
    } else if (currentPerson === 'monny') {
        html += renderMonnyCards(personItems, personMomentum);
    } else if (currentPerson === 'bingle') {
        html += renderBingleCards(personItems, personMomentum);
    }

    // Sparked Ideas
    const sparkTitle = currentPerson === 'sunshine' ? '💡 Sparked Ideas' :
                       currentPerson === 'monny' ? '💡 Sacral Downloads' : '💡 Distilled Insights';
    html += `
        <div class="card" style="animation-delay: 0.25s">
            <div class="card-header">
                <span class="card-title">${sparkTitle}</span>
            </div>
            <div class="spark-list" id="spark-list-${currentPerson}">
                ${personMomentum.map(m => `
                    <div class="spark-item">
                        ${m.content}
                        <div class="spark-item-time">${formatTimestamp(m.created_at)}</div>
                    </div>
                `).join('')}
                ${personMomentum.length === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;font-style:italic">No sparks yet — add one below ✨</div>' : ''}
            </div>
            <div class="spark-input-wrap">
                <input type="text" class="spark-input" id="spark-input" placeholder="Capture a spark, download, or insight..." onkeypress="if(event.key==='Enter')addMomentum()">
                <button class="spark-btn" onclick="addMomentum()">Spark ✨</button>
            </div>
        </div>`;

    // Coming Up
    html += `
        <div class="card" style="animation-delay: 0.3s">
            <div class="card-header">
                <span class="card-title">📅 Coming Up</span>
            </div>
            ${personEvents.map(e => `
                <div class="cal-preview-item">
                    <span class="cal-preview-dot" style="background: ${getEventColor(e.type)}"></span>
                    <span class="cal-preview-date">${formatEventDate(e.date)}</span>
                    <span class="cal-preview-title">${e.title}${e.time ? ' · ' + e.time : ''}</span>
                </div>
            `).join('')}
            ${personEvents.length === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;font-style:italic">No upcoming events</div>' : ''}
        </div>`;

    // Task Progress Chart
    html += `
        <div class="card" style="animation-delay: 0.35s">
            <div class="card-header">
                <span class="card-title">📊 Task Progress</span>
            </div>
            <div class="chart-container">
                <canvas id="progress-chart"></canvas>
            </div>
        </div>`;

    html += '</div>';
    container.innerHTML = html;

    renderProgressChart(personItems);
}

function renderSunshineCards(items) {
    const geyserItems = items.filter(i => ['venue', 'pitch', 'sponsorship', 'invites', 'workspace'].includes(i.category) && i.status !== 'done');
    return `
        <div class="card" style="animation-delay: 0.15s">
            <div class="card-header">
                <span class="card-title">⛲️ Active Geyser Items</span>
                <span class="card-badge">${geyserItems.length} items</span>
            </div>
            ${geyserItems.map(item => `
                <div class="card-item">
                    <span class="card-item-status status-${item.status}"></span>
                    <span style="flex:1">${item.title}</span>
                    <span class="card-item-priority priority-${item.priority}">${item.priority}</span>
                </div>
            `).join('')}
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-soft);">
                <div class="role-reminder" style="font-size: 0.8rem; padding: 10px 12px;">
                    <strong>Triple Split Reminder:</strong> Before making big venue or sponsorship decisions, check in with Monny and Bingle. All three centers need to align.
                </div>
            </div>
        </div>
        <div class="card" style="animation-delay: 0.2s">
            <div class="card-header">
                <span class="card-title">🌊 Emotional Wave Timer</span>
            </div>
            <div class="role-reminder">
                <span class="role-type">72-Hour Decision Protocol</span>
                For big decisions, note when the idea first hits. Let it flow through your emotional wave for a full 72 hours before committing.
                <br><br>
                <strong>Current wave:</strong> Check in — are you at a peak, valley, or neutral? Only sign off on major commitments from a neutral/calm place.
            </div>
        </div>`;
}

function renderMonnyCards(items) {
    const systemItems = items.filter(i => ['structure', 'communication', 'model', 'wellsheet'].includes(i.category));
    return `
        <div class="card" style="animation-delay: 0.15s">
            <div class="card-header">
                <span class="card-title">🔧 Systems & Structure</span>
                <span class="card-badge">${systemItems.length} items</span>
            </div>
            ${systemItems.map(item => `
                <div class="card-item">
                    <span class="card-item-status status-${item.status}"></span>
                    <span style="flex:1">${item.title}</span>
                    <span class="card-item-priority priority-${item.priority}">${item.priority}</span>
                </div>
            `).join('')}
        </div>
        <div class="card" style="animation-delay: 0.2s">
            <div class="card-header">
                <span class="card-title">🌉 Bridge Status</span>
            </div>
            <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:10px">
                You're the bridge between Sunshine's ideation and Bingle's distillation. Here's the current flow:
            </p>
            <div class="bridge-visual">
                <div class="bridge-node" style="background: var(--sunshine-light); color: var(--sunshine-deep)">
                    ☀️ Sunshine<br><span style="font-size:0.68rem">Ideation</span>
                </div>
                <span class="bridge-arrow">→</span>
                <div class="bridge-node" style="background: var(--monny-light); color: var(--monny-deep)">
                    🌊 You<br><span style="font-size:0.68rem">Bridging</span>
                </div>
                <span class="bridge-arrow">→</span>
                <div class="bridge-node" style="background: var(--bingle-light); color: var(--bingle-deep)">
                    ✨ Bingle<br><span style="font-size:0.68rem">Distilling</span>
                </div>
            </div>
            <div style="margin-top:12px;">
                <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px;font-weight:600;font-family:var(--font-label)">Titration Queue (flowing through you):</div>
                <div class="card-item"><span class="card-item-status status-in_progress"></span> Create Well communication approach refinement</div>
                <div class="card-item"><span class="card-item-status status-todo"></span> Titration funnel model workshop</div>
                <div class="card-item"><span class="card-item-status status-todo"></span> Team introduction practice structure</div>
            </div>
        </div>`;
}

function renderBingleCards(items) {
    const clarityItems = items.filter(i => ['video', 'invites', 'content', 'vendor'].includes(i.category));
    return `
        <div class="card" style="animation-delay: 0.15s">
            <div class="card-header">
                <span class="card-title">🔮 Clarity Queue</span>
                <span class="card-badge">${clarityItems.length} items</span>
            </div>
            <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:10px">
                Items flowing from Monny for your distillation magic:
            </p>
            ${clarityItems.map(item => `
                <div class="card-item">
                    <span class="card-item-status status-${item.status}"></span>
                    <span style="flex:1">${item.title}</span>
                    <span class="card-item-priority priority-${item.priority}">${item.priority}</span>
                </div>
            `).join('')}
        </div>
        <div class="card" style="animation-delay: 0.2s">
            <div class="card-header">
                <span class="card-title">🔋 Energy Budget</span>
            </div>
            <div class="role-reminder">
                <span class="role-type">Projector Energy Management</span>
                Your energy is precious and potent. Today's budget:
                <br><br>
                <strong>Morning:</strong> Deep work window — use for storyboarding, distilling<br>
                <strong>Midday:</strong> Meeting window — invitations and collaboration<br>
                <strong>Afternoon:</strong> Rest or light tasks — protect your battery<br>
                <br>
                <em>Remember: Stepping away isn't quitting. It's recharging your projector gift. 💫</em>
            </div>
        </div>`;
}

// ============================================
// Progress Chart
// ============================================
function renderProgressChart(items) {
    const canvas = document.getElementById('progress-chart');
    if (!canvas) return;

    const todo = items.filter(i => i.status === 'todo').length;
    const inProg = items.filter(i => i.status === 'in_progress').length;
    const done = items.filter(i => i.status === 'done').length;
    const blocked = items.filter(i => i.status === 'blocked').length;

    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['To Do', 'In Progress', 'Done', 'Blocked'],
            datasets: [{
                data: [todo, inProg, done, blocked],
                backgroundColor: ['#A89888', '#D4A771', '#6BAF6B', '#D46B6B'],
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: "'Montserrat', sans-serif", size: 11 },
                        color: '#7A6558',
                        padding: 12,
                        usePointStyle: true,
                        pointStyleWidth: 8
                    }
                }
            }
        }
    });
}

// ============================================
// Calendar Tab
// ============================================
function renderCalendar() {
    // Render per-person Google Calendar embed
    const gcalContainer = document.getElementById('person-gcal-embed');
    if (gcalContainer && currentPerson) {
        const embedUrl = getPersonCalendarEmbed(currentPerson);
        if (embedUrl) {
            gcalContainer.innerHTML = `
                <div class="gcal-embed-section">
                    <div class="gcal-embed-header">
                        <span>📅 ${PERSONS[currentPerson].name}'s Google Calendar</span>
                        <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" class="gcal-open-link">Open in Google Calendar →</a>
                    </div>
                    <iframe src="${embedUrl}" class="calendar-iframe" frameborder="0" scrolling="yes"></iframe>
                </div>`;
        } else {
            gcalContainer.innerHTML = `
                <div class="gcal-embed-section gcal-embed-setup">
                    <div class="gcal-setup-icon">📅</div>
                    <div class="gcal-setup-text">
                        <strong>${PERSONS[currentPerson].name}'s Calendar</strong><br>
                        <span style="color:var(--text-muted);font-size:0.85rem">Calendar integration ready — just sign into Google in this browser to view it here. No extra setup needed.</span>
                    </div>
                    <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" class="gcal-setup-btn">Open Google Calendar →</a>
                </div>`;
        }
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('cal-month-title').textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

    const grid = document.getElementById('calendar-grid');
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let html = dayHeaders.map(d => `<div class="cal-day-header">${d}</div>`).join('');

    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrev = new Date(calendarYear, calendarMonth, 0).getDate();
    const today = new Date();

    for (let i = firstDay - 1; i >= 0; i--) {
        html += `<div class="cal-day other-month"><div class="cal-day-num">${daysInPrev - i}</div></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = today.getDate() === d && today.getMonth() === calendarMonth && today.getFullYear() === calendarYear;
        const dayEvents = CALENDAR_EVENTS.filter(e => e.date === dateStr && e.persons.includes(currentPerson));

        html += `<div class="cal-day ${isToday ? 'today' : ''}">
            <div class="cal-day-num">${d}</div>
            ${dayEvents.map(e => `<span class="cal-event-pip cal-event-${e.type}" title="${e.title}">${truncate(e.title, 12)}</span>`).join('')}
        </div>`;
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
    }

    grid.innerHTML = html;

    // Upcoming events
    const upcoming = CALENDAR_EVENTS
        .filter(e => e.persons.includes(currentPerson) && new Date(e.date) >= new Date(today.toDateString()))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 8);

    const eventsList = document.getElementById('events-list');
    eventsList.innerHTML = upcoming.map(e => {
        const d = new Date(e.date + 'T00:00:00');
        const monthShort = d.toLocaleString('en-US', { month: 'short' });
        const day = d.getDate();
        return `
            <div class="event-card">
                <div class="event-date-box">
                    <div class="event-date-month">${monthShort}</div>
                    <div class="event-date-day">${day}</div>
                </div>
                <div>
                    <div class="event-info-title">${e.title}</div>
                    <div class="event-info-detail">${e.time || ''}${e.location ? ' · ' + e.location : ''}</div>
                    <span class="event-type-badge cal-event-${e.type}">${e.type.toUpperCase()}</span>
                </div>
            </div>`;
    }).join('');
}

function calendarNav(dir) {
    calendarMonth += dir;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    renderCalendar();
}

// ============================================
// Actions Tab
// ============================================
function renderActions() {
    const personItems = actionItems.filter(i => i.person === currentPerson);
    let filtered = personItems;
    if (currentFilter !== 'all') {
        filtered = personItems.filter(i => i.status === currentFilter);
    }

    const list = document.getElementById('actions-list');
    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">${currentFilter === 'all' ? 'No action items yet' : 'No ' + currentFilter.replace('_', ' ') + ' items'}</div>
            </div>`;
        return;
    }

    list.innerHTML = filtered.map((item, idx) => `
        <div class="action-row ${item.status === 'done' ? 'done-row' : ''}" style="animation-delay: ${idx * 0.03}s">
            <button class="action-status-btn status-${item.status}" onclick="cycleStatus(${item.id})" title="Click to change status">
                ${item.status === 'done' ? '✓' : item.status === 'in_progress' ? '◐' : item.status === 'blocked' ? '✕' : ''}
            </button>
            <div class="action-info">
                <div class="action-title">${item.title}</div>
                <div class="action-meta">
                    <span><span class="action-priority-dot dot-${item.priority}"></span> ${item.priority}</span>
                    ${item.source ? `<span>📎 ${item.source}</span>` : ''}
                    ${item.due_date ? `<span>📅 ${formatDate(item.due_date)}</span>` : ''}
                    ${item.category ? `<span>🏷 ${item.category}</span>` : ''}
                </div>
            </div>
            <select class="action-status-select" onchange="updateStatus(${item.id}, this.value)">
                <option value="todo" ${item.status === 'todo' ? 'selected' : ''}>To Do</option>
                <option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="done" ${item.status === 'done' ? 'selected' : ''}>Done</option>
                <option value="blocked" ${item.status === 'blocked' ? 'selected' : ''}>Blocked</option>
            </select>
        </div>
    `).join('');
}

function filterActions(status) {
    currentFilter = status;
    document.querySelectorAll('#actions-filters .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });
    renderActions();
}

async function cycleStatus(id) {
    const statusOrder = ['todo', 'in_progress', 'done', 'blocked'];
    const item = actionItems.find(i => i.id === id);
    if (!item) return;
    const currentIdx = statusOrder.indexOf(item.status);
    const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length];
    await updateStatus(id, nextStatus);
}

async function updateStatus(id, newStatus) {
    const item = actionItems.find(i => i.id === id);
    if (item) item.status = newStatus;
    renderActions();
    if (currentPersonTab === 'overview') renderOverview();

    try {
        await fetchAPI('/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus })
        });
    } catch (e) {
        console.error('Failed to update status:', e);
    }
}

function showAddTaskModal() {
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

async function submitNewTask(e) {
    e.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    if (!title) return;

    // If we're in Geyser tasks view, use the person selector or current person filter
    const personSelect = document.getElementById('task-person');
    const targetPerson = currentPerson || (personSelect ? personSelect.value : 'sunshine');

    const newItem = {
        person: targetPerson,
        title,
        status: 'todo',
        priority: document.getElementById('task-priority').value,
        due_date: document.getElementById('task-due').value || '',
        source: document.getElementById('task-source').value || '',
        category: document.getElementById('task-category').value || ''
    };

    const tempItem = { ...newItem, id: Date.now(), created_at: new Date().toISOString() };
    actionItems.push(tempItem);

    if (currentView === 'geyser') {
        renderGeyserTasks();
    } else {
        renderActions();
        if (currentPersonTab === 'overview') renderOverview();
    }
    closeModal();

    document.getElementById('add-task-form').reset();

    try {
        const result = await fetchAPI('/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
        });
        if (result && result.id) {
            const idx = actionItems.findIndex(i => i.id === tempItem.id);
            if (idx !== -1) actionItems[idx] = result;
        }
    } catch (e) {
        console.error('Failed to add task:', e);
    }
}

// ============================================
// The Well (Shared Space)
// ============================================
function renderWell() {
    const container = document.getElementById('ptab-well');

    let html = '';

    // Titration Funnel
    html += `
        <div class="well-section">
            <h3 class="well-section-title"><span class="section-icon">⛲️</span> The Titration Funnel</h3>
            <div class="funnel-visual">
                <div class="funnel-stage">
                    <div class="funnel-stage-icon" style="background: var(--sunshine-light)">☀️</div>
                    <div class="funnel-stage-name">Ideation</div>
                    <div class="funnel-stage-role">Sunshine · ManiGen</div>
                    <div class="funnel-stage-desc">Downloads, sparks, and visions pour in. Raw creative energy seeking form.</div>
                </div>
                <div class="funnel-arrow">→</div>
                <div class="funnel-stage">
                    <div class="funnel-stage-icon" style="background: var(--monny-light)">🌊</div>
                    <div class="funnel-stage-name">Bridging</div>
                    <div class="funnel-stage-role">Monny · Generator</div>
                    <div class="funnel-stage-desc">Embodied refinement. Testing with the sacral. Building structure around the spark.</div>
                </div>
                <div class="funnel-arrow">→</div>
                <div class="funnel-stage">
                    <div class="funnel-stage-icon" style="background: var(--bingle-light)">✨</div>
                    <div class="funnel-stage-name">Distilling</div>
                    <div class="funnel-stage-role">Bingle · Projector</div>
                    <div class="funnel-stage-desc">Seeing the essence. Naming the pattern. Crystallizing into shareable clarity.</div>
                </div>
                <div class="funnel-arrow">→</div>
                <div class="funnel-stage">
                    <div class="funnel-stage-icon" style="background: var(--sandstone)">🚀</div>
                    <div class="funnel-stage-name">Operationalize</div>
                    <div class="funnel-stage-role">Collective</div>
                    <div class="funnel-stage-desc">Ready for the world. Scheduled, planned, and launched into the collective.</div>
                </div>
            </div>
        </div>`;

    // Hard Launch Milestones
    const doneCount = MILESTONES.filter(m => m.done).length;
    const progress = Math.round((doneCount / MILESTONES.length) * 100);
    html += `
        <div class="well-section">
            <h3 class="well-section-title"><span class="section-icon">🚀</span> Hard Launch Milestones</h3>
            <div class="card" style="margin-bottom: 16px">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.82rem">
                    <span style="font-weight:600;color:var(--text-primary)">${doneCount} of ${MILESTONES.length} complete</span>
                    <span style="color:var(--text-muted)">${progress}%</span>
                </div>
                <div class="launch-progress-bar">
                    <div class="launch-progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="milestones-grid">
                    ${MILESTONES.map(m => `
                        <div class="milestone-item ${m.done ? 'done-milestone' : ''}">
                            <div class="milestone-check ${m.done ? 'done' : ''}">${m.done ? '✓' : ''}</div>
                            <span class="milestone-text">${m.text}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <h4 style="font-family:var(--font-display);font-size:1rem;margin-bottom:12px;color:var(--text-primary)">Activation Stations</h4>
            <div class="stations-grid">
                ${getStations().map(s => `
                    <div class="station-card">
                        <div class="station-emoji">${s.emoji}</div>
                        <div class="station-name">${s.name}</div>
                        <div class="station-status">${s.status}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;

    // Shared Alignment Items
    html += `
        <div class="well-section">
            <h3 class="well-section-title"><span class="section-icon">🤝</span> Shared Alignment Items</h3>
            <div class="shared-items-list">
                ${sharedItems.map(item => `
                    <div class="shared-item">
                        <span class="shared-item-cat">${item.category}</span>
                        <span>${item.title}</span>
                    </div>
                `).join('')}
                ${sharedItems.length === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;font-style:italic;padding:12px">No shared items yet</div>' : ''}
            </div>
        </div>`;

    // Glossary
    html += `
        <div class="well-section">
            <h3 class="well-section-title"><span class="section-icon">📖</span> CR8W Glossary</h3>
            <div class="glossary-grid">
                ${GLOSSARY.map(g => `
                    <div class="glossary-item">
                        <div class="glossary-term">${g.term}</div>
                        <div class="glossary-def">${g.def}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;

    // Forum
    html += `
        <div class="well-section">
            <h3 class="well-section-title"><span class="section-icon">💬</span> The Forum</h3>
            <div class="notes-area">
                <div class="note-input-wrap">
                    <input type="text" class="note-input" id="note-input" placeholder="Drop a thought, question, or note for the collective..." onkeypress="if(event.key==='Enter')addNote()">
                    <button class="spark-btn" onclick="addNote()">Post</button>
                </div>
                <div id="notes-list">
                    ${renderNotesList(wellNotes)}
                </div>
            </div>
        </div>`;

    container.innerHTML = html;
}

// ============================================
// Momentum / Sparks
// ============================================
async function addMomentum() {
    const input = document.getElementById('spark-input');
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;

    const newItem = { person: currentPerson, content, item_type: 'spark' };
    const temp = { ...newItem, id: Date.now(), created_at: new Date().toISOString() };
    momentumItems.unshift(temp);
    input.value = '';
    renderOverview();

    try {
        const result = await fetchAPI('/momentum', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
        });
        if (result && result.id) {
            const idx = momentumItems.findIndex(i => i.id === temp.id);
            if (idx !== -1) momentumItems[idx] = result;
        }
    } catch (e) {
        console.error('Failed to add momentum item:', e);
    }
}

// ============================================
// Well Notes
// ============================================
async function addNote() {
    const input = document.getElementById('note-input');
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;

    const newNote = { author: currentPerson, content };
    const temp = { ...newNote, id: Date.now(), created_at: new Date().toISOString() };
    wellNotes.unshift(temp);
    input.value = '';
    // Only update notes list, not full well re-render
    updateNotesDisplay();

    try {
        const result = await fetchAPI('/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newNote)
        });
        if (result && result.id) {
            const idx = wellNotes.findIndex(i => i.id === temp.id);
            if (idx !== -1) wellNotes[idx] = result;
        }
    } catch (e) {
        console.error('Failed to add note:', e);
    }
}

// ============================================
// HD Profile Deep Data
// ============================================
const HD_PROFILES = {
    sunshine: {
        type: 'Manifesting Generator',
        typeShort: 'ManiGen',
        profile: '5/1',
        profileName: 'Heretic / Investigator',
        authority: 'Emotional (Solar Plexus)',
        strategy: 'To Respond + Inform',
        signature: 'Satisfaction + Peace',
        notSelf: 'Frustration + Anger',
        definition: 'Triple Split',
        sacralDefined: true,
        auraType: 'Open & Enveloping',
        centers: {
            defined: ['Sacral', 'Solar Plexus', 'Throat', 'G Center'],
            undefined: ['Head', 'Ajna', 'Will/Heart', 'Spleen', 'Root']
        },
        typeDescription: 'Manifesting Generators are multi-passionate powerhouses. You have the sustainable sacral energy of a Generator PLUS the manifesting capacity to initiate and move fast. You\'re designed to juggle, skip steps (efficiently), and follow your gut response to multiple interests at once.',
        strategyDetail: 'Wait to respond to something in your environment, THEN inform those affected before you act. Your emotional authority means you ride the full wave before committing. Never make major decisions at the peak (excitement) or valley (doubt) — wait for neutral clarity.',
        authorityDetail: 'Your Solar Plexus authority means there is no truth in the now for you. Every decision needs to pass through your full emotional wave — highs, lows, and the calm in between. The 72-hour rule is your friend. Sleep on it. Feel into it over days, not minutes.',
        profileDetail: {
            line5: 'The Heretic — You\'re projected upon as someone who can solve practical problems. People see you as a savior figure. This can be a gift (leadership) or a burden (unrealistic expectations). Your transpersonal karma means your work affects the collective.',
            line1: 'The Investigator — You have a deep need for a solid foundation of knowledge. You research, study, and dig until you feel secure in your understanding. This is your power base — never skip the investigation phase.'
        },
        definitionDetail: 'Triple Split means your defined centers form three separate groups that don\'t connect to each other internally. You literally need other people\'s energy to bridge your circuits. Group settings, collaboration, and having your full team present is essential for major decisions.',
        livingYourDesign: [
            'Track your emotional wave for a week — note highs, lows, and neutral points',
            'Practice saying "let me sleep on it" before any commitment over $100 or 1 hour',
            'Follow what lights up your sacral — the "mmhmm" sound or body pull',
            'Inform your team before pivoting (even if it feels like slowing down)',
            'Schedule Triple Split alignment: bring Monny and Bingle in for big decisions',
            'Give yourself permission to have 5+ projects at once — that\'s your design'
        ],
        hdQuotes: [
            'Your emotional wave is not a flaw — it\'s your superpower for depth.',
            'The world sees you as the solution. Make sure you see yourself that way too.',
            'Multi-passionate isn\'t scattered. It\'s your design working perfectly.',
            'Inform, don\'t ask permission. The world needs to know where you\'re headed.'
        ]
    },
    monny: {
        type: 'Generator',
        typeShort: 'Generator',
        profile: '5/1',
        profileName: 'Heretic / Investigator',
        authority: 'Sacral',
        strategy: 'To Respond',
        signature: 'Satisfaction',
        notSelf: 'Frustration',
        definition: 'Single Definition',
        sacralDefined: true,
        auraType: 'Open & Enveloping',
        centers: {
            defined: ['Sacral', 'Throat', 'G Center', 'Spleen'],
            undefined: ['Head', 'Ajna', 'Solar Plexus', 'Will/Heart', 'Root']
        },
        typeDescription: 'Pure Generators are the life force of the planet. You have deep, sustainable sacral energy — the most powerful motor in the bodygraph. Your design is to master what you love through response. When you\'re lit up, you can work tirelessly. When you\'re not, everything feels like slogging through mud.',
        strategyDetail: 'Wait to respond. Don\'t initiate from the mind — let life come to you and check your sacral response. The sacral speaks in sounds (uh-huh / nuh-uh) and body sensations (leaning in / pulling back). Your Sacral authority means your gut response IS the answer — no waiting needed.',
        authorityDetail: 'Sacral Authority is the most embodied of all authorities. Your gut knows instantly. The key is learning to hear it. Practice with yes/no questions. Notice the physical sensation — expansion (yes) or contraction (no). The sacral doesn\'t do "maybe" — that\'s your mind interfering.',
        profileDetail: {
            line5: 'The Heretic — Like Sunshine, you carry the 5th line gift of practical solutions. People project their needs onto you and expect universalized fixes. Your work naturally serves the collective. The shadow: burnout from taking on everyone\'s problems.',
            line1: 'The Investigator — Your foundation needs to be rock solid. You\'re the researcher, the one who goes deep before going wide. "Bridge / Embodied Expression" means you investigate thoroughly, then translate that into something others can feel and use.'
        },
        definitionDetail: 'Single Definition means all your defined centers connect in one continuous circuit. You don\'t need anyone else to feel whole — you process and integrate information independently. This gives you a self-contained reliability that the team counts on.',
        livingYourDesign: [
            'Practice sacral check-ins: Ask yourself yes/no questions and listen for the gut sound',
            'Keep a "sacral log" — what got a full-body yes this week? What got a no?',
            'Stop initiating. Wait for something to respond TO (conversation, request, idea)',
            'When frustrated, it\'s a signal you\'re doing work that\'s not yours',
            'Your 5/1 bridge role: research deeply, then share practical wisdom',
            'Honor the plateau — mastery takes sustained commitment, not quick pivots'
        ],
        hdQuotes: [
            'Your sacral is a truth machine. Learn to trust it over your mind.',
            'Frustration isn\'t failure — it\'s redirection toward what\'s truly yours.',
            'You are the bridge. Investigate, embody, then share.',
            'Satisfaction comes from responding to what lights you up — not what you think you should do.'
        ]
    },
    bingle: {
        type: 'Projector',
        typeShort: 'Projector',
        profile: '2/4',
        profileName: 'Hermit / Opportunist',
        authority: 'Ego (Will/Heart)',
        strategy: 'Wait for the Invitation',
        signature: 'Success (Recognition)',
        notSelf: 'Bitterness',
        definition: 'Single Definition',
        sacralDefined: false,
        auraType: 'Focused & Absorbing',
        centers: {
            defined: ['Will/Heart', 'G Center', 'Throat'],
            undefined: ['Head', 'Ajna', 'Solar Plexus', 'Sacral', 'Spleen', 'Root']
        },
        typeDescription: 'Projectors are the guides, managers, and seers of the world. Only ~20% of the population, and Ego Projectors are roughly 0.5% — extremely rare. You don\'t have consistent sacral energy, so you\'re NOT designed to work 8-hour days. Your gift is seeing deeply into others and systems, and guiding energy where it should go.',
        strategyDetail: 'Wait for the invitation for the big things in life — career, relationships, where to live, major projects. Recognition must come first. When people SEE you and invite your input, that\'s when your genius flows. Unsolicited advice, no matter how brilliant, lands flat.',
        authorityDetail: 'Ego/Willpower Authority means you check in with your willpower center: "Is this something I have the will for? What\'s in it for me?" This isn\'t selfish — it\'s essential. If your heart isn\'t in it, your energy won\'t sustain it. You need to genuinely want something to commit.',
        profileDetail: {
            line2: 'The Hermit — You have a natural genius that comes effortlessly, often without you knowing it. You need alone time to recharge and let your gifts percolate. Others see your talent before you do. Your "cave time" is not avoidance — it\'s where your magic incubates.',
            line4: 'The Opportunist — Your network IS your net worth. Opportunities come through people you know, not cold outreach. You\'re designed for warm connections and community building. Your influence ripples through relationships, not broadcasting.'
        },
        definitionDetail: 'Single Definition with an undefined Sacral means you feel others\' energy intensely but it\'s not yours to keep. You amplify and read sacral energy from Sunshine and Monny. This makes you the perfect guide — you can see their energy patterns more clearly than they can.',
        livingYourDesign: [
            'Schedule real rest into every day — not "productive rest", actual rest',
            'Practice: "Is this an invitation or am I inserting myself?"',
            'Ask the ego check: "Do I genuinely have the will/desire for this?"',
            'Honor your hermit time — genius needs solitude to incubate',
            'Your network is everything — nurture warm connections intentionally',
            'Track your energy: when do you feel amplified vs. drained? That\'s data.'
        ],
        hdQuotes: [
            'You are the rarest of the rare. Your perspective is the gift.',
            'Bitterness is the alarm that says: "I gave my genius away for free."',
            'Wait for the recognition. When they see you, magic happens.',
            'Rest is not the opposite of productivity for you — it IS productivity.'
        ]
    }
};

// ============================================
// HD Profile Tab Renderer
// ============================================
function renderHDProfile() {
    if (!currentPerson) return;
    const container = document.getElementById('ptab-hdprofile');
    if (!container) return;

    const p = PERSONS[currentPerson];
    const hd = HD_PROFILES[currentPerson];
    if (!hd) { container.innerHTML = '<p>No HD data available.</p>'; return; }

    // Daily HD quote rotation
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const hdQuote = hd.hdQuotes[dayOfYear % hd.hdQuotes.length];

    let html = '';

    // HD Daily Prompt
    html += `
        <div class="hd-daily-prompt">
            <span class="hd-daily-icon">🔮</span>
            <div>
                <div class="hd-daily-label">Today's HD Prompt</div>
                <div class="hd-daily-text">${hdQuote}</div>
            </div>
        </div>`;

    // Overview Card
    html += `
        <div class="hd-overview-card" style="border-top: 3px solid ${p.color}">
            <div class="hd-overview-header">
                <div class="hd-overview-type">${p.emoji} ${hd.type}</div>
                <div class="hd-overview-profile">${hd.profile} ${hd.profileName}</div>
            </div>
            <div class="hd-overview-grid">
                <div class="hd-overview-item">
                    <span class="hd-ov-label">Strategy</span>
                    <span class="hd-ov-value">${hd.strategy}</span>
                </div>
                <div class="hd-overview-item">
                    <span class="hd-ov-label">Authority</span>
                    <span class="hd-ov-value">${hd.authority}</span>
                </div>
                <div class="hd-overview-item">
                    <span class="hd-ov-label">Signature</span>
                    <span class="hd-ov-value hd-ov-positive">${hd.signature}</span>
                </div>
                <div class="hd-overview-item">
                    <span class="hd-ov-label">Not-Self Theme</span>
                    <span class="hd-ov-value hd-ov-caution">${hd.notSelf}</span>
                </div>
                <div class="hd-overview-item">
                    <span class="hd-ov-label">Definition</span>
                    <span class="hd-ov-value">${hd.definition}</span>
                </div>
                <div class="hd-overview-item">
                    <span class="hd-ov-label">Aura</span>
                    <span class="hd-ov-value">${hd.auraType}</span>
                </div>
            </div>
        </div>`;

    // Accordion sections
    const sections = [
        { id: 'type', icon: '⚡', title: `About ${hd.type}s`, content: hd.typeDescription },
        { id: 'strategy', icon: '🎯', title: 'Your Strategy', content: hd.strategyDetail },
        { id: 'authority', icon: '🧠', title: `${hd.authority} Authority`, content: hd.authorityDetail },
        { id: 'profile', icon: '🔮', title: `Profile ${hd.profile}: ${hd.profileName}`, content: renderProfileLines(hd) },
        { id: 'definition', icon: '💫', title: `${hd.definition} Definition`, content: hd.definitionDetail },
        { id: 'centers', icon: '⭕', title: 'Energy Centers', content: renderCentersContent(hd) },
        { id: 'practice', icon: '🌿', title: 'Living Your Design', content: renderPracticeContent(hd) }
    ];

    html += '<div class="hd-accordion">';
    sections.forEach((sec, idx) => {
        html += `
            <div class="hd-accordion-item ${idx === 0 ? 'open' : ''}">
                <button class="hd-accordion-header" onclick="toggleHDAccordion(this)">
                    <span class="hd-acc-icon">${sec.icon}</span>
                    <span class="hd-acc-title">${sec.title}</span>
                    <span class="hd-acc-chevron">▼</span>
                </button>
                <div class="hd-accordion-body">
                    ${sec.content}
                </div>
            </div>`;
    });
    html += '</div>';

    container.innerHTML = html;
}

function renderProfileLines(hd) {
    const lines = Object.entries(hd.profileDetail);
    return lines.map(([key, text]) => {
        const lineNum = key.replace('line', '');
        return `<div class="hd-profile-line">
            <div class="hd-profile-line-num">Line ${lineNum}</div>
            <div>${text}</div>
        </div>`;
    }).join('');
}

function renderCentersContent(hd) {
    let html = '<div class="hd-centers-wrap">';
    html += '<div class="hd-centers-group"><div class="hd-centers-group-title">Defined (Consistent Energy)</div>';
    html += '<div class="hd-centers-list">';
    hd.centers.defined.forEach(c => {
        html += `<span class="hd-center-pill hd-center-defined">${c}</span>`;
    });
    html += '</div></div>';
    html += '<div class="hd-centers-group"><div class="hd-centers-group-title">Undefined (Open to Influence)</div>';
    html += '<div class="hd-centers-list">';
    hd.centers.undefined.forEach(c => {
        html += `<span class="hd-center-pill hd-center-undefined">${c}</span>`;
    });
    html += '</div></div>';
    html += '</div>';
    html += `<p class="hd-centers-note">Defined centers = your reliable, consistent energy. Undefined centers = where you absorb and amplify others' energy (a gift and a vulnerability).</p>`;
    return html;
}

function renderPracticeContent(hd) {
    return '<ul class="hd-practice-list">' +
        hd.livingYourDesign.map(item => `<li>${item}</li>`).join('') +
        '</ul>';
}

function toggleHDAccordion(btn) {
    const item = btn.closest('.hd-accordion-item');
    item.classList.toggle('open');
}

// ============================================
// HD Calculator
// ============================================
function calculateHD() {
    const dateInput = document.getElementById('hd-calc-date');
    const timeInput = document.getElementById('hd-calc-time');
    const resultDiv = document.getElementById('hd-calc-result');

    if (!dateInput || !dateInput.value) {
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = '<p class="hd-calc-error">Please enter your birth date to continue.</p>';
        return;
    }

    const birthDate = new Date(dateInput.value + 'T' + (timeInput.value || '12:00'));
    const month = birthDate.getMonth() + 1;
    const day = birthDate.getDate();
    const hour = birthDate.getHours();

    // Sun sign approximation to determine HD type
    // This uses a seeded educational algorithm based on birth data
    const dayOfYear = getDayOfYear(birthDate);
    const seed = dayOfYear + (hour * 15);

    // Determine type based on position (educational approximation)
    const typeIndex = seed % 100;
    let hdType, strategy, authority, signature, notSelf;

    if (typeIndex < 35) {
        hdType = 'Generator';
        strategy = 'To Respond';
        signature = 'Satisfaction';
        notSelf = 'Frustration';
        authority = seed % 3 === 0 ? 'Sacral' : 'Emotional (Solar Plexus)';
    } else if (typeIndex < 70) {
        hdType = 'Manifesting Generator';
        strategy = 'To Respond + Inform';
        signature = 'Satisfaction + Peace';
        notSelf = 'Frustration + Anger';
        authority = seed % 2 === 0 ? 'Emotional (Solar Plexus)' : 'Sacral';
    } else if (typeIndex < 90) {
        hdType = 'Projector';
        strategy = 'Wait for the Invitation';
        signature = 'Success';
        notSelf = 'Bitterness';
        const authOptions = ['Splenic', 'Ego', 'Self-Projected', 'Mental'];
        authority = authOptions[seed % authOptions.length];
    } else if (typeIndex < 99) {
        hdType = 'Manifestor';
        strategy = 'To Inform';
        signature = 'Peace';
        notSelf = 'Anger';
        authority = seed % 2 === 0 ? 'Emotional (Solar Plexus)' : 'Splenic';
    } else {
        hdType = 'Reflector';
        strategy = 'Wait a Lunar Cycle (28 days)';
        signature = 'Surprise';
        notSelf = 'Disappointment';
        authority = 'Lunar';
    }

    // Profile lines
    const profileCombos = ['1/3', '1/4', '2/4', '2/5', '3/5', '3/6', '4/6', '4/1', '5/1', '5/2', '6/2', '6/3'];
    const profile = profileCombos[(dayOfYear + month) % profileCombos.length];

    const profileNames = {
        '1/3': 'Investigator / Martyr', '1/4': 'Investigator / Opportunist',
        '2/4': 'Hermit / Opportunist', '2/5': 'Hermit / Heretic',
        '3/5': 'Martyr / Heretic', '3/6': 'Martyr / Role Model',
        '4/6': 'Opportunist / Role Model', '4/1': 'Opportunist / Investigator',
        '5/1': 'Heretic / Investigator', '5/2': 'Heretic / Hermit',
        '6/2': 'Role Model / Hermit', '6/3': 'Role Model / Martyr'
    };

    const typeDescriptions = {
        'Generator': 'You have deep, sustainable sacral energy. When you respond to what lights you up, you can work tirelessly with satisfaction. Your aura is open and enveloping — people are drawn to your life force.',
        'Manifesting Generator': 'You\'re a multi-passionate powerhouse — Generator energy with Manifestor speed. You\'re designed to respond, then move fast. Skipping steps isn\'t a flaw, it\'s your efficiency in action.',
        'Projector': 'You\'re a guide and seer. Without consistent sacral energy, you\'re not here to work like Generators. Your gift is seeing deeply into others and systems. Wait for recognition and invitation.',
        'Manifestor': 'You\'re here to initiate and impact. Your closed and repelling aura means you need to inform others before acting. When you do, peace follows. You\'re the only type designed to just GO.',
        'Reflector': 'The rarest type (~1%). With no defined centers, you reflect the health of your community. Your 28-day lunar cycle authority means major decisions need a full month. You\'re the barometer of the collective.'
    };

    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `
        <div class="hd-calc-result-header">Your Human Design Overview</div>
        <div class="hd-calc-result-grid">
            <div class="hd-calc-result-item">
                <span class="hd-cr-label">Type</span>
                <span class="hd-cr-value">${hdType}</span>
            </div>
            <div class="hd-calc-result-item">
                <span class="hd-cr-label">Profile</span>
                <span class="hd-cr-value">${profile} ${profileNames[profile] || ''}</span>
            </div>
            <div class="hd-calc-result-item">
                <span class="hd-cr-label">Strategy</span>
                <span class="hd-cr-value">${strategy}</span>
            </div>
            <div class="hd-calc-result-item">
                <span class="hd-cr-label">Authority</span>
                <span class="hd-cr-value">${authority}</span>
            </div>
            <div class="hd-calc-result-item">
                <span class="hd-cr-label">Signature</span>
                <span class="hd-cr-value hd-ov-positive">${signature}</span>
            </div>
            <div class="hd-calc-result-item">
                <span class="hd-cr-label">Not-Self</span>
                <span class="hd-cr-value hd-ov-caution">${notSelf}</span>
            </div>
        </div>
        <div class="hd-calc-result-desc">${typeDescriptions[hdType]}</div>
    `;
}

function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

// ============================================
// Helpers
// ============================================
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatEventDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getEventColor(type) {
    const colors = {
        bhd: '#6B5344',
        cr8w: '#7BA89D',
        personal: currentPerson ? PERSONS[currentPerson].color : '#D4A5A5',
        launch: '#D46B6B'
    };
    return colors[type] || '#A89888';
}

function truncate(str, len) {
    return str.length > len ? str.substring(0, len) + '…' : str;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================
// Scroll-to-Top Button
// ============================================
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

(function initScrollTopBtn() {
    window.addEventListener('scroll', function() {
        const btn = document.getElementById('scroll-top-btn');
        if (!btn) return;
        if (window.scrollY > 400) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    }, { passive: true });
})();

// ============================================
// Station CRUD (live updates)
// ============================================
async function updateStationStatus(id, newStatus) {
    const station = stationsData.find(s => s.id === id);
    if (station) station.status = newStatus;
    renderGeyserStations();
    try {
        await fetchAPI('/stations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus })
        });
    } catch (e) { console.error('Failed to update station status:', e); }
}

async function updateStationOwner(id, newOwner) {
    const station = stationsData.find(s => s.id === id);
    if (station) station.owner = newOwner;
    renderGeyserStations();
    try {
        await fetchAPI('/stations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, owner: newOwner })
        });
    } catch (e) { console.error('Failed to update station owner:', e); }
}

function showAddStationModal() {
    const name = prompt('Station name:');
    if (!name) return;
    const emoji = prompt('Station emoji (e.g. \ud83c\udfb5):') || '\u2b50';
    const desc = prompt('Description:') || '';
    const owner = prompt('Owner (sunshine, monny, or bingle):') || '';
    addStation({ emoji, name, status: 'TBD', description: desc, owner, sort_order: 99 });
}

async function addStation(data) {
    const temp = { ...data, id: Date.now(), created_at: new Date().toISOString() };
    stationsData.push(temp);
    renderGeyserStations();
    try {
        const result = await fetchAPI('/stations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (result && result.id) {
            const idx = stationsData.findIndex(s => s.id === temp.id);
            if (idx !== -1) stationsData[idx] = result;
        }
    } catch (e) { console.error('Failed to add station:', e); }
}

// ============================================
// Announcement CRUD (live updates)
// ============================================
function showAddAnnouncementModal() {
    const text = prompt('New announcement:');
    if (!text) return;
    const priority = prompt('Priority (high, medium, low):') || 'high';
    addAnnouncement({ text, priority });
}

async function addAnnouncement(data) {
    const temp = { ...data, id: Date.now(), active: 1, created_at: new Date().toISOString() };
    announcementsData.unshift(temp);
    if (currentView === 'geyser' && currentGeyserTab === 'overview') renderGeyserOverview();
    renderHubAnnouncements();
    try {
        const result = await fetchAPI('/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (result && result.id) {
            const idx = announcementsData.findIndex(a => a.id === temp.id);
            if (idx !== -1) announcementsData[idx] = result;
        }
    } catch (e) { console.error('Failed to add announcement:', e); }
}

async function dismissAnnouncement(id) {
    announcementsData = announcementsData.filter(a => a.id !== id);
    if (currentView === 'geyser' && currentGeyserTab === 'overview') renderGeyserOverview();
    renderHubAnnouncements();
    try {
        await fetchAPI('/announcements', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, active: 0 })
        });
    } catch (e) { console.error('Failed to dismiss announcement:', e); }
}

// Update Hub Geyser Command Center with live announcements
function renderHubAnnouncements() {
    const urgentList = document.querySelector('.gcc-urgent-list');
    if (!urgentList) return;
    const announcements = getAnnouncements().slice(0, 3);
    if (announcements.length === 0) {
        urgentList.innerHTML = `
            <div class="gcc-urgent-label">🔥 Top Priority Right Now</div>
            <div style="color:rgba(255,255,255,0.75);font-size:0.85rem;padding:8px 12px;font-style:italic">No urgent items — looking good ✨</div>`;
        return;
    }
    urgentList.innerHTML = `
        <div class="gcc-urgent-label">🔥 Top Priority Right Now</div>
        ${announcements.map(a => `
            <div class="gcc-urgent-item">
                <span class="gcc-priority-badge ${a.priority}">${a.priority.toUpperCase()}</span>
                <span class="gcc-urgent-text">${a.text}</span>
            </div>
        `).join('')}`;
}

// ============================================
// Per-Person Google Calendar Embed (simplified)
// ============================================
function getPersonCalendarEmbed(person) {
    const acct = GOOGLE_ACCOUNTS[person];
    if (acct && acct.calendarSrc) {
        return `https://calendar.google.com/calendar/embed?src=${acct.calendarSrc}&ctz=America%2FLos_Angeles&mode=AGENDA&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0&color=%23C25B38`;
    }
    return null;
}

// ============================================
// Next BHD Banner (with expand/collapse)
// ============================================
let bhdExpanded = false;
let nextBHDEvent = null;

function toggleBHDDetails() {
    const banner = document.getElementById('bhd-banner');
    if (!banner) return;
    bhdExpanded = !bhdExpanded;
    banner.classList.toggle('expanded', bhdExpanded);
}

function updateBHDBanner() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bhdEvents = CALENDAR_EVENTS
        .filter(e => e.type === 'bhd')
        .map(e => ({ ...e, dateObj: new Date(e.date + 'T00:00:00') }))
        .filter(e => e.dateObj >= today)
        .sort((a, b) => a.dateObj - b.dateObj);

    const dateEl = document.getElementById('bhd-next-date');
    const timeEl = document.getElementById('bhd-next-time');
    const detailsGrid = document.getElementById('bhd-details-grid');
    if (!dateEl) return;

    if (bhdEvents.length > 0) {
        const next = bhdEvents[0];
        nextBHDEvent = next;
        const opts = { weekday: 'long', month: 'long', day: 'numeric' };
        dateEl.textContent = next.dateObj.toLocaleDateString('en-US', opts);
        const diffDays = Math.ceil((next.dateObj - today) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            timeEl.textContent = 'TODAY · ' + (next.time || '');
        } else if (diffDays === 1) {
            timeEl.textContent = 'Tomorrow · ' + (next.time || '');
        } else {
            timeEl.textContent = diffDays + ' days away · ' + (next.time || '');
        }

        // Populate dropdown details
        if (detailsGrid) {
            const attendeesHTML = next.persons
                ? next.persons.map(p => {
                    const person = PERSONS[p];
                    return person ? `<span style="color:${person.color}">${person.emoji} ${capitalize(p)}</span>` : capitalize(p);
                }).join(', ')
                : 'All';

            const upcomingList = bhdEvents.slice(0, 4).map(e => {
                const d = e.dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return d;
            }).join(' → ');

            detailsGrid.innerHTML = `
                <div class="bhd-detail-item">
                    <span class="bhd-detail-icon">⏰</span>
                    <div>
                        <div class="bhd-detail-label">Time</div>
                        <div class="bhd-detail-value">${next.time || 'TBD'}</div>
                    </div>
                </div>
                <div class="bhd-detail-item">
                    <span class="bhd-detail-icon">👥</span>
                    <div>
                        <div class="bhd-detail-label">Attendees</div>
                        <div class="bhd-detail-value">${attendeesHTML}</div>
                    </div>
                </div>
                <div class="bhd-detail-item">
                    <span class="bhd-detail-icon">🎯</span>
                    <div>
                        <div class="bhd-detail-label">Type</div>
                        <div class="bhd-detail-value">${next.type === 'bhd' ? 'BHD Meeting' : capitalize(next.type)}</div>
                    </div>
                </div>
                <div class="bhd-detail-item">
                    <span class="bhd-detail-icon">📅</span>
                    <div>
                        <div class="bhd-detail-label">Upcoming</div>
                        <div class="bhd-detail-value">${upcomingList}</div>
                    </div>
                </div>`;
        }
    } else {
        dateEl.textContent = 'No upcoming BHD scheduled';
        timeEl.textContent = '';
        nextBHDEvent = null;
        if (detailsGrid) detailsGrid.innerHTML = '';
    }
}

// ============================================
// Brain Dump Feature
// ============================================
function renderBrainDumpList() {
    const container = document.getElementById('brain-dump-list');
    if (!container) return;

    if (!brainDumps || brainDumps.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;font-style:italic;padding:16px;text-align:center">No brain dumps yet — be the first to dump a thought 🧠</div>';
        return;
    }

    container.innerHTML = brainDumps.map(d => {
        const p = PERSONS[d.author];
        const color = p ? p.color : 'var(--deep-rust)';
        const emoji = p ? p.emoji : '🌀';
        const tags = d.tags ? d.tags.split(',').map(t => t.trim()).filter(t => t) : [];
        return `
            <div class="brain-dump-entry">
                <div class="bde-header">
                    <span class="bde-author" style="color:${color}">${emoji} ${capitalize(d.author)}</span>
                    <span class="bde-time">${formatTimestamp(d.created_at)}</span>
                </div>
                <div class="bde-content">${d.content}</div>
                ${tags.length > 0 ? `<div class="bde-tags">${tags.map(t => `<span class="bde-tag">${t}</span>`).join('')}</div>` : ''}
                ${d.drive_link ? `<a href="${d.drive_link}" target="_blank" rel="noopener noreferrer" class="bde-drive-link">🔗 View Link</a>` : ''}
            </div>`;
    }).join('');
}

async function submitBrainDump() {
    const contentEl = document.getElementById('brain-dump-content');
    const authorEl = document.getElementById('brain-dump-author');
    const tagsEl = document.getElementById('brain-dump-tags');
    const driveLinkEl = document.getElementById('brain-dump-drive-link');

    const content = contentEl ? contentEl.value.trim() : '';
    if (!content) return;

    const author = authorEl ? authorEl.value : 'collective';
    const tags = tagsEl ? tagsEl.value.trim() : '';
    const driveLink = driveLinkEl ? driveLinkEl.value.trim() : '';

    const newDump = { author, content, tags, drive_link: driveLink };
    const temp = { ...newDump, id: Date.now(), created_at: new Date().toISOString() };
    brainDumps.unshift(temp);

    // Clear inputs
    if (contentEl) contentEl.value = '';
    if (tagsEl) tagsEl.value = '';
    if (driveLinkEl) driveLinkEl.value = '';

    renderBrainDumpList();

    try {
        const result = await fetchAPI('/brain_dumps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newDump)
        });
        if (result && result.id) {
            const idx = brainDumps.findIndex(d => d.id === temp.id);
            if (idx !== -1) brainDumps[idx] = result;
        }
    } catch (e) {
        console.error('Failed to add brain dump:', e);
    }
}

// ============================================
// MBody / MonnyLog Roulette
// ============================================
const MBODY_PRACTICES = [
    { category: 'Somatic', title: 'Body Scan', desc: 'Close your eyes. Starting from the top of your head, slowly scan down through your body. Notice any areas of tension, warmth, or tingling. Stay with each sensation for 3 breaths.' },
    { category: 'Somatic', title: 'Shake It Out', desc: 'Stand up and shake your hands, arms, legs — your whole body for 60 seconds. Let whatever wants to move, move. Then stop and notice the buzz.' },
    { category: 'Somatic', title: 'Butterfly Hug', desc: 'Cross your arms over your chest, hands resting on opposite shoulders. Gently alternate tapping, left then right, for 2 minutes. Breathe slowly.' },
    { category: 'Writing', title: 'Stream of Consciousness', desc: 'Set a 5-minute timer. Write without stopping, without editing, without lifting your pen. Let whatever comes, come. No judgment.' },
    { category: 'Writing', title: 'Letter to Future Self', desc: 'Write a letter to yourself one year from now. What do you want them to know? What are you proud of right now? What are you working toward?' },
    { category: 'Writing', title: 'Gratitude Dump', desc: 'List 10 things you\'re grateful for right now. Include at least 3 body sensations and 2 people. Don\'t overthink — just flow.' },
    { category: 'Breathwork', title: '4-7-8 Reset', desc: 'Inhale through your nose for 4 counts. Hold for 7 counts. Exhale slowly through your mouth for 8 counts. Repeat 4 cycles.' },
    { category: 'Breathwork', title: 'Box Breathing', desc: 'Inhale 4 counts. Hold 4 counts. Exhale 4 counts. Hold empty 4 counts. Repeat 6 times. Feel the square shape of your breath.' },
    { category: 'Breathwork', title: 'Sighing Breath', desc: 'Take a deep breath in through your nose, then add a second smaller inhale on top. Exhale with a long audible sigh through your mouth. Repeat 5 times.' },
    { category: 'Sound', title: 'Hum Meditation', desc: 'Close your eyes and hum at a comfortable pitch for 5 minutes. Feel the vibration in your chest and throat. Let the sound ground you.' },
    { category: 'Sound', title: 'Nature Sounds', desc: 'Find a nature soundscape (rain, ocean, forest). Close your eyes and listen for 3 minutes. Count how many distinct sounds you can identify.' },
    { category: 'Sound', title: 'Vocal Toning', desc: 'Pick a vowel sound (Ah, Oh, Mm). Sustain it on a single tone for one full exhale. Repeat 7 times, letting each one deepen.' }
];

function showMBodyRoulette() {
    navigateTo('playground');
    setTimeout(() => switchPlaygroundTab('mbody'), 150);
}

function spinMBodyRoulette() {
    const spinCircle = document.querySelector('.mbody-spin-circle');
    const resultEl = document.getElementById('mbody-result');
    const catEl = document.getElementById('mbody-result-category');
    const titleEl = document.getElementById('mbody-result-title');
    const descEl = document.getElementById('mbody-result-desc');

    if (!spinCircle || !resultEl) return;

    // Hide result, start spin animation
    resultEl.classList.add('hidden');
    spinCircle.classList.remove('spinning');
    void spinCircle.offsetHeight; // force reflow
    spinCircle.classList.add('spinning');

    // Pick random practice
    const practice = MBODY_PRACTICES[Math.floor(Math.random() * MBODY_PRACTICES.length)];

    setTimeout(() => {
        spinCircle.classList.remove('spinning');
        catEl.textContent = practice.category;
        titleEl.textContent = practice.title;
        descEl.textContent = practice.desc;
        resultEl.classList.remove('hidden');
    }, 1300);
}

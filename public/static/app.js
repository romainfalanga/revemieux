// ============================================
// Rêve Mieux — Application Frontend SPA
// Journal de Rêves Lucides
// ============================================

const API = '/api';
let state = {
  user: null,
  token: localStorage.getItem('ds_token'),
  currentView: 'journal',
  dreams: [],
  pagination: { page: 1, limit: 20, total: 0 },
  tags: [],
  series: [],
  stats: null,

  editingDream: null,
  filters: { type: 'all', tagIds: [], emotions: [], minIntensity: 1, maxIntensity: 5 },
  dreamDetailId: null, // for dream sub-page view
  previousView: null   // to remember where to go back
};

// ========== API Helper ==========
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const data = await res.json();
  if (!res.ok) {
    // Ne pas logout sur les routes d'auth (login/register) : c'est une erreur de formulaire, pas une session expirée
    const isAuthRoute = path.startsWith('/auth/login') || path.startsWith('/auth/register');
    if (res.status === 401 && !isAuthRoute) { logout(); throw new Error('Session expirée, reconnectez-vous'); }
    throw new Error(data.error || 'Erreur serveur');
  }
  return data;
}

// ========== Auth ==========
function logout() {
  state.token = null; state.user = null;
  localStorage.removeItem('ds_token');
  renderAuth();
}

async function checkAuth() {
  if (!state.token) return renderAuth();
  try {
    const { user } = await api('/auth/me');
    state.user = user;
    renderApp();
  } catch { renderAuth(); }
}

function renderAuth() {
  document.getElementById('loading-screen')?.remove();
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4 stars-bg">
      <div class="glass rounded-2xl p-6 sm:p-8 w-full max-w-md animate-slideUp">
        <div class="text-center mb-8">
          <div class="text-5xl mb-3 animate-float">🌙</div>
          <h1 class="text-3xl font-display font-bold bg-gradient-to-r from-dream-300 to-dream-500 bg-clip-text text-transparent">Rêve Mieux</h1>
          <p class="text-gray-400 mt-2 text-sm">Journal de Rêves Lucides</p>
        </div>
        <div class="flex mb-6 bg-night-900/50 rounded-lg p-1">
          <button onclick="showAuthTab('login')" id="tab-login" class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all bg-dream-600 text-white">Connexion</button>
          <button onclick="showAuthTab('register')" id="tab-register" class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all text-gray-400 hover:text-white">Inscription</button>
        </div>
        <form id="auth-form" onsubmit="handleAuth(event)">
          <input type="email" name="login" placeholder="Email" required class="w-full mb-3 px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none transition-colors">
          <input type="password" name="password" placeholder="Mot de passe" required minlength="6" class="w-full mb-4 px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none transition-colors">
          <div id="auth-error" class="text-red-300 text-sm mb-3 hidden px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg"></div>
          <button type="submit" id="auth-btn" class="w-full py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg font-semibold hover:from-dream-400 hover:to-dream-600 transition-all shadow-lg shadow-dream-500/20">Se connecter</button>
        </form>
      </div>
    </div>`;
}

let authMode = 'login';
window.showAuthTab = function(mode) {
  authMode = mode;
  document.getElementById('tab-login').className = `flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'login' ? 'bg-dream-600 text-white' : 'text-gray-400 hover:text-white'}`;
  document.getElementById('tab-register').className = `flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'register' ? 'bg-dream-600 text-white' : 'text-gray-400 hover:text-white'}`;
  document.getElementById('auth-btn').textContent = mode === 'login' ? 'Se connecter' : "S'inscrire";
};

window.handleAuth = async function(e) {
  e.preventDefault();
  const form = new FormData(e.target);
  const errEl = document.getElementById('auth-error');
  const btn = document.getElementById('auth-btn');
  errEl.classList.add('hidden');
  // Disable button pendant la requête
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>' + (authMode === 'login' ? 'Connexion...' : 'Inscription...');
  try {
    let data;
    if (authMode === 'login') {
      data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ login: form.get('login'), password: form.get('password') }) });
    } else {
      const email = form.get('login');
      data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password: form.get('password') })});
    }
    state.token = data.token; state.user = data.user;
    localStorage.setItem('ds_token', data.token);
    renderApp();
  } catch (err) {
    // Messages d'erreur contextuels et clairs
    let msg = err.message;
    if (authMode === 'login') {
      if (msg.includes('Identifiants incorrects')) msg = 'Email ou mot de passe incorrect. Vérifiez vos identifiants.';
      else if (msg.includes('Identifiant et mot de passe requis')) msg = 'Veuillez remplir tous les champs.';
    } else {
      if (msg.includes('existe déjà')) msg = 'Un compte avec cet email ou nom d\'utilisateur existe déjà. Essayez de vous connecter.';
      else if (msg.includes('au moins 6')) msg = 'Le mot de passe doit contenir au moins 6 caractères.';
      else if (msg.includes('requis')) msg = 'Veuillez remplir tous les champs obligatoires.';
    }
    errEl.innerHTML = '<i class="fas fa-exclamation-circle mr-1.5"></i>' + msg;
    errEl.classList.remove('hidden');
    // Animation shake sur le formulaire
    const formEl = document.getElementById('auth-form');
    formEl.classList.add('animate-shake');
    setTimeout(() => formEl.classList.remove('animate-shake'), 500);
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? 'Se connecter' : "S'inscrire";
  }
};

// ========== Main App Shell ==========
function renderApp() {
  document.getElementById('loading-screen')?.remove();
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-shell">
      <!-- Header -->
      <header class="glass sticky top-0 z-30 px-3 sm:px-4 py-2.5 sm:py-3 shrink-0">
        <div class="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xl sm:text-2xl">🌙</span>
            <h1 class="text-sm sm:text-lg font-display font-bold text-dream-200">Rêve Mieux</h1>
          </div>
          <nav class="hidden sm:flex gap-1" id="main-nav-desktop">
            <button onclick="navigate('journal')" data-nav="journal" class="nav-tab px-3 py-2 rounded-lg text-sm font-medium transition-all"><i class="fas fa-book-open mr-1"></i>Journal</button>
            <button onclick="navigate('series')" data-nav="series" class="nav-tab px-3 py-2 rounded-lg text-sm font-medium transition-all"><i class="fas fa-layer-group mr-1"></i>Séries</button>
            <button onclick="navigate('intentions')" data-nav="intentions" class="nav-tab px-3 py-2 rounded-lg text-sm font-medium transition-all"><i class="fas fa-lightbulb mr-1"></i>Intentions</button>
            <button onclick="navigate('lucidity')" data-nav="lucidity" class="nav-tab px-3 py-2 rounded-lg text-sm font-medium transition-all"><i class="fas fa-eye mr-1"></i>Rêve mieux</button>
          </nav>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs text-gray-400 hidden lg:block">${state.user?.displayName}</span>
            <button onclick="logout()" class="text-gray-400 hover:text-red-400 transition-colors p-2" title="Déconnexion"><i class="fas fa-sign-out-alt"></i></button>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main id="main-content" class="flex-1 overflow-y-auto max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 sm:pb-6" style="padding-bottom:5rem;"></main>

      <!-- Mobile Bottom Nav — inline styles for bulletproof positioning -->
      <nav id="main-nav-mobile" class="sm:hidden" style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(10,8,25,0.97);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-top:1px solid rgba(139,92,246,0.2);padding-bottom:env(safe-area-inset-bottom,0px);margin:0;transform:translateZ(0);">
        <div class="flex justify-around items-center py-1.5 px-1">
          <button onclick="navigate('journal')" data-nav="journal" class="nav-tab flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all min-w-[44px]">
            <i class="fas fa-book-open text-base"></i><span>Journal</span>
          </button>
          <button onclick="navigate('series')" data-nav="series" class="nav-tab flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all min-w-[44px]">
            <i class="fas fa-layer-group text-base"></i><span>Séries</span>
          </button>
          <button onclick="navigate('intentions')" data-nav="intentions" class="nav-tab flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all min-w-[44px]">
            <i class="fas fa-lightbulb text-base"></i><span>Intentions</span>
          </button>
          <button onclick="navigate('lucidity')" data-nav="lucidity" class="nav-tab flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all min-w-[44px]">
            <i class="fas fa-eye text-base"></i><span>Rêve mieux</span>
          </button>
        </div>
      </nav>

      <!-- Boutons flottants : RC + Refrain + Nouveau rêve -->
      <div id="floating-player" class="fixed z-[9998] flex flex-col items-center gap-2" style="bottom:85px;right:12px;">
        <!-- Bouton Reality Check -->
        <button onclick="quickRealityCheck()" id="floating-rc-btn"
          class="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-90"
          style="background:linear-gradient(135deg,rgba(16,185,129,0.85),rgba(6,182,212,0.85));backdrop-filter:blur(8px);"
          title="Reality Check validé">
          <i class="fas fa-check text-sm"></i>
        </button>
        <!-- Bouton Refrain -->
        <div class="relative">
          <button onclick="toggleReveMieuxPlayer()" id="floating-play-btn"
            class="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-all"
            style="background:linear-gradient(135deg,rgba(245,158,11,0.85),rgba(139,92,246,0.85));backdrop-filter:blur(8px);"
            title="Refrain Rêve Mieux">
            <i id="floating-play-icon" class="fas fa-play text-sm"></i>
          </button>
          <div id="floating-progress-ring" class="absolute inset-0 pointer-events-none">
            <svg width="44" height="44" viewBox="0 0 44 44" class="w-full h-full -rotate-90">
              <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
              <circle id="floating-progress-circle" cx="22" cy="22" r="20" fill="none" stroke="rgba(245,158,11,0.9)" stroke-width="2" stroke-linecap="round" stroke-dasharray="125.66" stroke-dashoffset="125.66"/>
            </svg>
          </div>
        </div>
        <!-- Bouton Nouveau Rêve -->
        <button onclick="openDreamEditor()"
          class="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-90"
          style="background:linear-gradient(135deg,rgba(99,102,241,0.9),rgba(139,92,246,0.9));backdrop-filter:blur(8px);"
          title="Nouveau rêve">
          <i class="fas fa-plus text-sm"></i>
        </button>
      </div>
      <style>
        @media (min-width: 640px) {
          #floating-player { bottom: 24px !important; right: 24px !important; }
        }
      </style>
    </div>
    <div id="modal-container"></div>
  `;
  navigate(state.currentView);

  // Auto-play refrain si ouvert depuis la notification avec ?autoplay=refrain
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('autoplay') === 'refrain') {
    // Retirer le paramètre de l'URL pour éviter de re-jouer au refresh
    window.history.replaceState({}, '', window.location.pathname);
    // Attendre que la page soit prête puis lancer le refrain
    setTimeout(() => { playTLRRefrain(); }, 1000);
  }
}

window.navigate = function(view) {
  state.currentView = view;
  // Highlight nav: lucidity-level1 and lucidity-level2 highlight the lucidity tab
  const navView = (view === 'lucidity-level2' || view === 'lucidity-level1') ? 'lucidity' : view;
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === navView);
    btn.classList.toggle('text-dream-300', btn.dataset.nav === navView);
    btn.classList.toggle('text-gray-400', btn.dataset.nav !== navView);
  });
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="flex justify-center py-12"><div class="animate-spin text-dream-400 text-2xl"><i class="fas fa-circle-notch"></i></div></div>';
  switch (view) {
    case 'journal': renderJournal(); break;
    case 'series': renderSeries(); break;
    case 'intentions': renderIntentions(); break;
    case 'lucidity': renderDashboard(); break;
    case 'lucidity-level1': renderLucidity(); break;
    case 'lucidity-level2': renderLucidityLevel2(); break;
    case 'dream-detail': renderDreamDetailPage(state.dreamDetailId); break;
  }
  // Scroll en haut du contenu a chaque navigation
  const mc = document.getElementById('main-content');
  if (mc) mc.scrollTop = 0;
};

// ========== JOURNAL VIEW ==========
async function renderJournal() {
  const main = document.getElementById('main-content');

  // Load user tags grouped by category for the filter UI
  let groupedTags = {};
  try { groupedTags = (await api('/tags/grouped')).grouped || {}; } catch {}

  try {
    const params = new URLSearchParams({ page: state.pagination.page, limit: state.pagination.limit });
    if (state.filters.type !== 'all') params.set('type', state.filters.type);
    if (state.filters.tagIds.length > 0) params.set('tags', state.filters.tagIds.join(','));
    if (state.filters.emotions.length > 0) {
      params.set('emotion', state.filters.emotions.join(','));
      params.set('minIntensity', state.filters.minIntensity);
      params.set('maxIntensity', state.filters.maxIntensity);
    }
    const data = await api(`/dreams?${params}`);
    state.dreams = data.dreams; state.pagination = data.pagination;
  } catch (err) { main.innerHTML = `<div class="text-center py-12 text-red-400">${err.message}</div>`; return; }

  const activeFilterCount = state.filters.tagIds.length + (state.filters.type !== 'all' ? 1 : 0) + state.filters.emotions.length;

  const categoryLabels = { person: '👤 Personnes', place: '📍 Lieux', theme: '🎭 Thèmes', symbol: '🔮 Symboles', custom: '🏷️ Tags' };
  const categoryOrder = ['person', 'place', 'theme', 'symbol', 'custom'];
  const hasAnyTags = Object.keys(groupedTags).length > 0;

  // Build tag filter chips grouped by category
  let tagFilterHTML = '';
  if (hasAnyTags) {
    tagFilterHTML = categoryOrder
      .filter(cat => groupedTags[cat]?.length > 0)
      .map(cat => `
        <div class="mb-2">
          <p class="text-[9px] text-gray-500 font-semibold uppercase mb-1">${categoryLabels[cat] || cat}</p>
          <div class="flex flex-wrap gap-1">
            ${groupedTags[cat].map(t => {
              const isActive = state.filters.tagIds.includes(t.id);
              return `<button onclick="toggleTagFilter(${t.id})"
                class="px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer ${isActive ? 'ring-1 ring-white/40 shadow-sm' : 'opacity-70 hover:opacity-100'}"
                style="background:${isActive ? t.color + '40' : t.color + '15'}; color:${t.color}; border: 1px solid ${isActive ? t.color + '80' : t.color + '25'}"
                >${escapeHtml(t.name)}${isActive ? ' <i class="fas fa-times text-[8px] ml-0.5"></i>' : ''}</button>`;
            }).join('')}
          </div>
        </div>
      `).join('');
  }

  // Build emotion filter HTML
  const emotionFilterHTML = EMOTION_LIST.map(em => {
    const isActive = state.filters.emotions.includes(em);
    return `<button onclick="toggleEmotionFilter('${em}')"
      class="px-2 py-1 rounded-full text-[10px] font-medium transition-all cursor-pointer ${isActive ? 'border-dream-400 bg-dream-600/30 text-dream-200 ring-1 ring-dream-400/40' : 'border-dream-700/20 bg-night-900/40 text-gray-400 hover:text-gray-200'}" style="border:1px solid ${isActive ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.15)'}">
      ${EMOTION_EMOJIS[em]} ${EMOTION_LABELS[em]}${isActive ? ' <i class="fas fa-times text-[8px] ml-0.5"></i>' : ''}
    </button>`;
  }).join('');

  main.innerHTML = `
    <div class="animate-slideUp">
      <div class="flex flex-col gap-3 mb-5">
        <div class="flex gap-2 items-center flex-wrap">
          <button onclick="toggleFilterPanel()" class="px-3 py-2.5 ${activeFilterCount > 0 ? 'bg-dream-600/40 text-dream-200 border-dream-400/40' : 'bg-night-900/60 text-gray-400 border-dream-700/30'} border rounded-xl text-sm font-medium transition-all flex items-center gap-1.5">
            <i class="fas fa-filter text-xs"></i>
            <span class="text-xs">Filtres</span>
            ${activeFilterCount > 0 ? `<span class="w-4 h-4 bg-dream-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">${activeFilterCount}</span>` : ''}
          </button>
          ${activeFilterCount > 0 ? `<button onclick="clearAllFilters()" class="px-2.5 py-2.5 text-red-400/70 hover:text-red-300 text-xs transition-all"><i class="fas fa-times-circle mr-1"></i>Réinit.</button>` : ''}
          <button onclick="openDreamEditor()" class="hidden sm:flex px-4 py-2.5 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-xl text-sm font-medium hover:from-dream-400 hover:to-dream-600 transition-all whitespace-nowrap items-center gap-1.5 ml-auto">
            <i class="fas fa-plus"></i> Nouveau rêve
          </button>
        </div>
        <!-- Active filters display -->
        ${(state.filters.type !== 'all' || state.filters.tagIds.length > 0 || state.filters.emotions.length > 0) ? `
        <div class="flex flex-wrap gap-1 items-center">
          <span class="text-[9px] text-gray-500 mr-1">Filtres actifs :</span>
          ${state.filters.type !== 'all' ? `<span class="px-1.5 py-0.5 rounded-full text-[9px] font-medium flex items-center gap-1 bg-dream-600/30 text-dream-200 border border-dream-400/40">${(DREAM_TYPES.find(t=>t.value===state.filters.type)||{}).icon||''} ${(DREAM_TYPES.find(t=>t.value===state.filters.type)||{}).label||state.filters.type} <i class="fas fa-times cursor-pointer text-[7px] opacity-60 hover:opacity-100" onclick="filterType('all')"></i></span>` : ''}
          ${state.filters.emotions.map(em => `<span class="px-1.5 py-0.5 rounded-full text-[9px] font-medium flex items-center gap-1 bg-dream-600/30 text-dream-200 border border-dream-400/40">${EMOTION_EMOJIS[em]} ${EMOTION_LABELS[em]} <i class="fas fa-times cursor-pointer text-[7px] opacity-60 hover:opacity-100" onclick="toggleEmotionFilter('${em}')"></i></span>`).join('')}
          ${state.filters.tagIds.map(tid => {
            const tag = Object.values(groupedTags).flat().find(t => t.id === tid);
            return tag ? `<span class="px-1.5 py-0.5 rounded-full text-[9px] font-medium flex items-center gap-1" style="background:${tag.color}30; color:${tag.color}; border:1px solid ${tag.color}50">${escapeHtml(tag.name)} <i class="fas fa-times cursor-pointer text-[7px] opacity-60 hover:opacity-100" onclick="toggleTagFilter(${tid})"></i></span>` : '';
          }).join('')}
        </div>` : ''}
      </div>

      <!-- Expandable filter panel — all filters apply in real-time -->
      <div id="filter-panel" class="${_filterPanelOpen ? '' : 'hidden'} mb-4 glass rounded-xl p-3 animate-slideUp">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-xs font-semibold text-dream-200"><i class="fas fa-filter mr-1.5"></i>Filtres</h4>
          <button onclick="toggleFilterPanel()" class="text-gray-400 hover:text-white text-xs"><i class="fas fa-times"></i></button>
        </div>
        <!-- Type de rêve filter -->
        <div class="mb-3">
          <p class="text-[9px] text-gray-500 font-semibold uppercase mb-1.5">Type de rêve</p>
          <div class="flex flex-wrap gap-1.5">
            ${[{v:'all',icon:'🔮',l:'Tous'}, ...DREAM_TYPES.map(t=>({v:t.value,icon:t.icon,l:t.label}))].map(t => `
              <button onclick="filterType('${t.v}')"
                class="px-2 py-1 rounded-lg text-[10px] font-medium border transition-all ${state.filters.type === t.v ? 'border-dream-400 bg-dream-600/30 text-dream-200' : 'border-dream-700/20 bg-night-900/40 text-gray-400 hover:text-gray-200 hover:border-dream-700/40'}">
                ${t.icon} ${t.l}
              </button>
            `).join('')}
          </div>
        </div>
        <!-- Emotion filter -->
        <div class="mb-3">
          <p class="text-[9px] text-gray-500 font-semibold uppercase mb-1.5">Émotion</p>
          <div class="flex flex-wrap gap-1.5">
            ${emotionFilterHTML}
          </div>
          ${state.filters.emotions.length > 0 ? `
          <div class="mt-2 p-2 rounded-lg bg-night-900/50 border border-dream-700/20">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[10px] text-dream-200 font-medium">${state.filters.emotions.map(em => EMOTION_EMOJIS[em]).join(' ')} Intensit\u00e9 : ${state.filters.minIntensity} - ${state.filters.maxIntensity}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[9px] text-gray-500 shrink-0">Min</span>
              <input type="range" min="1" max="5" value="${state.filters.minIntensity}" class="flex-1 accent-dream-400"
                oninput="setEmotionFilterIntensity('min', parseInt(this.value))">
              <span class="text-[9px] text-gray-500 shrink-0">Max</span>
              <input type="range" min="1" max="5" value="${state.filters.maxIntensity}" class="flex-1 accent-dream-400"
                oninput="setEmotionFilterIntensity('max', parseInt(this.value))">
            </div>
          </div>` : ''}
        </div>
        <!-- Tags filter -->
        <div>
          <p class="text-[9px] text-gray-500 font-semibold uppercase mb-1.5">Tags</p>
          ${hasAnyTags ? tagFilterHTML : '<p class="text-[10px] text-gray-500 italic py-2 text-center">Aucun tag créé. Ajoutez des tags à vos rêves pour les utiliser comme filtres.</p>'}
        </div>
      </div>

      <div id="dreams-list" class="space-y-3">
        ${state.dreams.length === 0 ? `
          <div class="text-center py-12">
            <div class="text-5xl mb-4 animate-float">${activeFilterCount > 0 ? '🔍' : '🌙'}</div>
            <h3 class="text-lg font-display font-semibold text-dream-200 mb-2">${activeFilterCount > 0 ? 'Aucun rêve trouvé' : 'Votre journal est vide'}</h3>
            <p class="text-gray-400 mb-6 max-w-md mx-auto text-sm">${activeFilterCount > 0 ? 'Essayez de modifier vos filtres pour élargir la recherche.' : 'Commencez à noter vos rêves dès le réveil.'}</p>
            ${activeFilterCount > 0 ? `<button onclick="clearAllFilters()" class="px-6 py-3 bg-night-800/60 text-gray-300 rounded-xl font-medium hover:bg-night-800/80 transition-all"><i class="fas fa-times-circle mr-2"></i>Réinitialiser les filtres</button>` : `<button onclick="openDreamEditor()" class="px-6 py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-xl font-medium"><i class="fas fa-feather-alt mr-2"></i>Noter mon premier rêve</button>`}
          </div>
        ` : state.dreams.map(d => renderDreamCard(d)).join('')}
      </div>
      ${state.pagination.pages > 1 ? `<div class="flex justify-center gap-2 mt-6">${Array.from({ length: state.pagination.pages }, (_, i) => `<button onclick="goToPage(${i + 1})" class="w-9 h-9 rounded-lg text-sm font-medium transition-all ${state.pagination.page === i + 1 ? 'bg-dream-600 text-white' : 'bg-night-900/60 text-gray-400 hover:text-white'}">${i + 1}</button>`).join('')}</div>` : ''}
    </div>`;

}

function renderDreamCard(d) {
  const typeIcons = Object.fromEntries(DREAM_TYPES.map(t => [t.value, t.icon]));
  const typeLabels = Object.fromEntries(DREAM_TYPES.map(t => [t.value, t.label]));
  const emotionEmojis = { joy: '😊', fear: '😨', anxiety: '😰', wonder: '🤩', sadness: '😢', anger: '😡', confusion: '😵', peace: '😌', excitement: '🤯', love: '💗', nostalgia: '🥺' };
  const emotionLabels = { joy: 'Joie', fear: 'Peur', anxiety: 'Anxiété', wonder: 'Émerveillement', sadness: 'Tristesse', anger: 'Colère', confusion: 'Confusion', peace: 'Paix', excitement: 'Excitation', love: 'Amour', nostalgia: 'Nostalgie' };
  const dateStr = new Date(d.dream_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const preview = d.content.length > 150 ? d.content.substring(0, 150) + '...' : d.content;
  // Toutes les émotions classées par intensité décroissante
  const sortedEmotions = d.emotions?.length ? [...d.emotions].sort((a, b) => b.intensity - a.intensity) : [];
  return `
    <div class="glass rounded-xl p-3 sm:p-4 hover:border-dream-400/30 transition-all animate-fadeIn">
      <div class="flex items-start gap-2.5">
        <div class="text-xl mt-0.5 shrink-0">${typeIcons[d.dream_type] || '🌀'}</div>
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-dream-100 text-sm truncate max-w-[55vw] sm:max-w-none mb-1">${escapeHtml(d.title)}</h3>
          <div class="flex items-center gap-1.5 mb-1 flex-wrap">
            <span class="badge-${d.dream_type} text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium">${typeLabels[d.dream_type] || 'Normal'}</span>
            ${d.lucidity_level > 0 ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-600/30 text-emerald-300">Lucidité ${d.lucidity_level}/5</span>` : ''}
            ${d.clarity ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-600/25 text-blue-300">Clarté ${d.clarity}/5</span>` : ''}
          </div>
          ${sortedEmotions.length ? `<div class="flex items-center gap-1.5 mb-1.5 flex-wrap">${sortedEmotions.map((e, i) => `<span class="text-[9px] px-1.5 py-0.5 rounded-full ${i === 0 ? 'bg-dream-600/30 text-dream-200 font-medium' : 'bg-dream-800/20 text-dream-300/70'}">${emotionEmojis[e.emotion] || ''} ${emotionLabels[e.emotion] || e.emotion} ${e.intensity}/5</span>`).join('')}</div>` : ''}
          <p class="text-xs text-gray-400 mb-2 line-clamp-2">${escapeHtml(preview)}</p>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[10px] text-gray-500"><i class="far fa-calendar mr-1"></i>${dateStr}</span>
            ${d.tags?.length ? `<div class="flex gap-1 flex-wrap">${d.tags.slice(0, 3).map(t => `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-dream-800/40 text-dream-300">${escapeHtml(t.name)}</span>`).join('')}${d.tags.length > 3 ? `<span class="text-[9px] text-gray-500">+${d.tags.length - 3}</span>` : ''}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1 mt-2 pt-2 border-t border-dream-700/10">
        <button onclick="openDreamDetail(${d.id})" class="flex-1 py-1.5 text-[10px] text-dream-300 hover:text-dream-200 hover:bg-dream-600/10 rounded-lg transition-all font-medium"><i class="fas fa-eye mr-1"></i>Voir</button>
        <button onclick="openDreamEditor(${d.id})" class="flex-1 py-1.5 text-[10px] text-gray-400 hover:text-dream-300 hover:bg-dream-600/10 rounded-lg transition-all"><i class="fas fa-edit mr-1"></i>Modifier</button>
        <button onclick="deleteDream(${d.id})" class="flex-1 py-1.5 text-[10px] text-gray-400 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-all"><i class="fas fa-trash mr-1"></i>Supprimer</button>
      </div>
    </div>`;
}

// Filter functions — all apply in real-time, panel stays open
window.filterType = function(val) { state.filters.type = val; state.pagination.page = 1; _filterPanelOpen = true; renderJournal(); };
window.goToPage = function(p) { state.pagination.page = p; renderJournal(); };

// Tag-based filtering (real-time)
window.toggleTagFilter = function(tagId) {
  const idx = state.filters.tagIds.indexOf(tagId);
  if (idx >= 0) { state.filters.tagIds.splice(idx, 1); } else { state.filters.tagIds.push(tagId); }
  state.pagination.page = 1;
  _filterPanelOpen = true;
  renderJournal();
};

// Emotion-based filtering (real-time)
window.toggleEmotionFilter = function(em) {
  if (!em) {
    state.filters.emotions = [];
    state.filters.minIntensity = 1;
    state.filters.maxIntensity = 5;
  } else {
    const idx = state.filters.emotions.indexOf(em);
    if (idx >= 0) { state.filters.emotions.splice(idx, 1); }
    else { state.filters.emotions.push(em); }
    if (state.filters.emotions.length === 0) { state.filters.minIntensity = 1; state.filters.maxIntensity = 5; }
  }
  state.pagination.page = 1;
  _filterPanelOpen = true;
  renderJournal();
};

window.setEmotionFilterIntensity = function(which, val) {
  if (which === 'min') {
    state.filters.minIntensity = val;
    if (state.filters.maxIntensity < val) state.filters.maxIntensity = val;
  } else {
    state.filters.maxIntensity = val;
    if (state.filters.minIntensity > val) state.filters.minIntensity = val;
  }
  state.pagination.page = 1;
  _filterPanelOpen = true;
  renderJournal();
};

// Render only the dream list (for real-time filter updates without closing the panel)
async function renderJournalList() {
  const params = new URLSearchParams({ page: state.pagination.page, limit: state.pagination.limit });
  if (state.filters.type !== 'all') params.set('type', state.filters.type);
  if (state.filters.tagIds.length > 0) params.set('tags', state.filters.tagIds.join(','));
  if (state.filters.emotions.length > 0) {
    params.set('emotion', state.filters.emotions.join(','));
    params.set('minIntensity', state.filters.minIntensity);
    params.set('maxIntensity', state.filters.maxIntensity);
  }
  try {
    const data = await api(`/dreams?${params}`);
    state.dreams = data.dreams; state.pagination = data.pagination;
  } catch { return; }
  const list = document.getElementById('dreams-list');
  if (list) {
    const activeFilterCount = state.filters.tagIds.length + (state.filters.type !== 'all' ? 1 : 0) + state.filters.emotions.length;
    list.innerHTML = state.dreams.length === 0 ? `
      <div class="text-center py-12">
        <div class="text-5xl mb-4 animate-float">${activeFilterCount > 0 ? '🔍' : '🌙'}</div>
        <h3 class="text-lg font-display font-semibold text-dream-200 mb-2">${activeFilterCount > 0 ? 'Aucun rêve trouvé' : 'Votre journal est vide'}</h3>
        <p class="text-gray-400 mb-6 max-w-md mx-auto text-sm">${activeFilterCount > 0 ? 'Essayez de modifier vos filtres.' : 'Commencez à noter vos rêves dès le réveil.'}</p>
      </div>
    ` : state.dreams.map(d => renderDreamCard(d)).join('');
  }
}

let _filterPanelOpen = false;
window.toggleFilterPanel = function() {
  const panel = document.getElementById('filter-panel');
  if (panel) { panel.classList.toggle('hidden'); _filterPanelOpen = !panel.classList.contains('hidden'); }
};

window.clearAllFilters = function() {
  state.filters.type = 'all';
  state.filters.tagIds = [];
  state.filters.emotions = [];
  state.filters.minIntensity = 1;
  state.filters.maxIntensity = 5;
  state.pagination.page = 1;
  renderJournal();
};

// ========== DREAM DETAIL (sub-page, not modal) ==========
window.openDreamDetail = function(id) {
  state.dreamDetailId = id;
  state.previousView = state.currentView;
  navigate('dream-detail');
};

async function renderDreamDetailPage(id) {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="flex justify-center py-12"><div class="animate-spin text-dream-400 text-2xl"><i class="fas fa-circle-notch"></i></div></div>';
  try {
    const [dream, intentionsData, realizedByData] = await Promise.all([
      api(`/dreams/${id}`),
      api(`/intentions/for-dream/${id}`).catch(() => ({ intentions: [] })),
      api(`/intentions/realized-by/${id}`).catch(() => ({ intention: null }))
    ]);
    main.innerHTML = `<div class="animate-slideUp">${renderDreamDetailContent(dream, intentionsData.intentions || [], realizedByData.intention)}</div>`;
  } catch (err) {
    main.innerHTML = `<div class="text-center py-12 text-red-400">${err.message}</div>`;
  }
}

window.confirmDeleteDream = async function(id) {
  const actions = document.getElementById('dream-detail-actions');
  if (!actions) return;
  actions.innerHTML = `
    <div class="w-full">
      <p class="text-xs text-red-300 mb-2.5 text-center"><i class="fas fa-exclamation-triangle mr-1"></i>Supprimer ce rêve ? Cette action est irréversible.</p>
      <div class="flex gap-2">
        <button onclick="cancelDeleteDream(${id})" class="flex-1 py-2 bg-night-800/60 text-gray-300 rounded-lg hover:bg-night-800/80 transition-all text-xs font-medium">Annuler</button>
        <button onclick="executeDeleteDream(${id})" class="flex-1 py-2 bg-red-600/40 text-red-300 rounded-lg hover:bg-red-600/60 transition-all text-xs font-medium"><i class="fas fa-trash mr-1"></i>Confirmer</button>
      </div>
    </div>`;
};

window.cancelDeleteDream = function(id) {
  const actions = document.getElementById('dream-detail-actions');
  if (!actions) return;
  actions.innerHTML = `
    <button onclick="openDreamEditor(${id})" class="flex-1 py-2 bg-dream-600/30 text-dream-300 rounded-lg hover:bg-dream-600/50 transition-all text-xs font-medium"><i class="fas fa-edit mr-1"></i>Modifier</button>
    <button onclick="confirmDeleteDream(${id})" class="py-2 px-4 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-all text-xs font-medium"><i class="fas fa-trash mr-1"></i>Supprimer</button>`;
};

window.executeDeleteDream = async function(id) {
  try {
    await api(`/dreams/${id}`, { method: 'DELETE' });
    showToast('🗑️ Rêve supprimé');
    goBackFromDreamDetail();
  } catch (err) { alert(err.message); }
};

window.goBackFromDreamDetail = function() {
  const prev = state.previousView || 'journal';
  state.dreamDetailId = null;
  navigate(prev);
};

function renderDreamDetailContent(d, intentions, realizedIntention) {
  intentions = intentions || [];
  realizedIntention = realizedIntention || null;
  const typeLabels = Object.fromEntries(DREAM_TYPES.map(t => [t.value, t.label]));
  const emotionEmojis = { joy: '😊', fear: '😨', anxiety: '😰', wonder: '🤩', sadness: '😢', anger: '😡', confusion: '😵', peace: '😌', excitement: '🤯', love: '💗', nostalgia: '🥺' };
  const emotionLabels = { joy: 'Joie', fear: 'Peur', anxiety: 'Anxiété', wonder: 'Émerveillement', sadness: 'Tristesse', anger: 'Colère', confusion: 'Confusion', peace: 'Paix', excitement: 'Excitation', love: 'Amour', nostalgia: 'Nostalgie' };
  const dateStr = new Date(d.dream_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const phasesHTML = d.phases?.length ? `
      <div class="mb-5">
        <h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2"><i class="fas fa-route mr-1"></i>Étapes du rêve</h4>
        <div class="space-y-2">
          ${d.phases.map((p, i) => `
            <div class="p-3 rounded-lg bg-night-900/40 border-l-2 border-dream-500/40">
              <div class="flex items-center gap-2 mb-1">
                <span class="w-5 h-5 rounded-full bg-dream-600/30 text-dream-300 text-[10px] flex items-center justify-center font-bold shrink-0">${i + 1}</span>
                <span class="text-xs font-semibold text-dream-200">${escapeHtml(p.title || 'Étape ' + (i + 1))}</span>
              </div>
              <p class="text-xs text-gray-300 leading-relaxed ml-7 whitespace-pre-wrap">${escapeHtml(p.content)}</p>
              ${p.emotions?.length ? `<div class="flex flex-wrap gap-1 ml-7 mt-1.5">${p.emotions.map(e => `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-dream-800/30">${emotionEmojis[e.emotion] || ''} ${e.emotion}</span>`).join('')}</div>` : ''}
              ${p.interpretations?.length ? `<div class="ml-7 mt-1.5">${p.interpretations.map(interp => `<p class="text-[10px] text-amber-300/80 italic"><i class="fas fa-lightbulb mr-1 text-amber-400/60"></i>${escapeHtml(interp.content)}</p>`).join('')}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>` : '';

  const interpretationsHTML = d.interpretations?.length ? `
      <div class="mb-4">
        <h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2"><i class="fas fa-lightbulb mr-1"></i>Interprétations</h4>
        <div class="space-y-1.5">
          ${d.interpretations.map(interp => `<div class="p-2.5 rounded-lg bg-amber-900/10 border border-amber-500/10"><p class="text-xs text-amber-200/90 italic">${escapeHtml(interp.content)}</p></div>`).join('')}
        </div>
      </div>` : '';

  const connectionsHTML = d.connections?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Connexions</h4><div class="space-y-1">${d.connections.map(cn => `<div class="flex items-center gap-2 p-2 rounded-lg bg-night-900/40 cursor-pointer hover:bg-night-900/60" onclick="openDreamDetail(${cn.connected_dream_id})"><i class="fas fa-link text-dream-400 text-xs"></i><span class="text-xs text-dream-200">${escapeHtml(cn.connected_dream_title)}</span><span class="text-[9px] text-gray-500 capitalize">${cn.connection_type}</span></div>`).join('')}</div></div>` : '';

  const seriesHTML = d.series?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Séries</h4><div class="flex flex-wrap gap-1.5">${d.series.map(s => `<span class="px-2 py-1 rounded-full text-[10px] font-medium" style="background:${s.color}20; color:${s.color}">${escapeHtml(s.name)}</span>`).join('')}</div></div>` : '';

  return `
    <div class="dream-detail-inner">
      <!-- Back button + badges -->
      <div class="flex items-center gap-2 mb-4">
        <button onclick="goBackFromDreamDetail()" class="p-2 text-gray-400 hover:text-dream-300 transition-all rounded-lg hover:bg-night-900/40" title="Retour"><i class="fas fa-arrow-left"></i></button>
        <div class="flex items-center gap-2 flex-wrap flex-1">
          <span class="badge-${d.dream_type} text-[10px] px-2 py-1 rounded-full text-white font-medium">${typeLabels[d.dream_type] || 'Normal'}</span>
          ${d.lucidity_level > 0 ? `<span class="text-[10px] px-2 py-1 rounded-full bg-emerald-600/30 text-emerald-300">Lucidité ${d.lucidity_level}/5</span>` : ''}
          ${d.clarity ? `<span class="text-[10px] px-2 py-1 rounded-full bg-blue-600/25 text-blue-300">Clarté ${d.clarity}/5</span>` : ''}
        </div>
      </div>

      <h2 class="text-xl font-display font-bold text-dream-100 mb-2">${escapeHtml(d.title)}</h2>
      <p class="text-xs text-gray-400 mb-4"><i class="far fa-calendar mr-1"></i>${dateStr}</p>
      <div class="glass rounded-xl p-4 mb-5"><p class="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">${escapeHtml(d.content)}</p></div>

      ${phasesHTML}
      ${interpretationsHTML}

      ${realizedIntention ? `
      <div class="mb-4">
        <h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2"><i class="fas fa-lightbulb mr-1 text-emerald-400/60"></i>Intention réalisée</h4>
        <div class="p-3 rounded-lg bg-emerald-900/15 border border-emerald-500/15 cursor-pointer hover:bg-emerald-900/25 transition-all" onclick="navigate('intentions')">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="text-xs">${realizedIntention.type === 'dream_continuation' ? '\ud83c\udf19' : '\u2728'}</span>
            <span class="text-xs font-medium text-emerald-200">${escapeHtml(realizedIntention.title)}</span>
            <span class="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-600/30 text-emerald-300 ml-auto shrink-0">Réalisée</span>
          </div>
          ${realizedIntention.description ? `<p class="text-[10px] text-gray-400 line-clamp-2">${escapeHtml(realizedIntention.description)}</p>` : ''}
        </div>
      </div>` : ''}

      ${d.wished_continuation ? `
      <div class="mb-4">
        <h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2"><i class="fas fa-moon mr-1 text-indigo-400/60"></i>Suite souhaitée</h4>
        <div class="p-3 rounded-lg bg-indigo-900/15 border border-indigo-500/15">
          <p class="text-xs text-indigo-200/90 leading-relaxed whitespace-pre-wrap">${escapeHtml(d.wished_continuation)}</p>
        </div>
      </div>` : ''}

      ${intentions.length ? `
      <div class="mb-4">
        <h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2"><i class="fas fa-lightbulb mr-1 text-indigo-400/60"></i>Intentions de suite</h4>
        <div class="space-y-1.5">
          ${intentions.map(i => `
            <div class="p-2.5 rounded-lg ${i.status === 'realized' ? 'bg-emerald-900/15 border border-emerald-500/15' : 'bg-indigo-900/10 border border-indigo-500/10'}">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="text-xs font-medium ${i.status === 'realized' ? 'text-emerald-200' : 'text-indigo-200'}">${escapeHtml(i.title)}</span>
                ${i.status === 'realized' ? '<span class="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-600/30 text-emerald-300">Réalisée</span>' : '<span class="text-[8px] px-1.5 py-0.5 rounded-full bg-indigo-600/25 text-indigo-300">Active</span>'}
              </div>
              ${i.description ? `<p class="text-[10px] text-gray-400 line-clamp-2">${escapeHtml(i.description)}</p>` : ''}
              ${i.realized_dream_title ? `<p class="text-[9px] text-emerald-400/70 mt-1"><i class="fas fa-check mr-0.5"></i>Réalisée dans : ${escapeHtml(i.realized_dream_title)}</p>` : ''}
            </div>
          `).join('')}
        </div>
        <button onclick="createContinuationIntention(${d.id}, '${escapeHtml(d.title).replace(/'/g, "\\'")}')" class="mt-2 w-full py-1.5 text-[10px] text-indigo-300 bg-indigo-600/10 border border-indigo-500/15 rounded-lg hover:bg-indigo-600/20 transition-all"><i class="fas fa-plus mr-1"></i>Ajouter une intention de suite</button>
      </div>` : `
      <div class="mb-4">
        <button onclick="createContinuationIntention(${d.id}, '${escapeHtml(d.title).replace(/'/g, "\\'")}')" class="w-full py-2 text-xs text-indigo-300/70 bg-indigo-600/10 border border-indigo-500/15 rounded-lg hover:bg-indigo-600/20 transition-all"><i class="fas fa-lightbulb mr-1"></i>Créer une intention de suite pour ce rêve</button>
      </div>`}

      ${d.emotions?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Émotions globales</h4><div class="flex flex-wrap gap-1.5">${[...d.emotions].sort((a, b) => b.intensity - a.intensity).map((e, i) => `<span class="flex items-center gap-1 px-2 py-1 rounded-full text-xs ${i === 0 ? 'bg-dream-600/30 ring-1 ring-dream-400/30' : 'bg-dream-800/30'}">${emotionEmojis[e.emotion] || ''} <span class="text-dream-200 capitalize">${emotionLabels[e.emotion] || e.emotion}</span> <span class="text-[9px] ${i === 0 ? 'text-dream-300 font-medium' : 'text-gray-500'}">${e.intensity}/5</span>${i === 0 ? '<span class="text-[8px] text-dream-400/60 ml-0.5">principale</span>' : ''}</span>`).join('')}</div></div>` : ''}
      ${d.tags?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Tags</h4><div class="flex flex-wrap gap-1.5">${d.tags.map(t => `<span class="px-2 py-1 rounded-full text-[10px] font-medium" style="background:${t.color}20; color:${t.color}; border: 1px solid ${t.color}40">${escapeHtml(t.name)}</span>`).join('')}</div></div>` : ''}
      ${connectionsHTML}
      ${seriesHTML}
      <div id="dream-detail-actions" class="flex gap-2 pt-3 border-t border-dream-700/20">
        <button onclick="goBackFromDreamDetail()" class="py-2 px-4 bg-night-800/40 text-gray-300 rounded-lg hover:bg-night-800/60 transition-all text-xs font-medium"><i class="fas fa-arrow-left mr-1"></i>Retour</button>
        <button onclick="openDreamEditor(${d.id})" class="flex-1 py-2 bg-dream-600/30 text-dream-300 rounded-lg hover:bg-dream-600/50 transition-all text-xs font-medium"><i class="fas fa-edit mr-1"></i>Modifier</button>
        <button onclick="confirmDeleteDream(${d.id})" class="py-2 px-4 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-all text-xs font-medium"><i class="fas fa-trash mr-1"></i>Supprimer</button>
      </div>
    </div>`;
}

// ========== DREAM EDITOR ==========
const DREAM_TYPES = [
  { value: 'normal', icon: '🌀', label: 'Normal', desc: 'Rêve standard survenant pendant le sommeil REM. Contenu principalement visuel, souvent influencé par les expériences de la journée (65% du contenu selon Schredl et al., 2003). La plupart des rêves normaux sont oubliés dans les 5 minutes suivant le réveil.' },
  { value: 'lucid', icon: '✨', label: 'Lucide', desc: 'Rêve dans lequel le dormeur prend conscience qu\'il rêve, parfois avec la capacité de contrôler le contenu. Vérifié scientifiquement par Stephen LaBerge (Stanford, 1981). 55% des gens en font au moins un dans leur vie, 23% mensuellement (Saunders et al., 2016).' },
  { value: 'nightmare', icon: '👹', label: 'Cauchemar', desc: 'Rêve intensément perturbant impliquant des menaces à la survie ou au bien-être émotionnel, assez vif pour réveiller le dormeur. Survient en REM, 2e moitié de nuit. 85% des adultes en font au moins un par an (AASM). Fréquence accrue chez les personnes stressées ou souffrant de TSPT (71%, Pigeon et al., 2013).' },
  { value: 'recurring', icon: '🔄', label: 'Récurrent', desc: 'Rêves qui se répètent avec un contenu, des thèmes ou des schémas émotionnels similaires. 60 à 75% des adultes en font l\'expérience (Zadra, 1996). Tonalité émotionnelle massivement négative. Souvent liés au stress psychologique, ils peuvent diminuer une fois la source de stress résolue.' },
  { value: 'vivid', icon: '🎨', label: 'Vivide', desc: 'Rêves d\'une clarté sensorielle et émotionnelle exceptionnelle, proches de la perception éveillée. Liés au rebond REM (après privation de sommeil), au stress, à certains médicaments ou à la grossesse. Le cerveau compense le déficit REM en entrant plus vite et plus longtemps en REM les nuits suivantes (Walker, 2017).' },
  { value: 'hypnagogic', icon: '🌊', label: 'Hypnago.', desc: 'Hallucinations vives (visuelles, auditives, tactiles) survenant lors de la transition éveil-sommeil (stade 1 NREM). 25 à 37% de la population en fait régulièrement. L\'EEG montre un mélange d\'ondes alpha et thêta. Plus fréquentes avec la privation de sommeil et le stress (Ohayon et al., 1996).' },
  { value: 'false_awakening', icon: '🪞', label: 'Faux éveil', desc: 'Rêve dans lequel on croit s\'être réveillé et avoir commencé sa routine matinale, alors qu\'on dort encore. Survient en REM. Type 1 : banal (routine normale). Type 2 : atmosphère étrange ou menaçante. Co-occurre souvent avec les rêves lucides et la paralysie du sommeil (Green & McCreery, 1994).' },
  { value: 'sleep_paralysis', icon: '😶‍🌫️', label: 'Paralysie', desc: 'État de conscience avec incapacité de bouger ou parler, survenant à l\'endormissement ou au réveil. Souvent accompagné d\'hallucinations (présence menaçante, pression thoracique). 20 à 40% des gens en font l\'expérience au moins une fois (Sharpless & Barber, 2011). Lié à la persistance de l\'atonie musculaire du REM dans l\'éveil.' },
  { value: 'night_terror', icon: '🫣', label: 'Terreur noct.', desc: 'Épisodes de peur intense, cris et agitation survenant pendant le sommeil profond NREM (1er tiers de la nuit). Le dormeur ne se réveille pas complètement et n\'a aucun souvenir le lendemain. 1 à 6.5% des enfants, plus rare chez l\'adulte. Différentes des cauchemars : pas de souvenir, pas en REM (AASM / Mayo Clinic).' },
  { value: 'prophetic', icon: '🔮', label: 'Prémonitoire', desc: 'Rêves qui semblent prédire des événements futurs. Aucune preuve scientifique de capacité paranormale, mais plusieurs explications validées : reconnaissance de patterns inconscients, biais de confirmation (on retient les coïncidences), et probabilité statistique (4 à 6 rêves par nuit sur une vie). Utiles pour la réflexion personnelle.' }
];

const EMOTION_LIST = ['joy', 'fear', 'anxiety', 'wonder', 'sadness', 'anger', 'confusion', 'peace', 'excitement', 'love', 'nostalgia'];
const EMOTION_EMOJIS = { joy: '😊', fear: '😨', anxiety: '😰', wonder: '🤩', sadness: '😢', anger: '😡', confusion: '😵', peace: '😌', excitement: '🤯', love: '💗', nostalgia: '🥺' };
const EMOTION_LABELS = { joy: 'Joie', fear: 'Peur', anxiety: 'Anxiété', wonder: 'Émerveil.', sadness: 'Tristesse', anger: 'Colère', confusion: 'Confusion', peace: 'Paix', excitement: 'Excitation', love: 'Amour', nostalgia: 'Nostalgie' };
const TAG_CATEGORIES = [
  { value: 'custom', icon: '🏷️', label: 'Tag' },
  { value: 'person', icon: '👤', label: 'Personne' },
  { value: 'place', icon: '📍', label: 'Lieu' },
  { value: 'theme', icon: '🎭', label: 'Thème' },
  { value: 'symbol', icon: '🔮', label: 'Symbole' }
];
const TAG_COLORS = { custom: '#6366f1', person: '#f59e0b', place: '#10b981', theme: '#ec4899', symbol: '#06b6d4' };

window.openDreamEditor = async function(id) {
  let dream = null;
  let allTags = [], allSeries = [], activeIntentions = [], currentRealizedIntention = null;
  try { allTags = (await api('/tags')).tags; } catch {}
  try { allSeries = (await api('/series')).series; } catch {}
  try { activeIntentions = (await api('/intentions/active')).intentions; } catch {}
  if (id) { try { dream = await api(`/dreams/${id}`); } catch {} }
  // Charger l'intention déjà réalisée par ce rêve (si modification)
  if (id) {
    try {
      const data = await api(`/intentions/realized-by/${id}`);
      if (data.intention) {
        currentRealizedIntention = data.intention;
        // Si l'intention n'est pas déjà dans la liste des actives (elle est realized), l'ajouter
        if (!activeIntentions.find(i => i.id === currentRealizedIntention.id)) {
          activeIntentions.unshift(currentRealizedIntention);
        }
      }
    } catch {}
  }

  const selectedEmotions = dream?.emotions?.reduce((acc, e) => { acc[e.emotion] = e.intensity; return acc; }, {}) || {};
  const selectedTags = dream?.tags || [];
  const dreamSeriesIds = dream?.series?.map(s => s.id) || [];
  const currentType = dream?.dream_type || 'normal';
  const existingPhases = dream?.phases || [];
  const existingInterpretations = dream?.interpretations || [];

  window._editorState = {
    emotions: selectedEmotions,
    tags: [...selectedTags],
    dream,
    seriesIds: [...dreamSeriesIds],
    dreamType: currentType,
    phases: existingPhases.map(p => ({
      title: p.title || '',
      content: p.content,
      emotions: p.emotions?.reduce((acc, e) => { acc[e.emotion] = e.intensity; return acc; }, {}) || {},
      interpretations: p.interpretations?.map(i => i.content) || []
    })),
    interpretations: existingInterpretations.map(i => i.content),
    realizedIntentionId: currentRealizedIntention ? currentRealizedIntention.id : null, // intention que ce rêve réalise
    _previousRealizedIntentionId: currentRealizedIntention ? currentRealizedIntention.id : null // pour détecter les changements
  };
  window._allTags = allTags;
  window._activeIntentions = activeIntentions;

  showModal(`
      <div class="shrink-0 flex items-center justify-between p-4 sm:px-6 sm:pt-6 pb-2 border-b border-dream-700/20">
        <h2 class="text-lg font-display font-bold text-dream-100">${dream ? 'Modifier le rêve' : '🌙 Nouveau rêve'}</h2>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white p-1"><i class="fas fa-times"></i></button>
      </div>
      <div class="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-3" style="min-height:0;">
      <form onsubmit="saveDream(event, ${id || 'null'})" id="dream-form">
        <input type="text" name="title" value="${dream ? escapeHtml(dream.title) : ''}" placeholder="Titre du rêve..." required
          class="w-full mb-3 px-3 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-lg text-white font-medium placeholder-gray-500 focus:border-dream-400 focus:outline-none text-sm">
        <div class="mb-3">
          <textarea name="content" rows="3" placeholder="Récit global du rêve..." required
            class="w-full px-3 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-sm placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none">${dream ? escapeHtml(dream.content) : ''}</textarea>
        </div>

        <!-- Nuit du rêve (soir + matin) -->
        <div class="mb-3">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Nuit du rêve</label>
          <div class="flex gap-2 items-center">
            <div class="flex-1">
              <span class="text-[9px] text-gray-500 block mb-0.5">Soir du</span>
              <input type="date" id="dream-night-evening" value="${(() => { const d = dream?.dream_date ? new Date(dream.dream_date + 'T00:00:00') : new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })()}"
                onchange="document.getElementById('dream-night-morning').value = (() => { const d = new Date(this.value + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })()"
                class="w-full px-2.5 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white focus:border-dream-400 focus:outline-none text-xs">
            </div>
            <span class="text-gray-500 text-xs mt-3">→</span>
            <div class="flex-1">
              <span class="text-[9px] text-gray-500 block mb-0.5">Matin du</span>
              <input type="date" id="dream-night-morning" name="dreamDate" value="${dream?.dream_date || new Date().toISOString().split('T')[0]}"
                onchange="document.getElementById('dream-night-evening').value = (() => { const d = new Date(this.value + 'T00:00:00'); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })()"
                class="w-full px-2.5 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white focus:border-dream-400 focus:outline-none text-xs">
            </div>
          </div>
        </div>

        <!-- Type de rêve — BOUTONS -->
        <div class="mb-3">
          <div class="flex items-center gap-1.5 mb-1.5">
            <label class="text-[10px] text-gray-400">Type de rêve</label>
            <button type="button" onclick="toggleDreamTypeInfo()" class="text-gray-500 hover:text-dream-300 transition-all" title="Informations sur les types de rêves"><i class="fas fa-info-circle text-[10px]"></i></button>
          </div>
          <div id="dream-type-info" class="hidden mb-2 p-2.5 rounded-lg bg-night-900/60 border border-dream-700/20 max-h-40 overflow-y-auto">
            <p class="text-[9px] text-gray-400 mb-2 font-semibold uppercase">Guide des types de rêves (sources scientifiques)</p>
            ${DREAM_TYPES.map(t => `
              <div class="mb-1.5 last:mb-0">
                <p class="text-[10px] font-medium text-dream-200">${t.icon} ${t.label}</p>
                <p class="text-[9px] text-gray-400 leading-relaxed">${t.desc}</p>
              </div>
            `).join('')}
          </div>
          <div class="grid grid-cols-3 sm:grid-cols-5 gap-1.5" id="dream-type-picker">
            ${DREAM_TYPES.map(t => `
              <button type="button" onclick="selectDreamType('${t.value}')" data-type="${t.value}"
                class="dream-type-btn flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${currentType === t.value ? 'border-dream-400 bg-dream-600/30 text-dream-200' : 'border-dream-700/20 bg-night-900/40 text-gray-400 hover:text-gray-200 hover:border-dream-700/40'}">
                <span>${t.icon}</span><span class="truncate">${t.label}</span>
              </button>
            `).join('')}
          </div>
          <input type="hidden" name="dreamType" value="${currentType}">
        </div>

        <!-- Lucidité + Clarté -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="text-[10px] text-gray-400 mb-1 block">Lucidité</label>
            <input type="range" name="lucidityLevel" min="0" max="5" value="${dream?.lucidity_level || 0}" oninput="this.nextElementSibling.textContent = this.value + '/5'" class="w-full accent-dream-400">
            <span class="text-xs text-dream-300">${dream?.lucidity_level || 0}/5</span>
          </div>
          <div>
            <label class="text-[10px] text-gray-400 mb-1 block">Clarté du souvenir</label>
            <input type="range" name="clarity" min="1" max="5" value="${dream?.clarity || 3}" oninput="this.nextElementSibling.textContent = this.value + '/5'" class="w-full accent-dream-400">
            <span class="text-xs text-dream-300">${dream?.clarity || 3}/5</span>
          </div>
        </div>

        <!-- ========== PHASES / ÉTAPES DU RÊVE ========== -->
        <div class="mb-3 border border-dream-700/15 rounded-lg p-3 bg-night-900/20">
          <div class="flex items-center justify-between mb-2">
            <label class="text-[10px] text-gray-400 font-semibold uppercase"><i class="fas fa-route mr-1"></i>Étapes du rêve</label>
            <button type="button" onclick="addPhase()" class="text-[10px] px-2 py-1 bg-dream-600/30 text-dream-300 rounded-lg hover:bg-dream-600/50 transition-all"><i class="fas fa-plus mr-1"></i>Ajouter</button>
          </div>
          <p class="text-[9px] text-gray-500 mb-2">Découpez votre rêve en scènes avec émotions et interprétations pour chacune.</p>
          <div id="phases-container" class="space-y-2">
            ${window._editorState.phases.length ? window._editorState.phases.map((p, i) => renderPhaseEditor(i, p)).join('') : '<p id="no-phases-msg" class="text-[10px] text-gray-600 italic text-center py-2">Aucune étape ajoutée</p>'}
          </div>
        </div>

        <!-- ========== INTERPRÉTATIONS GLOBALES ========== -->
        <div class="mb-3 border border-amber-700/15 rounded-lg p-3 bg-amber-900/5">
          <div class="flex items-center justify-between mb-2">
            <label class="text-[10px] text-gray-400 font-semibold uppercase"><i class="fas fa-lightbulb mr-1 text-amber-400/60"></i>Interprétations du rêve</label>
            <button type="button" onclick="addGlobalInterpretation()" class="text-[10px] px-2 py-1 bg-amber-600/20 text-amber-300 rounded-lg hover:bg-amber-600/30 transition-all"><i class="fas fa-plus mr-1"></i>Ajouter</button>
          </div>
          <div id="interpretations-container" class="space-y-1.5">
            ${window._editorState.interpretations.length ? window._editorState.interpretations.map((interp, i) => `
              <div class="flex gap-1.5 items-start" id="global-interp-${i}">
                <textarea rows="2" placeholder="Votre interprétation..."
                  class="interp-global-input flex-1 px-3 py-1.5 bg-night-900/60 border border-amber-700/20 rounded-lg text-white text-xs placeholder-gray-500 focus:border-amber-400 focus:outline-none resize-none"
                  oninput="updateGlobalInterpretation(${i}, this.value)">${escapeHtml(interp)}</textarea>
                <button type="button" onclick="removeGlobalInterpretation(${i})" class="text-gray-500 hover:text-red-400 p-1 shrink-0"><i class="fas fa-times text-xs"></i></button>
              </div>
            `).join('') : ''}
          </div>
        </div>

        <!-- Séries -->
        ${allSeries.length > 0 ? `
        <div class="mb-3">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Ajouter à une série</label>
          <div class="flex flex-wrap gap-1.5">
            ${allSeries.map(s => `
              <button type="button" onclick="toggleSeriesInEditor(${s.id})" id="series-btn-${s.id}"
                class="series-toggle-btn flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${dreamSeriesIds.includes(s.id) ? '' : 'border-dream-700/20 bg-night-900/30 text-gray-400 hover:text-white hover:border-dream-700/40'}"
                style="${dreamSeriesIds.includes(s.id) ? `border-color:${s.color}; background:${s.color}20; color:${s.color}` : ''}">
                <span class="w-2 h-2 rounded-full shrink-0" style="background:${s.color}"></span>
                ${escapeHtml(s.name)}
                <i class="fas fa-${dreamSeriesIds.includes(s.id) ? 'check' : 'plus'} text-[8px] opacity-70"></i>
              </button>
            `).join('')}
          </div>
        </div>` : ''}

        <!-- Emotions globales -->
        <div class="mb-3">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Émotions globales du rêve</label>
          <div class="flex flex-wrap gap-1.5" id="emotions-picker">
            ${EMOTION_LIST.map(em => {
              const sel = selectedEmotions[em];
              return `<button type="button" onclick="toggleEmotion('${em}')" id="em-${em}"
                class="emotion-btn inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border transition-all ${sel ? 'border-dream-400 bg-dream-600/30 text-dream-200 font-medium' : 'border-dream-700/30 bg-night-900/40 text-gray-400'}">
                <span>${EMOTION_EMOJIS[em]}</span><span>${EMOTION_LABELS[em]}</span>
              </button>`;
            }).join('')}
          </div>
          <div id="emotion-intensity-panel" class="hidden mt-2 p-2.5 rounded-lg bg-night-900/50 border border-dream-700/20"></div>
        </div>

        <!-- Tags -->
        <div class="mb-4">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Tags</label>
          <div id="selected-tags" class="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
            ${selectedTags.length ? selectedTags.map(t => renderTagChip(t)).join('') : '<span class="text-[10px] text-gray-600 italic">Aucun tag</span>'}
          </div>
          ${allTags.length ? `
          <div class="mb-2">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[9px] text-gray-500">Tags existants :</span>
              <button type="button" onclick="toggleTagManageMode()" id="tag-manage-btn" class="text-[9px] text-gray-500 hover:text-dream-300 transition-all" title="Gérer les tags"><i class="fas fa-pen text-[8px] mr-0.5"></i>Gérer</button>
            </div>
            <div id="existing-tags-container" class="flex flex-wrap gap-1 p-2 bg-night-900/30 rounded-lg border border-dream-700/10 max-h-28 overflow-y-auto">
              ${allTags.map(t => `
                <span class="existing-tag-item inline-flex items-center gap-0.5" id="tag-item-${t.id}">
                  <button type="button" onclick="pickExistingTag(${t.id})"
                    id="pick-tag-${t.id}"
                    class="existing-tag-btn px-2 py-0.5 rounded-full text-[10px] transition-all cursor-pointer ${selectedTags.find(st => st.name === t.name) ? 'opacity-40 pointer-events-none' : 'hover:scale-105'}"
                    style="background:${t.color}15; color:${t.color}; border: 1px solid ${t.color}30"
                    ${selectedTags.find(st => st.name === t.name) ? 'disabled' : ''}>
                    ${TAG_CATEGORIES.find(c => c.value === t.category)?.icon || '🏷️'} ${escapeHtml(t.name)}
                  </button>
                  <button type="button" onclick="deleteExistingTag(${t.id}, '${escapeHtml(t.name).replace(/'/g, "\\'")}')"
                    class="tag-delete-btn hidden w-4 h-4 rounded-full bg-red-600/40 text-red-300 text-[8px] flex items-center justify-center hover:bg-red-600/60 transition-all shrink-0"
                    title="Supprimer ce tag définitivement"><i class="fas fa-times"></i></button>
                </span>
              `).join('')}
            </div>
          </div>` : ''}
          <div class="mb-2">
            <span class="text-[9px] text-gray-500 mb-1 block">Catégorie du nouveau tag :</span>
            <div class="flex flex-wrap gap-1" id="tag-category-picker">
              ${TAG_CATEGORIES.map(c => `
                <button type="button" onclick="selectTagCategory('${c.value}')"
                  data-cat="${c.value}"
                  class="tag-cat-btn px-2 py-1 rounded-lg text-[10px] font-medium border transition-all ${c.value === 'custom' ? 'border-opacity-60 text-white' : 'border-dream-700/20 bg-night-900/40 text-gray-400 hover:text-gray-200'}"
                  style="${c.value === 'custom' ? 'border-color:' + TAG_COLORS[c.value] + '; background:' + TAG_COLORS[c.value] + '25; color:' + TAG_COLORS[c.value] : ''}">
                  ${c.icon} ${c.label}
                </button>
              `).join('')}
            </div>
            <input type="hidden" id="tag-category-select" value="custom">
          </div>
          <div class="flex gap-1.5 items-center">
            <input type="text" id="tag-input" placeholder="Nom du tag..."
              class="flex-1 px-3 py-1.5 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-xs placeholder-gray-500 focus:border-dream-400 focus:outline-none min-w-0"
              onkeydown="if(event.key==='Enter'){event.preventDefault(); addNewTag()}">
            <button type="button" onclick="addNewTag()" class="px-3 py-1.5 bg-dream-600/40 text-dream-300 rounded-lg hover:bg-dream-600/60 text-xs shrink-0 font-medium"><i class="fas fa-plus mr-1"></i>Ajouter</button>
          </div>
          <div id="tag-feedback" class="hidden text-[10px] mt-1"></div>
        </div>

        <!-- ========== INTENTION RÉALISÉE ========== -->
        ${activeIntentions.length > 0 ? `
        <div class="mb-4 border border-emerald-700/20 rounded-lg p-3 bg-emerald-900/10">
          <div class="flex items-center gap-2 mb-2">
            <i class="fas fa-lightbulb text-emerald-400/70 text-xs"></i>
            <label class="text-[10px] text-gray-400 font-semibold uppercase">Ce rêve provient d'une intention ?</label>
          </div>
          <p class="text-[9px] text-gray-500 mb-2">Si ce rêve réalise une de tes intentions, sélectionne-la pour la marquer comme réalisée.</p>
          <div id="intention-selector">
            <select onchange="window._editorState.realizedIntentionId = this.value ? parseInt(this.value) : null"
              class="w-full px-3 py-2 bg-night-900/60 border border-emerald-700/25 rounded-lg text-white text-xs focus:border-emerald-400 focus:outline-none">
              <option value="">Aucune intention</option>
              ${activeIntentions.map(i => `<option value="${i.id}" ${currentRealizedIntention && currentRealizedIntention.id === i.id ? 'selected' : ''}>${i.type === 'dream_continuation' ? '🌙' : '✨'} ${escapeHtml(i.title)}${i.source_dream_title ? ' (suite de ' + escapeHtml(i.source_dream_title) + ')' : ''}${i.status === 'realized' ? ' ✅' : ''}</option>`).join('')}
            </select>
          </div>
        </div>` : ''}

        <!-- ========== SUITE SOUHAITÉE (INCUBATION) ========== -->
        <div class="mb-4 border border-indigo-700/20 rounded-lg p-3 bg-indigo-900/10" id="dream-continuation-section">
          <div class="flex items-center gap-2 mb-2">
            <i class="fas fa-moon text-indigo-400/70 text-xs"></i>
            <label class="text-[10px] text-gray-400 font-semibold uppercase">Suite souhaitée pour ce rêve</label>
          </div>
          <p class="text-[9px] text-gray-500 mb-2">Décrivez ce que vous aimeriez qu'il se passe ensuite. Cela créera automatiquement une intention de suite.</p>
          <textarea name="wishedContinuation" rows="3" placeholder="Quelle suite imaginez-vous pour ce rêve ? Décrivez la scène, les actions, les sensations..."
            class="w-full px-3 py-2 bg-night-900/60 border border-indigo-700/25 rounded-lg text-white text-xs placeholder-gray-500 focus:border-indigo-400 focus:outline-none resize-none">${dream?.wished_continuation ? escapeHtml(dream.wished_continuation) : ''}</textarea>
        </div>

      </form>
      </div>
      <div class="shrink-0 px-4 sm:px-6 py-3 border-t border-dream-700/20">
        <div id="save-error" class="text-red-400 text-sm mb-2 hidden"></div>
        <button type="submit" form="dream-form" class="w-full py-2.5 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg font-semibold hover:from-dream-400 hover:to-dream-600 transition-all text-sm">
          <i class="fas fa-save mr-2"></i>${dream ? 'Enregistrer' : 'Enregistrer ce rêve'}
        </button>
      </div>
  `, '650px', true);
};

// ========== Phase Editor Helper ==========
function renderPhaseEditor(idx, phase) {
  phase = phase || { title: '', content: '', emotions: {}, interpretations: [] };
  return `
    <div class="phase-item p-2.5 rounded-lg bg-night-900/30 border border-dream-700/10" id="phase-${idx}">
      <div class="flex items-center gap-2 mb-2">
        <span class="w-5 h-5 rounded-full bg-dream-600/40 text-dream-300 text-[10px] flex items-center justify-center font-bold shrink-0">${idx + 1}</span>
        <input type="text" placeholder="Titre de l'étape (optionnel)" value="${escapeHtml(phase.title || '')}"
          class="flex-1 px-2 py-1 bg-night-900/60 border border-dream-700/20 rounded text-white text-xs placeholder-gray-500 focus:border-dream-400 focus:outline-none"
          oninput="updatePhase(${idx}, 'title', this.value)">
        <button type="button" onclick="removePhase(${idx})" class="text-gray-500 hover:text-red-400 p-1 shrink-0"><i class="fas fa-times text-xs"></i></button>
      </div>
      <textarea rows="4" placeholder="Que se passe-t-il dans cette scène ?"
        class="w-full px-2 py-1.5 bg-night-900/60 border border-dream-700/20 rounded text-white text-xs placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-y mb-2 min-h-[5rem]"
        oninput="updatePhase(${idx}, 'content', this.value); autoGrowTextarea(this)">${escapeHtml(phase.content || '')}</textarea>
      <div class="mb-1.5">
        <span class="text-[9px] text-gray-500">Émotions :</span>
        <div class="flex flex-wrap gap-1 mt-1">
          ${EMOTION_LIST.map(em => `
            <button type="button" onclick="togglePhaseEmotion(${idx}, '${em}')" id="phase-em-${idx}-${em}"
              class="px-1.5 py-0.5 rounded-full text-[9px] border transition-all ${phase.emotions?.[em] ? 'border-dream-400 bg-dream-600/30 text-dream-200 font-medium' : 'border-dream-700/20 bg-night-900/40 text-gray-500'}">
              ${EMOTION_EMOJIS[em]}
            </button>
          `).join('')}
        </div>
        <div id="phase-emotion-panel-${idx}" class="hidden mt-1.5 p-2 rounded-lg bg-night-900/50 border border-dream-700/20"></div>
      </div>
      <div>
        <div class="flex items-center justify-between">
          <span class="text-[9px] text-gray-500">Interprétations :</span>
          <button type="button" onclick="addPhaseInterpretation(${idx})" class="text-[9px] text-amber-400/60 hover:text-amber-300"><i class="fas fa-plus mr-0.5"></i>Ajouter</button>
        </div>
        <div id="phase-interps-${idx}" class="space-y-1 mt-1">
          ${(phase.interpretations || []).map((interp, j) => `
            <div class="flex gap-1 items-start">
              <input type="text" value="${escapeHtml(interp)}" placeholder="Interprétation..."
                class="flex-1 px-2 py-1 bg-night-900/60 border border-amber-700/15 rounded text-white text-[10px] placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                oninput="updatePhaseInterpretation(${idx}, ${j}, this.value)">
              <button type="button" onclick="removePhaseInterpretation(${idx}, ${j})" class="text-gray-500 hover:text-red-400 p-0.5"><i class="fas fa-times text-[9px]"></i></button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;
}

// ========== Phase Management ==========
window.addPhase = function() {
  window._editorState.phases.push({ title: '', content: '', emotions: {}, interpretations: [] });
  refreshPhasesUI();
};

window.removePhase = function(idx) {
  window._editorState.phases.splice(idx, 1);
  refreshPhasesUI();
};

window.updatePhase = function(idx, field, value) {
  if (window._editorState.phases[idx]) window._editorState.phases[idx][field] = value;
};

window.togglePhaseEmotion = function(idx, em) {
  const phase = window._editorState.phases[idx];
  if (!phase) return;
  if (!phase.emotions) phase.emotions = {};
  if (phase.emotions[em]) {
    // Déjà sélectionnée → réouvrir le panel d'intensité
    showPhaseEmotionIntensityPanel(idx, em);
  } else {
    phase.emotions[em] = 3;
    refreshPhaseEmotionButton(idx, em);
    showPhaseEmotionIntensityPanel(idx, em);
  }
};

function refreshPhaseEmotionButton(idx, em) {
  const phase = window._editorState.phases[idx];
  const btn = document.getElementById(`phase-em-${idx}-${em}`);
  if (!btn) return;
  const isSelected = !!phase?.emotions?.[em];
  btn.className = `px-1.5 py-0.5 rounded-full text-[9px] border transition-all ${isSelected ? 'border-dream-400 bg-dream-600/30 text-dream-200 font-medium' : 'border-dream-700/20 bg-night-900/40 text-gray-500'}`;
  btn.innerHTML = `${EMOTION_EMOJIS[em]}`;
}

function showPhaseEmotionIntensityPanel(idx, em) {
  const panel = document.getElementById(`phase-emotion-panel-${idx}`);
  if (!panel) return;
  const phase = window._editorState.phases[idx];
  const intensity = phase?.emotions?.[em] || 3;
  panel.dataset.emotion = em;
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-xs">${EMOTION_EMOJIS[em]}</span>
      <input type="range" min="1" max="5" value="${intensity}" class="flex-1 accent-dream-400"
        oninput="setPhaseEmotionIntensity(${idx}, '${em}', parseInt(this.value)); this.nextElementSibling.textContent = this.value + '/5'">
      <span class="text-[10px] text-dream-300 w-8 text-right">${intensity}/5</span>
      <button type="button" onclick="removePhaseEmotion(${idx}, '${em}')" class="w-4 h-4 rounded-full bg-red-600/30 text-red-300 text-[8px] flex items-center justify-center hover:bg-red-600/50 transition-all shrink-0" title="Retirer"><i class="fas fa-times"></i></button>
    </div>`;
}

window.removePhaseEmotion = function(idx, em) {
  const phase = window._editorState.phases[idx];
  if (!phase?.emotions) return;
  delete phase.emotions[em];
  refreshPhaseEmotionButton(idx, em);
  const panel = document.getElementById(`phase-emotion-panel-${idx}`);
  if (panel && panel.dataset.emotion === em) panel.classList.add('hidden');
};

window.setPhaseEmotionIntensity = function(idx, em, val) {
  const phase = window._editorState.phases[idx];
  if (phase?.emotions) { phase.emotions[em] = val; refreshPhaseEmotionButton(idx, em); }
};

window.addPhaseInterpretation = function(idx) {
  const phase = window._editorState.phases[idx];
  if (!phase) return;
  if (!phase.interpretations) phase.interpretations = [];
  phase.interpretations.push('');
  refreshPhasesUI();
};

window.removePhaseInterpretation = function(idx, j) {
  const phase = window._editorState.phases[idx];
  if (!phase?.interpretations) return;
  phase.interpretations.splice(j, 1);
  refreshPhasesUI();
};

window.updatePhaseInterpretation = function(idx, j, value) {
  const phase = window._editorState.phases[idx];
  if (phase?.interpretations) phase.interpretations[j] = value;
};

function refreshPhasesUI() {
  const container = document.getElementById('phases-container');
  if (!container) return;
  if (window._editorState.phases.length === 0) {
    container.innerHTML = '<p id="no-phases-msg" class="text-[10px] text-gray-600 italic text-center py-2">Aucune étape ajoutée</p>';
  } else {
    container.innerHTML = window._editorState.phases.map((p, i) => renderPhaseEditor(i, p)).join('');
  }
}

// ========== Global Interpretations ==========
window.addGlobalInterpretation = function() {
  window._editorState.interpretations.push('');
  const container = document.getElementById('interpretations-container');
  const i = window._editorState.interpretations.length - 1;
  container.insertAdjacentHTML('beforeend', `
    <div class="flex gap-1.5 items-start" id="global-interp-${i}">
      <textarea rows="2" placeholder="Votre interprétation..."
        class="interp-global-input flex-1 px-3 py-1.5 bg-night-900/60 border border-amber-700/20 rounded-lg text-white text-xs placeholder-gray-500 focus:border-amber-400 focus:outline-none resize-none"
        oninput="updateGlobalInterpretation(${i}, this.value)"></textarea>
      <button type="button" onclick="removeGlobalInterpretation(${i})" class="text-gray-500 hover:text-red-400 p-1 shrink-0"><i class="fas fa-times text-xs"></i></button>
    </div>
  `);
};

window.updateGlobalInterpretation = function(i, value) {
  window._editorState.interpretations[i] = value;
};

window.removeGlobalInterpretation = function(i) {
  window._editorState.interpretations.splice(i, 1);
  // Re-render all
  const container = document.getElementById('interpretations-container');
  container.innerHTML = window._editorState.interpretations.map((interp, idx) => `
    <div class="flex gap-1.5 items-start" id="global-interp-${idx}">
      <textarea rows="2" placeholder="Votre interprétation..."
        class="interp-global-input flex-1 px-3 py-1.5 bg-night-900/60 border border-amber-700/20 rounded-lg text-white text-xs placeholder-gray-500 focus:border-amber-400 focus:outline-none resize-none"
        oninput="updateGlobalInterpretation(${idx}, this.value)">${escapeHtml(interp)}</textarea>
      <button type="button" onclick="removeGlobalInterpretation(${idx})" class="text-gray-500 hover:text-red-400 p-1 shrink-0"><i class="fas fa-times text-xs"></i></button>
    </div>
  `).join('');
};

// Dream type selection
window.selectDreamType = function(type) {
  window._editorState.dreamType = type;
  document.querySelector('input[name="dreamType"]').value = type;
  document.querySelectorAll('.dream-type-btn').forEach(btn => {
    const isSelected = btn.dataset.type === type;
    btn.className = `dream-type-btn flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${isSelected ? 'border-dream-400 bg-dream-600/30 text-dream-200' : 'border-dream-700/20 bg-night-900/40 text-gray-400 hover:text-gray-200 hover:border-dream-700/40'}`;
  });
};

window.toggleDreamTypeInfo = function() {
  const panel = document.getElementById('dream-type-info');
  if (panel) panel.classList.toggle('hidden');
};

function renderTagChip(t) {
  const catIcon = TAG_CATEGORIES.find(c => c.value === t.category)?.icon || '🏷️';
  return `<span class="tag-chip px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 font-medium" style="background:${t.color}20; color:${t.color}; border: 1px solid ${t.color}40">${catIcon} ${escapeHtml(t.name)} <i class="fas fa-times cursor-pointer text-[8px] opacity-50 hover:opacity-100" onclick="removeTag('${escapeHtml(t.name).replace(/'/g, "\\'")}')"></i></span>`;
}

window.toggleSeriesInEditor = function(seriesId) {
  const idx = window._editorState.seriesIds.indexOf(seriesId);
  if (idx >= 0) { window._editorState.seriesIds.splice(idx, 1); } else { window._editorState.seriesIds.push(seriesId); }
  const btn = document.getElementById(`series-btn-${seriesId}`);
  const isActive = window._editorState.seriesIds.includes(seriesId);
  const color = btn.querySelector('span').style.background;
  if (isActive) {
    btn.style.borderColor = color; btn.style.background = color.replace(')', ', 0.12)').replace('rgb', 'rgba'); btn.style.color = color;
    btn.querySelector('i').className = 'fas fa-check text-[8px] opacity-70';
  } else {
    btn.style.borderColor = ''; btn.style.background = ''; btn.style.color = '';
    btn.querySelector('i').className = 'fas fa-plus text-[8px] opacity-70';
    btn.className = 'series-toggle-btn flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all border-dream-700/20 bg-night-900/30 text-gray-400 hover:text-white hover:border-dream-700/40';
  }
};

window.toggleEmotion = function(em) {
  if (window._editorState.emotions[em]) {
    // Déjà sélectionnée → réouvrir le panel d'intensité (pas désélectionner)
    showEmotionIntensityPanel(em);
  } else {
    window._editorState.emotions[em] = 3;
    refreshEmotionButton(em);
    showEmotionIntensityPanel(em);
  }
};

function refreshEmotionButton(em) {
  const btn = document.getElementById(`em-${em}`);
  if (!btn) return;
  const isSelected = !!window._editorState.emotions[em];
  btn.className = `emotion-btn inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border transition-all ${isSelected ? 'border-dream-400 bg-dream-600/30 text-dream-200 font-medium' : 'border-dream-700/30 bg-night-900/40 text-gray-400'}`;
  btn.innerHTML = `<span>${EMOTION_EMOJIS[em]}</span><span>${EMOTION_LABELS[em]}</span>`;
}

function showEmotionIntensityPanel(em) {
  const panel = document.getElementById('emotion-intensity-panel');
  if (!panel) return;
  const intensity = window._editorState.emotions[em] || 3;
  panel.dataset.emotion = em;
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-sm">${EMOTION_EMOJIS[em]}</span>
      <span class="text-xs text-dream-200 font-medium w-16">${EMOTION_LABELS[em]}</span>
      <input type="range" min="1" max="5" value="${intensity}" class="flex-1 accent-dream-400"
        oninput="setEmotionIntensity('${em}', parseInt(this.value)); this.nextElementSibling.textContent = this.value + '/5'">
      <span class="text-xs text-dream-300 w-8 text-right">${intensity}/5</span>
      <button type="button" onclick="removeEmotion('${em}')" class="w-5 h-5 rounded-full bg-red-600/30 text-red-300 text-[10px] flex items-center justify-center hover:bg-red-600/50 transition-all shrink-0" title="Retirer cette émotion"><i class="fas fa-times"></i></button>
    </div>`;
}

window.removeEmotion = function(em) {
  delete window._editorState.emotions[em];
  refreshEmotionButton(em);
  const panel = document.getElementById('emotion-intensity-panel');
  if (panel && panel.dataset.emotion === em) panel.classList.add('hidden');
};

window.setEmotionIntensity = function(em, val) {
  window._editorState.emotions[em] = val;
  refreshEmotionButton(em);
};

// Tag management — pick existing
window.pickExistingTag = function(tagId) {
  const tag = window._allTags.find(t => t.id === tagId);
  if (!tag) return;
  // Case-insensitive duplicate check
  if (window._editorState.tags.find(t => t.name.toLowerCase() === tag.name.toLowerCase())) return;
  window._editorState.tags.push({ id: tag.id, name: tag.name, category: tag.category, color: tag.color });
  updateTagsDisplay();
  const pickBtn = document.getElementById(`pick-tag-${tagId}`);
  if (pickBtn) { pickBtn.classList.add('opacity-40', 'pointer-events-none'); pickBtn.disabled = true; }
  // Feedback
  const feedback = document.getElementById('tag-feedback');
  const catLabel = TAG_CATEGORIES.find(c => c.value === tag.category);
  if (feedback) { feedback.innerHTML = '<i class="fas fa-check mr-1"></i>' + (catLabel?.icon || '') + ' <b>' + escapeHtml(tag.name) + '</b> ajouté'; feedback.className = 'text-[10px] mt-1 text-emerald-400'; setTimeout(() => feedback.className = 'hidden text-[10px] mt-1', 3000); }
};

// Tag management — select category
window.selectTagCategory = function(cat) {
  document.getElementById('tag-category-select').value = cat;
  document.querySelectorAll('.tag-cat-btn').forEach(btn => {
    const btnCat = btn.dataset.cat;
    if (btnCat === cat) {
      btn.style.borderColor = TAG_COLORS[btnCat];
      btn.style.background = TAG_COLORS[btnCat] + '25';
      btn.style.color = TAG_COLORS[btnCat];
      btn.classList.remove('text-gray-400', 'border-dream-700/20', 'bg-night-900/40');
    } else {
      btn.style.borderColor = ''; btn.style.background = ''; btn.style.color = '';
      btn.classList.add('text-gray-400', 'border-dream-700/20', 'bg-night-900/40');
    }
  });
};

// Tag management — create new
window.addNewTag = function() {
  const input = document.getElementById('tag-input');
  const catSelect = document.getElementById('tag-category-select');
  const feedback = document.getElementById('tag-feedback');
  const name = input.value.trim();
  if (!name) {
    if (feedback) { feedback.textContent = 'Entrez un nom de tag.'; feedback.className = 'text-[10px] mt-1 text-amber-400'; setTimeout(() => feedback.className = 'hidden text-[10px] mt-1', 2000); }
    return;
  }
  // Case-insensitive duplicate check
  const nameLower = name.toLowerCase();
  if (window._editorState.tags.find(t => t.name.toLowerCase() === nameLower)) {
    if (feedback) { feedback.textContent = 'Ce tag est déjà ajouté.'; feedback.className = 'text-[10px] mt-1 text-amber-400'; setTimeout(() => feedback.className = 'hidden text-[10px] mt-1', 2000); }
    input.value = '';
    return;
  }
  const category = catSelect.value || 'custom';
  const color = TAG_COLORS[category] || '#6366f1';
  window._editorState.tags.push({ name, category, color });
  input.value = '';
  updateTagsDisplay();
  // Feedback positif
  const catLabel = TAG_CATEGORIES.find(c => c.value === category);
  if (feedback) { feedback.innerHTML = '<i class="fas fa-check mr-1"></i>' + (catLabel?.icon || '') + ' <b>' + escapeHtml(name) + '</b> ajouté'; feedback.className = 'text-[10px] mt-1 text-emerald-400'; setTimeout(() => feedback.className = 'hidden text-[10px] mt-1', 3000); }
};

window.removeTag = function(name) {
  window._editorState.tags = window._editorState.tags.filter(t => t.name !== name);
  updateTagsDisplay();
  const tag = (window._allTags || []).find(t => t.name === name);
  if (tag) {
    const pickBtn = document.getElementById(`pick-tag-${tag.id}`);
    if (pickBtn) { pickBtn.classList.remove('opacity-40', 'pointer-events-none'); pickBtn.disabled = false; }
  }
};

window._tagManageMode = false;
window.toggleTagManageMode = function() {
  window._tagManageMode = !window._tagManageMode;
  const btn = document.getElementById('tag-manage-btn');
  if (btn) {
    btn.innerHTML = window._tagManageMode
      ? '<i class="fas fa-check text-[8px] mr-0.5"></i>Terminé'
      : '<i class="fas fa-pen text-[8px] mr-0.5"></i>Gérer';
    btn.className = `text-[9px] transition-all ${window._tagManageMode ? 'text-dream-300' : 'text-gray-500 hover:text-dream-300'}`;
  }
  document.querySelectorAll('.tag-delete-btn').forEach(b => {
    b.classList.toggle('hidden', !window._tagManageMode);
    if (window._tagManageMode) b.classList.add('inline-flex');
    else b.classList.remove('inline-flex');
  });
};

window.deleteExistingTag = async function(tagId, tagName) {
  if (!confirm(`Supprimer le tag "${tagName}" définitivement ? Il sera retiré de tous les rêves.`)) return;
  try {
    await api(`/tags/${tagId}`, { method: 'DELETE' });
    // Retirer de _allTags
    window._allTags = (window._allTags || []).filter(t => t.id !== tagId);
    // Retirer des tags sélectionnés si présent
    window._editorState.tags = window._editorState.tags.filter(t => t.id !== tagId);
    updateTagsDisplay();
    // Retirer de l'UI
    const item = document.getElementById(`tag-item-${tagId}`);
    if (item) item.remove();
    showToast('🗑️ Tag supprimé');
  } catch (err) { alert(err.message); }
};

function updateTagsDisplay() {
  const container = document.getElementById('selected-tags');
  if (!container) return;
  container.innerHTML = window._editorState.tags.length
    ? window._editorState.tags.map(t => renderTagChip(t)).join('')
    : '<span class="text-[10px] text-gray-600 italic">Aucun tag</span>';
}

window.saveDream = async function(e, id) {
  e.preventDefault();
  const form = new FormData(e.target);
  const errEl = document.getElementById('save-error');
  errEl.classList.add('hidden');

  // Build phases data from editor state
  const phasesData = window._editorState.phases
    .filter(p => p.content?.trim())
    .map(p => ({
      title: p.title || '',
      content: p.content,
      emotions: Object.entries(p.emotions || {}).map(([emotion, intensity]) => ({ emotion, intensity })),
      interpretations: (p.interpretations || []).filter(i => i?.trim()).map(i => ({ content: i }))
    }));

  const interpData = window._editorState.interpretations
    .filter(i => i?.trim())
    .map(i => ({ content: i }));

  const body = {
    title: form.get('title'), content: form.get('content'), dreamDate: form.get('dreamDate'),
    dreamType: form.get('dreamType'), lucidityLevel: parseInt(form.get('lucidityLevel')),
    clarity: parseInt(form.get('clarity')), sleepQuality: 0,
    isFavorite: window._editorState.dream?.is_favorite || false,
    emotions: Object.entries(window._editorState.emotions).map(([emotion, intensity]) => ({ emotion, intensity })),
    tags: window._editorState.tags,
    phases: phasesData,
    interpretations: interpData,
    wishedContinuation: form.get('wishedContinuation')?.trim() || null
  };
  try {
    let dreamId = id;
    if (id) { await api(`/dreams/${id}`, { method: 'PUT', body: JSON.stringify(body) }); }
    else { const res = await api('/dreams', { method: 'POST', body: JSON.stringify(body) }); dreamId = res.id; }
    if (dreamId && window._editorState.seriesIds.length) {
      for (const sid of window._editorState.seriesIds) {
        try { await api(`/series/${sid}/dreams`, { method: 'POST', body: JSON.stringify({ dreamId }) }); } catch {}
      }
    }
    // Gérer le lien intention <-> rêve (bidirectionnel)
    const previousIntentionId = window._editorState._previousRealizedIntentionId;
    const newIntentionId = window._editorState.realizedIntentionId;
    // Si l'intention a changé, d'abord détacher l'ancienne
    if (previousIntentionId && previousIntentionId !== newIntentionId) {
      try { await api(`/intentions/${previousIntentionId}/unrealize`, { method: 'PUT' }); } catch {}
    }
    // Puis attacher la nouvelle
    if (dreamId && newIntentionId) {
      try { await api(`/intentions/${newIntentionId}/realize`, { method: 'PUT', body: JSON.stringify({ realizedDreamId: dreamId }) }); } catch {}
    }
    // Si suite souhaitée remplie, créer/mettre à jour une intention de suite automatique
    if (dreamId && body.wishedContinuation) {
      try {
        // Vérifier s'il existe déjà une intention de suite pour ce rêve
        const existing = await api(`/intentions/for-dream/${dreamId}`);
        const autoIntention = existing.intentions?.find(i => i.status === 'active');
        if (autoIntention) {
          // Mettre à jour l'intention existante
          await api(`/intentions/${autoIntention.id}`, { method: 'PUT', body: JSON.stringify({ title: 'Suite : ' + body.title, description: body.wishedContinuation }) });
        } else {
          // Créer une nouvelle intention de suite
          await api('/intentions', { method: 'POST', body: JSON.stringify({ type: 'dream_continuation', sourceDreamId: dreamId, title: 'Suite : ' + body.title, description: body.wishedContinuation }) });
        }
      } catch {}
    }
    closeModal();
    const tagCount = body.tags?.length || 0;
    showToast(id ? 'Rêve mis à jour' + (tagCount ? ' (' + tagCount + ' tag' + (tagCount > 1 ? 's' : '') + ')' : '') : 'Rêve enregistré !');
    if (state.currentView === 'dream-detail') { renderDreamDetailPage(state.dreamDetailId || dreamId); }
    else if (state.currentView === 'journal') renderJournal();
    else if (state.currentView === 'series') renderSeries();
    else if (state.currentView === 'intentions') renderIntentions();
    else renderJournal();
  } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
};

window.deleteDream = async function(id) {
  if (!confirm('Supprimer ce rêve ? Cette action est irréversible.')) return;
  try {
    await api(`/dreams/${id}`, { method: 'DELETE' });
    showToast('🗑️ Rêve supprimé');
    if (state.currentView === 'dream-detail') goBackFromDreamDetail();
    else renderJournal();
  } catch (err) { alert(err.message); }
};

// ========== SERIES VIEW ==========
async function renderSeries() {
  const main = document.getElementById('main-content');
  try { const data = await api('/series'); state.series = data.series; } catch (err) { main.innerHTML = `<div class="text-center py-12 text-red-400">${err.message}</div>`; return; }
  main.innerHTML = `
    <div class="animate-slideUp">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-base font-display font-semibold text-dream-200"><i class="fas fa-layer-group mr-2"></i>Mes séries</h2>
        <button onclick="openSeriesEditor()" class="px-3 py-2 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg text-xs font-medium hover:from-dream-400 hover:to-dream-600 transition-all">
          <i class="fas fa-plus mr-1"></i>Nouvelle série
        </button>
      </div>
      ${state.series.length === 0 ? `
        <div class="text-center py-12">
          <div class="text-5xl mb-4">📚</div>
          <h3 class="text-lg font-display font-semibold text-dream-200 mb-2">Aucune série</h3>
          <p class="text-gray-400 mb-6 max-w-md mx-auto text-sm">Regroupez vos rêves en séries narratives.</p>
          <button onclick="openSeriesEditor()" class="px-6 py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-xl font-medium"><i class="fas fa-plus mr-2"></i>Créer ma première série</button>
        </div>
      ` : `
        <div class="grid gap-3 sm:grid-cols-2">
          ${state.series.map(s => `
            <div class="glass rounded-xl p-4 hover:border-dream-400/30 transition-all cursor-pointer" onclick="openSeriesDetail(${s.id})">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-base shrink-0">📚</span>
                <h3 class="font-semibold text-dream-100 text-sm flex-1 truncate">${escapeHtml(s.name)}</h3>
                <span class="text-[10px] text-gray-500 shrink-0">${s.dream_count || 0} rêve(s)</span>
              </div>
              ${s.description ? `<p class="text-xs text-gray-400 mb-2 line-clamp-2">${escapeHtml(s.description)}</p>` : ''}
              <div class="flex gap-2 mt-2">
                <button onclick="event.stopPropagation(); openDreamEditorForSeries(${s.id})" class="flex-1 py-1.5 bg-night-800/40 text-gray-300 rounded-lg text-[10px] hover:bg-night-800/60 transition-all"><i class="fas fa-plus mr-1"></i>Nouveau rêve</button>
                <button onclick="event.stopPropagation(); openSeriesDetail(${s.id})" class="flex-1 py-1.5 bg-dream-600/20 text-dream-300 rounded-lg text-[10px] hover:bg-dream-600/30 transition-all"><i class="fas fa-book-open mr-1"></i>Rêves de la série</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>`;
}

window.openDreamEditorForSeries = async function(seriesId) {
  await openDreamEditor();
  window._editorState.seriesIds = [seriesId];
  const btn = document.getElementById(`series-btn-${seriesId}`);
  if (btn) {
    const color = btn.querySelector('span').style.background;
    btn.style.borderColor = color; btn.style.background = color.replace(')', ', 0.12)').replace('rgb', 'rgba'); btn.style.color = color;
    btn.querySelector('i').className = 'fas fa-check text-[8px] opacity-70';
  }
};

window.openSeriesDetail = async function(id) {
  try {
    const series = await api(`/series/${id}`);
    showModal(`
      <div class="p-4 sm:p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2"><span class="text-lg">📚</span><h2 class="text-lg font-display font-bold text-dream-100">${escapeHtml(series.name)}</h2></div>
          <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
        </div>
        ${series.description ? `<p class="text-sm text-gray-400 mb-4">${escapeHtml(series.description)}</p>` : ''}
        <h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-3">Rêves de la série (${series.dreams?.length || 0})</h4>
        <div id="series-dreams-list" class="space-y-1.5 max-h-56 overflow-y-auto mb-4">
          ${(series.dreams || []).map((d, i) => `
            <div class="flex items-center gap-2 p-2 rounded-lg bg-night-900/40 group" data-dream-id="${d.id}">
              <div class="flex flex-col gap-0.5 shrink-0">
                <button onclick="moveDreamInSeries(${id}, ${d.id}, 'up')" class="text-[9px] text-gray-500 hover:text-dream-300 ${i === 0 ? 'invisible' : ''}"><i class="fas fa-chevron-up"></i></button>
                <span class="w-5 h-5 rounded-full bg-dream-600/30 text-dream-300 text-[10px] flex items-center justify-center font-bold">${i + 1}</span>
                <button onclick="moveDreamInSeries(${id}, ${d.id}, 'down')" class="text-[9px] text-gray-500 hover:text-dream-300 ${i === (series.dreams || []).length - 1 ? 'invisible' : ''}"><i class="fas fa-chevron-down"></i></button>
              </div>
              <div class="flex-1 min-w-0 cursor-pointer" onclick="closeModal(); openDreamDetail(${d.id})">
                <p class="text-xs font-medium text-dream-200 truncate">${escapeHtml(d.title)}</p>
                <p class="text-[10px] text-gray-500">${d.dream_date}</p>
              </div>
              <button onclick="removeFromSeries(${id}, ${d.id})" class="text-gray-500 hover:text-red-400 text-xs shrink-0 p-1"><i class="fas fa-times"></i></button>
            </div>
          `).join('')}
          ${!(series.dreams?.length) ? '<p class="text-xs text-gray-500 text-center py-3">Aucun rêve dans cette série</p>' : ''}
        </div>
        <div class="space-y-2">
          <button onclick="closeModal(); openDreamEditorForSeries(${id})" class="w-full py-2 bg-night-800/40 text-gray-300 rounded-lg text-xs hover:bg-night-800/60 transition-all"><i class="fas fa-feather-alt mr-1"></i>Créer un nouveau rêve</button>
          <button onclick="closeModal(); openSeriesDreamSelector(${id})" class="w-full py-2 bg-dream-600/20 text-dream-300 rounded-lg text-xs hover:bg-dream-600/30 transition-all"><i class="fas fa-check-square mr-1"></i>Gérer les rêves de la série</button>
          <button onclick="closeModal(); openSeriesEditor({id:${id}, name:'${escapeHtml(series.name).replace(/'/g, "\\'")}', description:'${escapeHtml(series.description || '').replace(/'/g, "\\'")}', color:'${series.color}'})" class="w-full py-2 bg-amber-600/15 text-amber-300 rounded-lg text-xs hover:bg-amber-600/25 transition-all"><i class="fas fa-pen mr-1"></i>Modifier la série</button>
        </div>
      </div>
    `);
  } catch (err) { alert(err.message); }
};

window.moveDreamInSeries = async function(seriesId, dreamId, direction) {
  try {
    const series = await api(`/series/${seriesId}`);
    const dreams = series.dreams || [];
    const idx = dreams.findIndex(d => d.id === dreamId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= dreams.length) return;
    const ids = dreams.map(d => d.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    await api(`/series/${seriesId}/reorder`, { method: 'PUT', body: JSON.stringify({ dreamIds: ids }) });
    closeModal(); openSeriesDetail(seriesId);
  } catch (err) { alert(err.message); }
};

window.openSeriesEditor = async function(series) {
  let allDreams = [];
  try { allDreams = (await api('/dreams?limit=100')).dreams; } catch {}
  let seriesDreamIds = [];
  if (series?.id) {
    try { const detail = await api(`/series/${series.id}`); seriesDreamIds = (detail.dreams || []).map(d => d.id); } catch {}
  }
  window._seriesEditorState = { selectedDreamIds: [...seriesDreamIds] };
  showModal(`
    <div class="p-4 sm:p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-display font-bold text-dream-100">${series ? 'Modifier la série' : '📚 Nouvelle série'}</h2>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white p-1"><i class="fas fa-times"></i></button>
      </div>
      <form onsubmit="saveSeries(event, ${series?.id || 'null'})">
        <input type="text" name="name" value="${series?.name || ''}" placeholder="Nom de la série" required class="w-full mb-3 px-3 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none text-sm">
        <textarea name="description" rows="2" placeholder="Description (optionnel)" class="w-full mb-3 px-3 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none text-sm">${series?.description || ''}</textarea>
        <input type="hidden" name="color" value="${series?.color || '#8b5cf6'}">
        ${allDreams.length ? `
        <div class="mb-4">
          <label class="text-xs text-gray-400 mb-2 block">Sélectionner des rêves</label>
          <div class="space-y-1 max-h-48 overflow-y-auto p-2 bg-night-900/30 rounded-lg border border-dream-700/10">
            ${allDreams.map(d => `
              <label class="flex items-center gap-2 p-2 rounded-lg hover:bg-night-900/40 cursor-pointer transition-all">
                <input type="checkbox" value="${d.id}" class="series-dream-checkbox accent-dream-400" onchange="toggleDreamInSeriesEditor(${d.id})" ${seriesDreamIds.includes(d.id) ? 'checked' : ''}>
                <div class="flex-1 min-w-0"><p class="text-xs font-medium text-dream-200 truncate">${escapeHtml(d.title)}</p><p class="text-[10px] text-gray-500">${d.dream_date} • ${d.dream_type}</p></div>
              </label>
            `).join('')}
          </div>
        </div>` : ''}
        <button type="submit" class="w-full py-2.5 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg font-semibold text-sm"><i class="fas fa-save mr-2"></i>Enregistrer</button>
      </form>
    </div>
  `);
};

window.toggleDreamInSeriesEditor = function(dreamId) {
  const ids = window._seriesEditorState.selectedDreamIds;
  const idx = ids.indexOf(dreamId);
  if (idx >= 0) ids.splice(idx, 1); else ids.push(dreamId);
};

window.saveSeries = async function(e, id) {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = { name: form.get('name'), description: form.get('description'), color: form.get('color') };
  try {
    let seriesId = id;
    if (id) { await api(`/series/${id}`, { method: 'PUT', body: JSON.stringify(body) }); }
    else { const res = await api('/series', { method: 'POST', body: JSON.stringify(body) }); seriesId = res.id; }
    if (seriesId && window._seriesEditorState?.selectedDreamIds.length) {
      for (const dreamId of window._seriesEditorState.selectedDreamIds) {
        try { await api(`/series/${seriesId}/dreams`, { method: 'POST', body: JSON.stringify({ dreamId }) }); } catch {}
      }
      try { await api(`/series/${seriesId}/reorder`, { method: 'PUT', body: JSON.stringify({ dreamIds: window._seriesEditorState.selectedDreamIds }) }); } catch {}
    }
    closeModal(); renderSeries();
  } catch (err) { alert(err.message); }
};

window.openSeriesDreamSelector = async function(seriesId) {
  let allDreams = [], seriesDreamIds = [];
  try { allDreams = (await api('/dreams?limit=100')).dreams; } catch {}
  try { const detail = await api(`/series/${seriesId}`); seriesDreamIds = (detail.dreams || []).map(d => d.id); } catch {}
  window._seriesSelectorState = { seriesId, originalIds: [...seriesDreamIds], currentIds: [...seriesDreamIds] };
  showModal(`
    <div class="p-4 sm:p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-display font-bold text-dream-100">Gérer les rêves de la série</h2>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      <p class="text-[10px] text-gray-400 mb-3">Coche les rêves à inclure dans cette série. Décoche pour les retirer.</p>
      <div class="space-y-1 max-h-72 overflow-y-auto p-2 bg-night-900/30 rounded-lg border border-dream-700/10 mb-4">
        ${allDreams.map(d => `
          <label class="flex items-center gap-2 p-2 rounded-lg hover:bg-night-900/40 cursor-pointer transition-all">
            <input type="checkbox" value="${d.id}" class="series-selector-cb accent-dream-400" onchange="toggleSeriesSelector(${d.id})" ${seriesDreamIds.includes(d.id) ? 'checked' : ''}>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-dream-200 truncate">${escapeHtml(d.title)}</p>
              <p class="text-[10px] text-gray-500">${d.dream_date}</p>
            </div>
            ${seriesDreamIds.includes(d.id) ? '<span class="text-[9px] text-dream-400 shrink-0">dans la série</span>' : ''}
          </label>
        `).join('')}
        ${allDreams.length === 0 ? '<p class="text-xs text-gray-500 text-center py-3">Aucun rêve enregistré</p>' : ''}
      </div>
      <button onclick="saveSeriesDreamSelection()" class="w-full py-2.5 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg font-semibold text-sm hover:from-dream-400 hover:to-dream-600 transition-all"><i class="fas fa-save mr-2"></i>Enregistrer</button>
    </div>
  `);
};

window.toggleSeriesSelector = function(dreamId) {
  const ids = window._seriesSelectorState.currentIds;
  const idx = ids.indexOf(dreamId);
  if (idx >= 0) ids.splice(idx, 1); else ids.push(dreamId);
};

window.saveSeriesDreamSelection = async function() {
  const { seriesId, originalIds, currentIds } = window._seriesSelectorState;
  try {
    // Add new dreams
    for (const id of currentIds) {
      if (!originalIds.includes(id)) {
        await api(`/series/${seriesId}/dreams`, { method: 'POST', body: JSON.stringify({ dreamId: id }) });
      }
    }
    // Remove unchecked dreams
    for (const id of originalIds) {
      if (!currentIds.includes(id)) {
        await api(`/series/${seriesId}/dreams/${id}`, { method: 'DELETE' });
      }
    }
    // Reorder with current selection order
    if (currentIds.length > 0) {
      try { await api(`/series/${seriesId}/reorder`, { method: 'PUT', body: JSON.stringify({ dreamIds: currentIds }) }); } catch {}
    }
    closeModal();
    showToast('Rêves de la série mis à jour');
    if (state.currentView === 'series') renderSeries();
  } catch (err) { alert(err.message); }
};
window.removeFromSeries = async function(seriesId, dreamId) {
  if (!confirm('Voulez-vous vraiment retirer ce rêve de la série ?')) return;
  try { await api(`/series/${seriesId}/dreams/${dreamId}`, { method: 'DELETE' }); closeModal(); openSeriesDetail(seriesId); } catch (err) { alert(err.message); }
};

// ========== INCUBATION ==========
window.startIncubation = async function(seriesId) {
  let series, lastDream;
  try { const data = await api(`/series/${seriesId}`); series = data; if (data.dreams?.length) lastDream = data.dreams[data.dreams.length - 1]; } catch (err) { alert(err.message); return; }
  showModal(`
    <div class="incubation-bg p-4 sm:p-6 rounded-xl">
      <div class="text-center mb-5"><div class="text-4xl mb-3 animate-float">🌙</div><h2 class="text-xl font-display font-bold text-dream-100">Mode Incubation</h2><p class="text-xs text-gray-400 mt-1">Série : ${escapeHtml(series.name)}</p></div>
      ${lastDream ? `<div class="glass-light rounded-lg p-3 mb-4"><p class="text-[10px] text-gray-400 mb-1">Dernier rêve :</p><p class="text-xs text-dream-200 font-medium">${escapeHtml(lastDream.title)}</p><p class="text-[10px] text-gray-400 mt-1 line-clamp-3">${escapeHtml(lastDream.content?.substring(0, 200))}</p></div>` : ''}
      <form onsubmit="saveIncubation(event, ${seriesId})">
        <textarea name="intent" rows="3" placeholder="Formulez votre intention de rêve pour cette nuit..." required class="w-full mb-3 px-3 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-sm placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none"></textarea>
        <input type="date" name="targetDate" value="${new Date().toISOString().split('T')[0]}" class="w-full mb-4 px-3 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white focus:border-dream-400 focus:outline-none text-sm">
        <button type="submit" class="w-full py-2.5 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg font-semibold text-sm"><i class="fas fa-moon mr-2"></i>Programmer l'incubation</button>
      </form>
      <div class="mt-4 p-2.5 rounded-lg bg-night-900/30 border border-dream-700/10"><p class="text-[10px] text-gray-400"><i class="fas fa-info-circle mr-1 text-dream-400"></i>Relisez votre intention avant de dormir. Visualisez la scène souhaitée. Barrett (1993) : ~50% de succès.</p></div>
    </div>
  `);
};

window.saveIncubation = async function(e, seriesId) {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await api('/incubation', { method: 'POST', body: JSON.stringify({ seriesId, intentText: form.get('intent'), targetDate: form.get('targetDate') }) });
    closeModal(); showToast('🌙 Incubation programmée !');
  } catch (err) { alert(err.message); }
};

// ========== INCUBATION — OUVRIR LE DERNIER RÊVE ==========
window.openLastDreamForIncubation = async function() {
  try {
    const data = await api('/dreams?page=1&limit=1');
    if (!data.dreams?.length) {
      showToast('Aucun rêve enregistré. Notez d\'abord un rêve !');
      return;
    }
    const lastDream = data.dreams[0];
    await openDreamEditor(lastDream.id);
    // Scroll vers la section "Suite souhaitée" après un court délai (le modal doit être rendu)
    setTimeout(() => {
      const section = document.getElementById('dream-continuation-section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        section.classList.add('ring-2', 'ring-indigo-400/50');
        setTimeout(() => section.classList.remove('ring-2', 'ring-indigo-400/50'), 3000);
      }
    }, 300);
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
};

// ========== INTENTIONS VIEW ==========
async function renderIntentions() {
  const main = document.getElementById('main-content');
  let intentions = [];
  try { intentions = (await api('/intentions')).intentions; } catch {}

  const filterState = window._intentionFilter || 'all'; // 'all', 'new_dream', 'dream_continuation'
  const filtered = filterState === 'all' ? intentions : intentions.filter(i => i.type === filterState);

  const activeCount = intentions.filter(i => i.status === 'active').length;
  const realizedCount = intentions.filter(i => i.status === 'realized').length;

  main.innerHTML = `
    <div class="animate-slideUp">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-display font-semibold text-dream-200"><i class="fas fa-lightbulb mr-2 text-indigo-400"></i>Mes Intentions</h2>
        <button onclick="openIntentionEditor()" class="px-3 py-2 bg-gradient-to-r from-indigo-500 to-dream-600 text-white rounded-xl text-xs font-medium hover:from-indigo-400 hover:to-dream-500 transition-all">
          <i class="fas fa-plus mr-1"></i>Nouveau rêve
        </button>
      </div>

      <!-- Stats -->
      <div class="flex gap-2 mb-4">
        <div class="flex-1 glass rounded-lg p-2.5 text-center">
          <div class="text-lg font-bold text-indigo-300">${activeCount}</div>
          <div class="text-[9px] text-gray-400">Active${activeCount > 1 ? 's' : ''}</div>
        </div>
        <div class="flex-1 glass rounded-lg p-2.5 text-center">
          <div class="text-lg font-bold text-emerald-300">${realizedCount}</div>
          <div class="text-[9px] text-gray-400">Réalisée${realizedCount > 1 ? 's' : ''}</div>
        </div>
        <div class="flex-1 glass rounded-lg p-2.5 text-center">
          <div class="text-lg font-bold text-dream-300">${intentions.length}</div>
          <div class="text-[9px] text-gray-400">Total</div>
        </div>
      </div>

      <!-- Filtres type -->
      <div class="flex gap-1.5 mb-4">
        <button onclick="filterIntentions('all')" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterState === 'all' ? 'bg-dream-600/40 text-dream-200 border border-dream-400/40' : 'bg-night-900/40 text-gray-400 border border-dream-700/20 hover:text-white'}">Toutes</button>
        <button onclick="filterIntentions('new_dream')" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterState === 'new_dream' ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-400/40' : 'bg-night-900/40 text-gray-400 border border-dream-700/20 hover:text-white'}"><i class="fas fa-star mr-1 text-[9px]"></i>Nouveaux rêves</button>
        <button onclick="filterIntentions('dream_continuation')" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterState === 'dream_continuation' ? 'bg-violet-600/40 text-violet-200 border border-violet-400/40' : 'bg-night-900/40 text-gray-400 border border-dream-700/20 hover:text-white'}"><i class="fas fa-moon mr-1 text-[9px]"></i>Suites de rêves</button>
      </div>

      <!-- Liste des intentions -->
      <div class="space-y-3">
        ${filtered.length === 0 ? `
          <div class="text-center py-10">
            <div class="text-4xl mb-3">💭</div>
            <h3 class="text-base font-display font-semibold text-dream-200 mb-2">Aucune intention</h3>
            <p class="text-sm text-gray-400 mb-4 max-w-sm mx-auto">Imaginez le rêve que vous aimeriez faire. L'intention est la première étape vers le rêve lucide.</p>
            <button onclick="openIntentionEditor()" class="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-dream-600 text-white rounded-xl text-sm font-medium"><i class="fas fa-plus mr-1"></i>Créer une intention</button>
          </div>
        ` : filtered.map(i => renderIntentionCard(i)).join('')}
      </div>
    </div>`;
}

function renderIntentionCard(i) {
  const isRealized = i.status === 'realized';
  const isArchived = i.status === 'archived';
  const isContinuation = i.type === 'dream_continuation';
  const typeIcon = isContinuation ? '🌙' : '✨';
  const typeLabel = isContinuation ? 'Suite de rêve' : 'Nouveau rêve';
  const statusClasses = isRealized ? 'border-emerald-500/20' : isArchived ? 'border-gray-700/20 opacity-60' : 'border-dream-700/15';
  const dateStr = new Date(i.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return `
    <div class="glass rounded-xl p-3 sm:p-4 ${statusClasses} transition-all">
      <div class="flex items-start gap-2.5">
        <div class="text-xl mt-0.5 shrink-0">${typeIcon}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 mb-1">
            <h3 class="font-semibold ${isRealized ? 'text-emerald-200' : 'text-dream-100'} text-sm truncate flex-1 select-none">${escapeHtml(i.title)}</h3>
            ${isRealized ? '<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-600/30 text-emerald-300 shrink-0">Réalisée</span>' : ''}
            ${isArchived ? '<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-600/30 text-gray-400 shrink-0">Archivée</span>' : ''}
          </div>
          <div class="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span class="text-[9px] px-1.5 py-0.5 rounded-full ${isContinuation ? 'bg-violet-600/25 text-violet-300' : 'bg-indigo-600/25 text-indigo-300'}">${typeLabel}</span>
            ${isContinuation && i.source_dream_title ? `<span class="text-[9px] text-gray-500 truncate max-w-[40vw]"><i class="fas fa-link mr-0.5"></i>${escapeHtml(i.source_dream_title)}</span>` : ''}
            ${isRealized && i.realized_dream_title ? `<span class="text-[9px] text-emerald-400/70 truncate max-w-[40vw] cursor-pointer hover:text-emerald-300 transition-all" onclick="event.stopPropagation(); openDreamDetail(${i.realized_dream_id})"><i class="fas fa-check mr-0.5"></i>${escapeHtml(i.realized_dream_title)}</span>` : ''}
          </div>
          ${i.description ? `<p class="text-xs text-gray-400 mb-1.5 line-clamp-2 select-none">${escapeHtml(i.description)}</p>` : ''}
          <span class="text-[10px] text-gray-500 select-none"><i class="far fa-calendar mr-1"></i>${dateStr}</span>
        </div>
      </div>
      <div class="flex items-center gap-1 mt-2 pt-2 border-t border-dream-700/10">
        <button onclick="viewIntentionDetail(${i.id})" class="flex-1 py-1.5 text-[10px] text-gray-400 hover:text-dream-300 hover:bg-dream-600/10 rounded-lg transition-all"><i class="fas fa-eye mr-1"></i>Voir</button>
        ${!isRealized && !isArchived ? `<button onclick="openIntentionEditor(${i.id})" class="flex-1 py-1.5 text-[10px] text-gray-400 hover:text-dream-300 hover:bg-dream-600/10 rounded-lg transition-all"><i class="fas fa-edit mr-1"></i>Modifier</button>` : ''}
        ${!isRealized && !isArchived ? `<button onclick="openRealizeIntention(${i.id})" class="flex-1 py-1.5 text-[10px] text-gray-400 hover:text-emerald-300 hover:bg-emerald-600/10 rounded-lg transition-all"><i class="fas fa-check-circle mr-1"></i>Réaliser</button>` : ''}
        ${isArchived ? `<button onclick="reactivateIntention(${i.id})" class="flex-1 py-1.5 text-[10px] text-gray-400 hover:text-indigo-300 hover:bg-indigo-600/10 rounded-lg transition-all"><i class="fas fa-redo mr-1"></i>Réactiver</button>` : ''}
        ${isRealized ? `<button onclick="unrealizeIntention(${i.id})" class="flex-1 py-1.5 text-[10px] text-gray-400 hover:text-amber-300 hover:bg-amber-600/10 rounded-lg transition-all"><i class="fas fa-undo mr-1"></i>Réactiver</button>` : ''}
        <button onclick="deleteIntention(${i.id})" class="flex-1 py-1.5 text-[10px] text-gray-400 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-all"><i class="fas fa-trash mr-1"></i>Supprimer</button>
      </div>
    </div>`;
}

window.filterIntentions = function(type) {
  window._intentionFilter = type;
  renderIntentions();
};

window.openIntentionEditor = async function(intentionId) {
  let intention = null;
  if (intentionId) {
    try {
      const data = await api('/intentions');
      intention = data.intentions.find(i => i.id === intentionId);
    } catch {}
  }

  // Charger la liste des rêves pour le sélecteur "suite de rêve"
  let dreams = [];
  try { const data = await api('/dreams?limit=100'); dreams = data.dreams; } catch {}

  const isEdit = !!intention;
  const type = intention?.type || 'new_dream';

  showModal(`
    <div class="p-4 sm:p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-display font-semibold text-dream-100">
          <i class="fas fa-lightbulb mr-2 text-indigo-400"></i>${isEdit ? 'Modifier l\'intention' : 'Nouvelle intention'}
        </h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white p-1"><i class="fas fa-times"></i></button>
      </div>
      <form onsubmit="saveIntention(event, ${intentionId || 'null'})">
        <!-- Type d'intention -->
        <div class="mb-3">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Type d'intention</label>
          <div class="flex gap-2">
            <button type="button" onclick="switchIntentionType('new_dream')" id="intent-type-new"
              class="flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${type === 'new_dream' ? 'border-indigo-400 bg-indigo-600/30 text-indigo-200' : 'border-dream-700/20 bg-night-900/40 text-gray-400'}">
              <i class="fas fa-star mr-1"></i>Nouveau rêve
            </button>
            <button type="button" onclick="switchIntentionType('dream_continuation')" id="intent-type-cont"
              class="flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${type === 'dream_continuation' ? 'border-violet-400 bg-violet-600/30 text-violet-200' : 'border-dream-700/20 bg-night-900/40 text-gray-400'}">
              <i class="fas fa-moon mr-1"></i>Suite de rêve
            </button>
          </div>
          <input type="hidden" name="type" id="intent-type-value" value="${type}">
        </div>

        <!-- Sélecteur de rêve source (pour suites) -->
        <div id="intent-source-dream" class="${type === 'dream_continuation' ? '' : 'hidden'} mb-3">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Rêve source</label>
          <select name="sourceDreamId" class="w-full px-3 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-xs focus:border-dream-400 focus:outline-none">
            <option value="">Sélectionner un rêve...</option>
            ${dreams.map(d => `<option value="${d.id}" ${intention?.source_dream_id === d.id ? 'selected' : ''}>${escapeHtml(d.title)} (${new Date(d.dream_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})</option>`).join('')}
          </select>
        </div>

        <!-- Titre -->
        <div class="mb-3">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Titre de l'intention</label>
          <input type="text" name="title" required placeholder="Ex: Voler au-dessus de l'océan..."
            value="${intention ? escapeHtml(intention.title) : ''}"
            class="w-full px-3 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-xs placeholder-gray-500 focus:border-dream-400 focus:outline-none">
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Description (optionnel)</label>
          <textarea name="description" rows="4" placeholder="Décrivez le rêve que vous aimeriez faire : la scène, les sensations, les actions..."
            class="w-full px-3 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-xs placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none">${intention?.description ? escapeHtml(intention.description) : ''}</textarea>
        </div>

        <button type="submit" class="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-dream-600 text-white rounded-lg font-semibold text-sm">
          <i class="fas fa-save mr-2"></i>${isEdit ? 'Enregistrer' : 'Créer l\'intention'}
        </button>
      </form>
    </div>
  `, '550px');
};

window.switchIntentionType = function(type) {
  document.getElementById('intent-type-value').value = type;
  const btnNew = document.getElementById('intent-type-new');
  const btnCont = document.getElementById('intent-type-cont');
  const sourceSection = document.getElementById('intent-source-dream');
  if (type === 'new_dream') {
    btnNew.className = 'flex-1 py-2 rounded-lg text-xs font-medium border transition-all border-indigo-400 bg-indigo-600/30 text-indigo-200';
    btnCont.className = 'flex-1 py-2 rounded-lg text-xs font-medium border transition-all border-dream-700/20 bg-night-900/40 text-gray-400';
    sourceSection.classList.add('hidden');
  } else {
    btnNew.className = 'flex-1 py-2 rounded-lg text-xs font-medium border transition-all border-dream-700/20 bg-night-900/40 text-gray-400';
    btnCont.className = 'flex-1 py-2 rounded-lg text-xs font-medium border transition-all border-violet-400 bg-violet-600/30 text-violet-200';
    sourceSection.classList.remove('hidden');
  }
};

window.saveIntention = async function(e, id) {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = {
    type: form.get('type'),
    title: form.get('title'),
    description: form.get('description') || null,
    sourceDreamId: form.get('sourceDreamId') ? parseInt(form.get('sourceDreamId')) : null
  };
  try {
    if (id) { await api(`/intentions/${id}`, { method: 'PUT', body: JSON.stringify(body) }); }
    else { await api('/intentions', { method: 'POST', body: JSON.stringify(body) }); }
    closeModal();
    showToast(id ? 'Intention mise à jour' : '💭 Intention créée !');
    renderIntentions();
  } catch (err) { alert(err.message); }
};

window.archiveIntention = async function(id) {
  try { await api(`/intentions/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'archived' }) }); showToast('Intention archivée'); renderIntentions(); } catch (err) { alert(err.message); }
};

window.viewIntentionDetail = function(id) {
  // Find the intention in current data and show detail modal
  (async () => {
    let intentions = [];
    try { intentions = (await api('/intentions')).intentions; } catch { return; }
    const i = intentions.find(x => x.id === id);
    if (!i) return;
    const isContinuation = i.type === 'dream_continuation';
    const typeIcon = isContinuation ? '🌙' : '✨';
    const typeLabel = isContinuation ? 'Suite de rêve' : 'Nouveau rêve';
    const statusLabel = i.status === 'realized' ? '<span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-600/30 text-emerald-300">Réalisée</span>' : i.status === 'archived' ? '<span class="px-2 py-0.5 rounded-full text-[10px] bg-gray-600/30 text-gray-400">Archivée</span>' : '<span class="px-2 py-0.5 rounded-full text-[10px] bg-indigo-600/25 text-indigo-300">Active</span>';
    const dateStr = new Date(i.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    showModal(`
      <div class="p-4 sm:p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-display font-semibold text-dream-100">${typeIcon} ${escapeHtml(i.title)}</h3>
          <button onclick="closeModal()" class="text-gray-400 hover:text-white p-1"><i class="fas fa-times"></i></button>
        </div>
        <div class="flex items-center gap-2 mb-3 flex-wrap">
          <span class="text-[10px] px-1.5 py-0.5 rounded-full ${isContinuation ? 'bg-violet-600/25 text-violet-300' : 'bg-indigo-600/25 text-indigo-300'}">${typeLabel}</span>
          ${statusLabel}
        </div>
        ${isContinuation && i.source_dream_title ? `<p class="text-xs text-gray-400 mb-3"><i class="fas fa-link mr-1 text-dream-400"></i>Rêve source : <strong class="text-dream-200">${escapeHtml(i.source_dream_title)}</strong></p>` : ''}
        ${i.description ? `<div class="glass rounded-xl p-3 mb-3"><p class="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">${escapeHtml(i.description)}</p></div>` : '<p class="text-xs text-gray-500 italic mb-3">Aucune description</p>'}
        ${i.realized_dream_title ? `<p class="text-xs text-emerald-400/70 mb-3"><i class="fas fa-check mr-1"></i>Réalisée dans : ${escapeHtml(i.realized_dream_title)}</p>` : ''}
        <p class="text-[10px] text-gray-500 mb-4"><i class="far fa-calendar mr-1"></i>${dateStr}</p>
        <div class="flex gap-2 flex-wrap">
          <button onclick="closeModal()" class="flex-1 py-2 bg-night-800/40 text-gray-300 rounded-lg hover:bg-night-800/60 transition-all text-xs font-medium">Fermer</button>
          ${i.status === 'active' ? `<button onclick="closeModal(); openIntentionEditor(${i.id})" class="flex-1 py-2 bg-dream-600/30 text-dream-300 rounded-lg hover:bg-dream-600/50 transition-all text-xs font-medium"><i class="fas fa-edit mr-1"></i>Modifier</button>` : ''}
          ${i.status === 'active' ? `<button onclick="closeModal(); openRealizeIntention(${i.id})" class="flex-1 py-2 bg-emerald-600/30 text-emerald-300 rounded-lg hover:bg-emerald-600/50 transition-all text-xs font-medium"><i class="fas fa-check-circle mr-1"></i>Réaliser</button>` : ''}
          ${isContinuation && i.source_dream_id ? `<button onclick="closeModal(); openDreamDetail(${i.source_dream_id})" class="flex-1 py-2 bg-indigo-600/20 text-indigo-300 rounded-lg hover:bg-indigo-600/30 transition-all text-xs font-medium"><i class="fas fa-book-open mr-1"></i>Voir le rêve</button>` : ''}
          ${i.status === 'realized' && i.realized_dream_id ? `<button onclick="closeModal(); openDreamDetail(${i.realized_dream_id})" class="flex-1 py-2 bg-emerald-600/20 text-emerald-300 rounded-lg hover:bg-emerald-600/30 transition-all text-xs font-medium"><i class="fas fa-book-open mr-1"></i>Voir le rêve réalisé</button>` : ''}
        </div>
      </div>
    `, '500px');
  })();
};

window.reactivateIntention = async function(id) {
  try { await api(`/intentions/${id}/unrealize`, { method: 'PUT' }); showToast('Intention réactivée'); renderIntentions(); } catch (err) { alert(err.message); }
};

window.unrealizeIntention = async function(id) {
  try { await api(`/intentions/${id}/unrealize`, { method: 'PUT' }); showToast('Intention réactivée'); renderIntentions(); } catch (err) { alert(err.message); }
};

window.openRealizeIntention = async function(intentionId) {
  // Charger les intentions pour afficher le titre
  let intentions = [], dreams = [];
  try { intentions = (await api('/intentions')).intentions; } catch { return; }
  try { const data = await api('/dreams?limit=200'); dreams = data.dreams; } catch {}
  const intention = intentions.find(i => i.id === intentionId);
  if (!intention) return;

  showModal(`
    <div class="p-4 sm:p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-display font-semibold text-dream-100">
          <i class="fas fa-check-circle mr-2 text-emerald-400"></i>Réaliser l'intention
        </h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white p-1"><i class="fas fa-times"></i></button>
      </div>
      <div class="glass rounded-lg p-3 mb-4">
        <p class="text-xs text-gray-400 mb-0.5">Intention :</p>
        <p class="text-sm font-medium text-dream-200">${intention.type === 'dream_continuation' ? '\ud83c\udf19' : '\u2728'} ${escapeHtml(intention.title)}</p>
        ${intention.description ? `<p class="text-xs text-gray-400 mt-1 line-clamp-2">${escapeHtml(intention.description)}</p>` : ''}
      </div>
      <p class="text-xs text-gray-400 mb-2">Quel r\u00eave r\u00e9alise cette intention ?</p>
      ${dreams.length > 0 ? `
        <select id="realize-dream-select" class="w-full px-3 py-2.5 bg-night-900/60 border border-emerald-700/30 rounded-lg text-white text-xs focus:border-emerald-400 focus:outline-none mb-4">
          <option value="">S\u00e9lectionner un r\u00eave...</option>
          ${dreams.map(d => `<option value="${d.id}">${escapeHtml(d.title)} (${new Date(d.dream_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })})</option>`).join('')}
        </select>
        <button onclick="confirmRealizeIntention(${intentionId})" class="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg font-semibold text-sm hover:from-emerald-500 hover:to-emerald-400 transition-all">
          <i class="fas fa-check mr-2"></i>Marquer comme r\u00e9alis\u00e9e
        </button>
      ` : '<p class="text-sm text-gray-400 italic text-center py-4">Aucun r\u00eave dans le journal. Cr\u00e9e d\'abord un r\u00eave !</p>'}
    </div>
  `, '500px');
};

window.confirmRealizeIntention = async function(intentionId) {
  const select = document.getElementById('realize-dream-select');
  const dreamId = select ? parseInt(select.value) : null;
  if (!dreamId) { showToast('S\u00e9lectionne un r\u00eave'); return; }
  try {
    await api(`/intentions/${intentionId}/realize`, { method: 'PUT', body: JSON.stringify({ realizedDreamId: dreamId }) });
    closeModal();
    showToast('\u2705 Intention marqu\u00e9e comme r\u00e9alis\u00e9e !');
    renderIntentions();
  } catch (err) { alert(err.message); }
};

window.deleteIntention = async function(id) {
  if (!confirm('Supprimer cette intention ?')) return;
  try { await api(`/intentions/${id}`, { method: 'DELETE' }); showToast('Intention supprimée'); renderIntentions(); } catch (err) { alert(err.message); }
};

// Créer une intention de suite depuis un rêve existant
window.createContinuationIntention = async function(dreamId, dreamTitle) {
  showModal(`
    <div class="p-4 sm:p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-display font-semibold text-dream-100">
          <i class="fas fa-moon mr-2 text-violet-400"></i>Intention de suite
        </h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white p-1"><i class="fas fa-times"></i></button>
      </div>
      <p class="text-xs text-gray-400 mb-3">Suite pour : <strong class="text-dream-200">${escapeHtml(dreamTitle)}</strong></p>
      <form onsubmit="saveContinuationIntention(event, ${dreamId})">
        <div class="mb-3">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Titre de la suite souhaitée</label>
          <input type="text" name="title" required placeholder="Ex: Retrouver le personnage mystérieux..."
            class="w-full px-3 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-xs placeholder-gray-500 focus:border-dream-400 focus:outline-none">
        </div>
        <div class="mb-4">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Description</label>
          <textarea name="description" rows="4" placeholder="Décrivez la suite que vous imaginez..."
            class="w-full px-3 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-xs placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none"></textarea>
        </div>
        <button type="submit" class="w-full py-2.5 bg-gradient-to-r from-violet-500 to-dream-600 text-white rounded-lg font-semibold text-sm">
          <i class="fas fa-save mr-2"></i>Créer l'intention de suite
        </button>
      </form>
    </div>
  `, '500px');
};

window.saveContinuationIntention = async function(e, dreamId) {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await api('/intentions', { method: 'POST', body: JSON.stringify({
      type: 'dream_continuation', sourceDreamId: dreamId,
      title: form.get('title'), description: form.get('description') || null
    })});
    closeModal(); showToast('💭 Intention de suite créée !');
    // Refresh current view to reflect the new intention
    if (state.currentView === 'dream-detail') renderDreamDetailPage(state.dreamDetailId);
  } catch (err) { alert(err.message); }
};

// ========== DASHBOARD "RÊVE MIEUX" ==========
let dashboardPeriod = 'week'; // 'week', 'month', 'year'
let _dashboardCharts = []; // keep references to destroy before re-render

function _destroyDashboardCharts() {
  _dashboardCharts.forEach(c => { try { c.destroy(); } catch {} });
  _dashboardCharts = [];
}

function _createLineChart(canvasId, labels, datasets, yTitle) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: datasets.length > 1, labels: { color: '#9ca3af', font: { size: 10 }, boxWidth: 12, padding: 8 } },
        tooltip: {
          backgroundColor: 'rgba(15,10,40,0.95)', titleColor: '#c4b5fd', bodyColor: '#d1d5db',
          borderColor: 'rgba(139,92,246,0.3)', borderWidth: 1, padding: 8,
          titleFont: { size: 11 }, bodyFont: { size: 11 }, cornerRadius: 8
        }
      },
      scales: {
        x: { grid: { color: 'rgba(139,92,246,0.08)' }, ticks: { color: '#6b7280', font: { size: 9 }, maxRotation: 0 } },
        y: { beginAtZero: true, grid: { color: 'rgba(139,92,246,0.08)' }, ticks: { color: '#6b7280', font: { size: 9 }, stepSize: 1 },
          title: yTitle ? { display: true, text: yTitle, color: '#6b7280', font: { size: 9 } } : undefined }
      },
      elements: { line: { tension: 0.4, borderWidth: 2 }, point: { radius: 3, hoverRadius: 6 } }
    }
  });
  _dashboardCharts.push(chart);
}

function _createRadarChart(canvasId, labels, dataValues) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const chart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Occurrences',
        data: dataValues,
        backgroundColor: 'rgba(139,92,246,0.15)',
        borderColor: 'rgba(139,92,246,0.6)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(139,92,246,0.8)',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,10,40,0.95)', titleColor: '#c4b5fd', bodyColor: '#d1d5db',
          borderColor: 'rgba(139,92,246,0.3)', borderWidth: 1, padding: 8,
          titleFont: { size: 11 }, bodyFont: { size: 11 }, cornerRadius: 8
        }
      },
      scales: {
        r: {
          beginAtZero: true,
          grid: { color: 'rgba(139,92,246,0.12)' },
          angleLines: { color: 'rgba(139,92,246,0.12)' },
          pointLabels: { color: '#d1d5db', font: { size: 9 } },
          ticks: { display: false, stepSize: 1 }
        }
      }
    }
  });
  _dashboardCharts.push(chart);
}

async function renderDashboard() {
  _destroyDashboardCharts();
  const main = document.getElementById('main-content');
  try {
    const data = await api(`/stats/dashboard?period=${dashboardPeriod}`);
    const o = data.overview;
    const rc = data.realityChecks;
    const int = data.intentions;
    const periodLabel = dashboardPeriod === 'week' ? 'cette semaine' : dashboardPeriod === 'year' ? 'cette ann\u00e9e' : 'ce mois';
    const periodLabelShort = dashboardPeriod === 'week' ? '7j' : dashboardPeriod === 'year' ? '365j' : '30j';

    // Formater les labels de timeline
    function fmtLabel(label, type) {
      if (type === 'day') { const d = new Date(label + 'T00:00:00'); return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }); }
      if (type === 'week') { return 'S' + label.split('-W')[1]; }
      if (type === 'month') { const m = ['Jan','F\u00e9v','Mar','Avr','Mai','Juin','Juil','Ao\u00fbt','Sep','Oct','Nov','D\u00e9c']; return m[parseInt(label.split('-')[1]) - 1]; }
      return label;
    }

    const tlData = data.timeline.data || [];
    const tlLabels = tlData.map(d => fmtLabel(d.label, data.timeline.label));
    const rcTlData = rc.timeline || [];
    const rcLabels = rcTlData.map(d => fmtLabel(d.label, data.timeline.label));

    // Emotions
    const emotionEmojis = { joy: '\ud83d\ude0a', fear: '\ud83d\ude28', anxiety: '\ud83d\ude30', wonder: '\ud83e\udd29', sadness: '\ud83d\ude22', anger: '\ud83d\ude21', confusion: '\ud83d\ude35', peace: '\ud83d\ude0c', excitement: '\ud83e\udd2f', love: '\ud83d\udc97', nostalgia: '\ud83e\udd7a' };
    const emotionLabels = { joy: 'Joie', fear: 'Peur', anxiety: 'Anxi\u00e9t\u00e9', wonder: '\u00c9merveillement', sadness: 'Tristesse', anger: 'Col\u00e8re', confusion: 'Confusion', peace: 'Paix', excitement: 'Excitation', love: 'Amour', nostalgia: 'Nostalgie' };
    const emotionsHTML = (data.emotions || []).map(em => {
      const maxEm = data.emotions[0]?.count || 1;
      const pct = Math.round((em.count / maxEm) * 100);
      return `<div class="flex items-center gap-2 py-1.5 border-b border-dream-700/10 last:border-0">
        <span class="text-base shrink-0">${emotionEmojis[em.emotion] || ''}</span>
        <span class="text-xs text-gray-200 w-24 sm:w-28 truncate">${emotionLabels[em.emotion] || em.emotion}</span>
        <div class="flex-1 h-2.5 bg-night-900/40 rounded-full overflow-hidden">
          <div class="h-full rounded-full" style="width:${pct}%;background:linear-gradient(90deg,rgba(139,92,246,0.5),rgba(56,189,248,0.5));"></div>
        </div>
        <span class="text-[10px] font-semibold text-dream-300 w-6 text-right">${em.count}x</span>
        <span class="text-[10px] text-gray-400 w-12 text-right">\u2300 ${em.avg_intensity}/5</span>
      </div>`;
    }).join('') || '<p class="text-xs text-gray-500 italic text-center py-3">Pas encore d\'\u00e9motions enregistr\u00e9es</p>';

    // Tags radar : top 10 toutes categories confondues
    const allTags = [];
    const catOrder = ['person', 'place', 'theme', 'symbol', 'custom'];
    for (const cat of catOrder) {
      const tags = data.tagCategories[cat];
      if (tags) tags.forEach(t => allTags.push(t));
    }
    allTags.sort((a, b) => b.count - a.count);
    const radarTags = allTags.slice(0, 10);

    // Intentions
    const intActive = int.active || 0;
    const intRealized = int.realized || 0;
    const intTotal = intActive + intRealized;
    const intRealizedPct = intTotal > 0 ? Math.round((intRealized / intTotal) * 100) : 0;

    main.innerHTML = `
    <div class="animate-slideUp">
      <!-- ===== HERO TITRE ===== -->
      <div class="relative rounded-2xl p-5 mb-5 overflow-hidden" style="background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(56,189,248,0.10), rgba(139,92,246,0.08));">
        <div class="absolute inset-0 opacity-20" style="background: radial-gradient(circle at 20% 50%, rgba(139,92,246,0.4), transparent 60%), radial-gradient(circle at 80% 30%, rgba(56,189,248,0.3), transparent 50%);"></div>
        <div class="relative text-center">
          <div class="text-3xl mb-2">\ud83c\udf19</div>
          <h2 class="text-xl font-display font-bold text-white mb-1">R\u00eave Mieux</h2>
          <p class="text-xs text-gray-400">Ton tableau de bord onirique</p>
        </div>
      </div>

      <!-- ===== S\u00c9LECTEUR DE P\u00c9RIODE ===== -->
      <div class="flex justify-center gap-2 mb-5">
        <button onclick="dashboardPeriod='week';renderDashboard()" class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dashboardPeriod === 'week' ? 'bg-dream-600 text-white' : 'glass text-gray-400 hover:text-white'}">Semaine</button>
        <button onclick="dashboardPeriod='month';renderDashboard()" class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dashboardPeriod === 'month' ? 'bg-dream-600 text-white' : 'glass text-gray-400 hover:text-white'}">Mois</button>
        <button onclick="dashboardPeriod='year';renderDashboard()" class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dashboardPeriod === 'year' ? 'bg-dream-600 text-white' : 'glass text-gray-400 hover:text-white'}">Ann\u00e9e</button>
      </div>

      <!-- ===== RANG\u00c9E 1 : 3 COMPTEURS PRINCIPAUX ===== -->
      <div class="grid grid-cols-3 gap-3 mb-3">
        <div class="glass rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-white">${o.totalPeriod}</div>
          <div class="text-[10px] text-gray-400">R\u00eaves ${periodLabelShort}</div>
          <div class="text-[9px] text-gray-500 mt-0.5">${o.totalAllTime} au total</div>
        </div>
        <div class="glass rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-amber-400">${o.streak}</div>
          <div class="text-[10px] text-gray-400">Jours de suite</div>
          <div class="text-[9px] text-gray-500 mt-0.5">journalisation</div>
        </div>
        <div class="glass rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-emerald-400">${rc.today}</div>
          <div class="text-[10px] text-gray-400">RC aujourd'hui</div>
          <div class="text-[9px] text-gray-500 mt-0.5">${rc.totalAllTime} au total</div>
        </div>
      </div>

      <!-- ===== RANG\u00c9E 2 : S\u00c9RIES / LUCIDIT\u00c9 / CLART\u00c9 ===== -->
      <div class="grid grid-cols-3 gap-3 mb-3">
        <div class="glass rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-violet-400">${o.seriesCount}</div>
          <div class="text-[10px] text-gray-400">S\u00e9ries</div>
          <div class="text-[9px] text-gray-500 mt-0.5">de r\u00eaves</div>
        </div>
        <div class="glass rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-dream-300">${o.avgLucidity || '-'}<span class="text-xs text-gray-500">/5</span></div>
          <div class="text-[10px] text-gray-400">Lucidit\u00e9 moy.</div>
          <div class="text-[9px] text-gray-500 mt-0.5">${o.lucidRate}% lucides</div>
        </div>
        <div class="glass rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-sky-300">${o.avgClarity || '-'}<span class="text-xs text-gray-500">/5</span></div>
          <div class="text-[10px] text-gray-400">Clart\u00e9 moy.</div>
          <div class="text-[9px] text-gray-500 mt-0.5">nettet\u00e9 du souvenir</div>
        </div>
      </div>

      <!-- ===== RANG\u00c9E 3 : 4 TYPES SANS IC\u00d4NES ===== -->
      <div class="grid grid-cols-4 gap-2 mb-3">
        <div class="glass rounded-xl py-2 px-1 text-center">
          <div class="text-lg font-bold text-dream-300">${o.lucidPeriod}</div>
          <div class="text-[9px] text-gray-400">Lucides</div>
        </div>
        <div class="glass rounded-xl py-2 px-1 text-center">
          <div class="text-lg font-bold text-sky-400">${o.normalPeriod}</div>
          <div class="text-[9px] text-gray-400">Normaux</div>
        </div>
        <div class="glass rounded-xl py-2 px-1 text-center">
          <div class="text-lg font-bold text-rose-400">${o.nightmaresPeriod}</div>
          <div class="text-[9px] text-gray-400">Cauchemars</div>
        </div>
        <div class="glass rounded-xl py-2 px-1 text-center">
          <div class="text-lg font-bold text-cyan-400">${o.recurringPeriod}</div>
          <div class="text-[9px] text-gray-400">R\u00e9currents</div>
        </div>
      </div>

      <!-- ===== RANG\u00c9E 4 : INTENTIONS ===== -->
      <div class="glass rounded-xl p-3 mb-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="text-center">
              <div class="text-lg font-bold text-yellow-400">${intActive}</div>
              <div class="text-[9px] text-gray-400">Intentions actives</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-emerald-400">${intRealized}</div>
              <div class="text-[9px] text-gray-400">R\u00e9alis\u00e9es</div>
            </div>
          </div>
          ${intTotal > 0 ? `<div class="flex items-center gap-2">
            <div class="w-20 h-2 bg-night-900/40 rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" style="width:${intRealizedPct}%"></div>
            </div>
            <span class="text-[10px] font-semibold text-emerald-400">${intRealizedPct}%</span>
          </div>` : ''}
        </div>
      </div>

      <!-- ===== GRAPHIQUE : \u00c9VOLUTION DES R\u00caVES ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <h3 class="text-sm font-display font-bold text-dream-100 mb-3"><i class="fas fa-chart-line mr-1.5 text-dream-400"></i>\u00c9volution des r\u00eaves</h3>
        <div style="height:200px;"><canvas id="chart-dreams"></canvas></div>
      </div>

      <!-- ===== GRAPHIQUE : REALITY CHECKS ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <h3 class="text-sm font-display font-bold text-dream-100 mb-3"><i class="fas fa-chart-line mr-1.5 text-emerald-400"></i>Contr\u00f4les de r\u00e9alit\u00e9</h3>
        <div class="flex items-center gap-4 mb-3">
          <span class="text-[10px] text-gray-400"><strong class="text-emerald-400 text-sm">${rc.totalPeriod}</strong> sur la p\u00e9riode</span>
          <span class="text-[10px] text-gray-400"><strong class="text-emerald-300 text-sm">${rc.today}</strong> aujourd'hui</span>
        </div>
        <div style="height:140px;"><canvas id="chart-rc"></canvas></div>
      </div>

      <!-- ===== GRAPHIQUE RADAR : \u00c9L\u00c9MENTS R\u00c9CURRENTS ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <h3 class="text-sm font-display font-bold text-dream-100 mb-3"><i class="fas fa-spider mr-1.5 text-amber-400"></i>\u00c9l\u00e9ments r\u00e9currents</h3>
        ${radarTags.length >= 3 ? `<div style="height:260px;"><canvas id="chart-radar"></canvas></div>` : radarTags.length > 0 ? `<div class="flex flex-wrap gap-1.5 py-2">${radarTags.map(t => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style="background:${t.color}20;color:${t.color};border:1px solid ${t.color}30;">${escapeHtml(t.name)} <span class="opacity-60">x${t.count}</span></span>`).join('')}</div>` : '<p class="text-xs text-gray-500 italic text-center py-3">Pas assez de tags sur cette p\u00e9riode</p>'}
      </div>

      <!-- ===== \u00c9MOTIONS ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <h3 class="text-sm font-display font-bold text-dream-100 mb-3"><i class="fas fa-heart mr-1.5 text-rose-400"></i>\u00c9motions ressenties</h3>
        <div>${emotionsHTML}</div>
      </div>

      <!-- ===== BOUTONS NIVEAUX ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <h3 class="text-sm font-display font-bold text-dream-100 mb-3 text-center"><i class="fas fa-graduation-cap mr-1.5 text-dream-400"></i>Techniques et apprentissage</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onclick="navigate('lucidity-level1')" class="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95" style="background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border:1px solid rgba(139,92,246,0.2);">
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" style="background:rgba(139,92,246,0.2);">\ud83d\udc41\ufe0f</div>
            <div class="text-left">
              <div class="text-xs font-semibold text-dream-200">Niveau 1</div>
              <div class="text-[10px] text-gray-400">D\u00e9clenche des r\u00eaves lucides</div>
            </div>
            <i class="fas fa-chevron-right text-xs text-gray-500 ml-auto"></i>
          </button>
          <button onclick="navigate('lucidity-level2')" class="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95" style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.2);">
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" style="background:rgba(245,158,11,0.2);">\ud83e\uddea</div>
            <div class="text-left">
              <div class="text-xs font-semibold text-amber-200">Niveau 2</div>
              <div class="text-[10px] text-gray-400">Optimise ton sommeil paradoxal</div>
            </div>
            <i class="fas fa-chevron-right text-xs text-gray-500 ml-auto"></i>
          </button>
        </div>
      </div>
    </div>`;

    // --- Render Chart.js graphs after DOM is ready ---
    setTimeout(() => {
      // Graphique evolution des reves : 5 courbes
      if (tlData.length > 0) {
        _createLineChart('chart-dreams', tlLabels, [
          { label: 'Total', data: tlData.map(d => d.total), borderColor: 'rgba(139,92,246,0.8)', backgroundColor: 'rgba(139,92,246,0.08)', fill: true },
          { label: 'Lucides', data: tlData.map(d => d.lucid), borderColor: 'rgba(56,189,248,0.8)', backgroundColor: 'rgba(56,189,248,0.05)', fill: false },
          { label: 'Normaux', data: tlData.map(d => d.normal || 0), borderColor: 'rgba(148,163,184,0.7)', backgroundColor: 'transparent', fill: false },
          { label: 'Cauchemars', data: tlData.map(d => d.nightmare || 0), borderColor: 'rgba(244,63,94,0.7)', backgroundColor: 'transparent', fill: false },
          { label: 'R\u00e9currents', data: tlData.map(d => d.recurring || 0), borderColor: 'rgba(34,211,238,0.7)', backgroundColor: 'transparent', fill: false }
        ]);
      }
      // Graphique RC
      if (rcTlData.length > 0) {
        _createLineChart('chart-rc', rcLabels, [
          { label: 'Reality checks', data: rcTlData.map(d => d.count), borderColor: 'rgba(16,185,129,0.8)', backgroundColor: 'rgba(16,185,129,0.1)', fill: true }
        ]);
      }
      // Graphique Radar : elements recurrents
      if (radarTags.length >= 3) {
        _createRadarChart('chart-radar', radarTags.map(t => t.name), radarTags.map(t => t.count));
      }
    }, 50);

  } catch (err) {
    main.innerHTML = `<div class="text-center py-12 text-red-400"><i class="fas fa-exclamation-triangle mr-2"></i>${err.message}</div>`;
  }
}

// ========== LUCIDITY VIEW (NIVEAU 1) ==========
async function renderLucidity() {
  const main = document.getElementById('main-content');
  let rcStats = { total: 0, today: 0 }; try { rcStats = await api('/reality-checks/stats'); } catch {}
  main.innerHTML = `
    <div class="animate-slideUp">
      <!-- Bouton retour -->
      <button onclick="navigate('lucidity')" class="flex items-center gap-2 text-sm text-gray-400 hover:text-dream-300 transition-colors mb-4">
        <i class="fas fa-arrow-left"></i> Retour au tableau de bord
      </button>

      <!-- ===== HERO TITRE ===== -->
      <div class="relative rounded-2xl p-5 mb-6 overflow-hidden" style="background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(56,189,248,0.10), rgba(139,92,246,0.08));">
        <div class="absolute inset-0 opacity-20" style="background: radial-gradient(circle at 20% 50%, rgba(139,92,246,0.4), transparent 60%), radial-gradient(circle at 80% 30%, rgba(56,189,248,0.3), transparent 50%);"></div>
        <div class="relative text-center">
          <div class="text-3xl mb-2">👁️</div>
          <p class="text-sm font-display font-semibold text-dream-300 mb-1">Niveau 1</p>
          <h2 class="text-xl font-display font-bold text-white mb-1.5">Déclenche des rêves lucides</h2>
          <p class="text-xs text-gray-400 leading-relaxed max-w-md mx-auto">Contrôles de réalité, ancrage musical avec le refrain « Rêve Mieux », TLR nocturne (alarmes pendant le sommeil paradoxal), techniques d'induction WBTB, MILD et SSILD, incubation de rêves et journal onirique.</p>
        </div>
      </div>

      <!-- ===== CONTRÔLES DE RÉALITÉ ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <h3 class="text-lg font-display font-bold text-dream-100 mb-2 text-center">Contrôle de Réalité</h3>
        <p class="text-xs text-gray-400 mb-4 text-center">Fais un test maintenant. En rêve, ces actions produisent des résultats anormaux.</p>
        <div class="flex gap-2 justify-center flex-wrap mb-4">
          <button onclick="doRealityCheck('hands')" class="px-3 py-2 glass rounded-xl text-xs hover:border-dream-400/40 transition-all">✋ Compter ses doigts</button>
          <button onclick="doRealityCheck('text')" class="px-3 py-2 glass rounded-xl text-xs hover:border-dream-400/40 transition-all">📖 Lire un texte</button>
          <button onclick="doRealityCheck('time')" class="px-3 py-2 glass rounded-xl text-xs hover:border-dream-400/40 transition-all">⏰ Regarder l'heure</button>
        </div>
        <div class="flex items-center justify-center gap-4 text-xs mb-5">
          <span class="text-dream-300"><strong>${rcStats.today}</strong> aujourd'hui</span>
          <span class="text-gray-400"><strong>${rcStats.total}</strong> au total</span>
        </div>

        <!-- ===== LECTEUR AUDIO ===== -->
        <div class="p-4 rounded-xl border border-amber-500/25 mb-4" style="background: linear-gradient(135deg, rgba(245,158,11,0.06), rgba(139,92,246,0.06));">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xl">🎵</span>
            <h4 class="font-semibold text-amber-200 text-sm">Ancrage Musical : « Rêve Mieux » par Orelsan</h4>
          </div>
          <p class="text-xs text-gray-400 mb-2">Lance le refrain pendant chaque contrôle de réalité pour créer l'association musique / questionnement.</p>
          <div class="flex items-center gap-3 p-3 rounded-lg bg-night-900/50 border border-amber-500/15" id="music-player-container">
            <button onclick="toggleReveMieuxPlayer()" id="reve-mieux-play-btn"
              class="w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all shrink-0 border border-amber-500/40 bg-amber-600/20 text-amber-300 hover:bg-amber-600/40 hover:scale-105 active:scale-95">
              <i class="fas fa-play" id="reve-mieux-play-icon"></i>
            </button>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-amber-200 truncate">Rêve Mieux · Orelsan</p>
              <p class="text-[10px] text-gray-400">Refrain · Lecture unique</p>
              <div class="mt-1.5 w-full bg-night-900/60 rounded-full h-1 overflow-hidden">
                <div id="reve-mieux-progress" class="h-full bg-gradient-to-r from-amber-500 to-dream-400 rounded-full transition-all" style="width: 0%"></div>
              </div>
            </div>
            <span id="reve-mieux-time" class="text-[10px] text-gray-500 font-mono shrink-0">0:00</span>
          </div>
        </div>

        <!-- ===== EXPLICATIONS DES REALITY CHECKS ===== -->
        <div class="space-y-2 mb-4">
          <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-dream-500/40">
            <p class="text-xs font-semibold text-dream-200 mb-1">✋ Compter ses doigts</p>
            <p class="text-xs text-gray-400"><strong>Quoi faire :</strong> Regarde attentivement tes mains et compte tes doigts un par un, en te demandant sincèrement si tu rêves.</p>
            <p class="text-xs text-gray-400 mt-1"><strong>Pourquoi :</strong> En rêve, le cortex visuel primaire fonctionne de façon altérée (Hobson, 2009). Le cerveau peine à maintenir une représentation stable des détails : tes doigts peuvent apparaître en nombre incorrect, déformés ou flous. La répétition quotidienne crée un réflexe qui se déclenche aussi en rêve (Tholey, 1983).</p>
          </div>
          <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-dream-500/40">
            <p class="text-xs font-semibold text-dream-200 mb-1">📖 Lire un texte</p>
            <p class="text-xs text-gray-400"><strong>Quoi faire :</strong> Lis un texte (panneau, écran, livre), détourne le regard, puis relis-le. Demande-toi : le texte est-il resté identique ?</p>
            <p class="text-xs text-gray-400 mt-1"><strong>Pourquoi :</strong> Les travaux de Stephen LaBerge à Stanford ont montré que les représentations du langage écrit sont instables pendant le sommeil paradoxal, probablement parce que le cerveau endormi reconstruit le texte sans input sensoriel externe. Le texte se transforme, se brouille ou change de contenu entre deux lectures. C'est l'un des indicateurs de rêve les plus fiables : dans une étude de LaBerge et al. (1996), le texte a changé dans 75% des cas dès la première relecture et 95% à la seconde.</p>
          </div>
          <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-dream-500/40">
            <p class="text-xs font-semibold text-dream-200 mb-1">⏰ Regarder l'heure</p>
            <p class="text-xs text-gray-400"><strong>Quoi faire :</strong> Regarde une horloge ou une montre, détourne le regard, puis regarde à nouveau. L'heure est-elle cohérente ?</p>
            <p class="text-xs text-gray-400 mt-1"><strong>Pourquoi :</strong> Comme pour le texte, les représentations numériques sont instables en rêve. Le cortex préfrontal, qui gère la logique temporelle et séquentielle, est partiellement désactivé pendant le sommeil REM (Hobson et al., 2000). Les chiffres se transforment ou n'ont aucun sens.</p>
          </div>
        </div>

        <!-- ===== EXPLICATION ANCRAGE MUSICAL ===== -->
        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-amber-500/40 mb-2">
          <p class="text-xs font-semibold text-amber-200 mb-1">🎵 Ancrage Musical : le conditionnement sonore</p>
          <p class="text-xs text-gray-400 leading-relaxed"><strong>Le principe :</strong> Écoute le refrain « Rêve Mieux » à chaque contrôle de réalité. L'objectif est de créer un conditionnement associatif entre la musique et le questionnement « suis-je en train de rêver ? ». Avec la répétition, ton cerveau associe les deux de manière automatique.</p>
          <p class="text-xs text-gray-400 leading-relaxed mt-3"><strong>Pourquoi ça fonctionne :</strong> Ce mécanisme repose sur le conditionnement classique (Pavlov, 1927) et l'apprentissage associatif. À force de coupler un stimulus (la musique) avec un comportement (le questionnement de la réalité), le stimulus finit par déclencher le comportement seul, y compris en rêve. Konkoly et al. (2021, <em>Current Biology</em>) ont démontré que des stimuli sensoriels externes (sons, lumières) peuvent être intégrés dans les rêves pendant le sommeil paradoxal.</p>
          <p class="text-xs text-gray-400 leading-relaxed mt-3"><strong>L'effet dans les rêves :</strong> La mémoire musicale dépend de l'hippocampe et du cortex auditif, deux structures actives pendant le REM (Stickgold, 2005, <em>Nature</em>). L'effet earworm (Williamson et al., 2012) montre que les fragments musicaux répétés s'inscrivent involontairement dans la boucle phonologique de la mémoire de travail. Un refrain écouté en boucle pendant tes reality checks a de fortes chances de se « rejouer » spontanément dans tes rêves, et comme ton cerveau a associé ce refrain au questionnement de la réalité, il peut déclencher un moment de lucidité automatique.</p>
          <p class="text-xs text-gray-400 leading-relaxed mt-3"><strong>Le réflexe earworm :</strong> En écoutant régulièrement le refrain « Rêve Mieux », tu vas naturellement l'avoir en tête à des moments aléatoires de ta journée. C'est l'effet earworm qui travaille pour toi. À chaque fois que le refrain te revient en tête, fais immédiatement un contrôle de réalité : compte tes doigts, lis un texte, vérifie l'heure. Et surtout, lance le refrain avec le lecteur ci-dessus (ou sur ton téléphone) pendant que tu fais ton test. Cela renforce encore l'association musique/questionnement, ce qui alimente l'earworm en retour : plus tu écoutes le refrain, plus il te revient en tête spontanément, et plus il te revient en tête, plus tu fais de contrôles de réalité. C'est une boucle qui s'auto-amplifie : chaque itération renforce la suivante, et le nombre de reality checks augmente naturellement avec le temps.</p>
          <p class="text-xs text-gray-400 leading-relaxed mt-3"><strong>Le bénéfice nocturne :</strong> Cette boucle d'auto-renforcement prend toute sa dimension la nuit grâce au TLR Nocturne (voir ci-dessous). En programmant une alarme avec le refrain à volume ultra-faible pendant le sommeil paradoxal, ton cerveau endormi capte le son sans que tu te réveilles. Et comme le lien « refrain = suis-je en train de rêver ? » a été renforcé en journée par des dizaines de reality checks et d'earworms spontanés, le refrain nocturne a d'autant plus de chances de déclencher un flash de lucidité dans ton rêve. Plus la boucle diurne est forte, plus le déclencheur nocturne est efficace. L'étude de Northwestern (Konkoly et al., 2024) a validé cette approche.</p>
          <p class="text-[11px] text-gray-500 italic mt-3">Sources : Pavlov (1927) · Konkoly et al. (2021, Current Biology ; 2024, Consciousness and Cognition) · Williamson et al. (2012, Psychology of Music) · Stickgold (2005, Nature)</p>
        </div>
      </div>

      <!-- ===== TECHNIQUES D'INDUCTION ===== -->
      <h3 class="text-sm font-display font-semibold text-dream-200 mb-3"><i class="fas fa-tools mr-2"></i>Techniques d'Induction</h3>
      <div class="space-y-3 mb-5">

        <!-- WBTB (technique principale, intègre MILD et SSILD comme variantes) -->
        <div class="glass rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2"><span class="text-xl">⏰</span><h4 class="font-semibold text-dream-200 text-sm">WBTB (Wake Back To Bed) : la technique principale</h4></div>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">Le WBTB est <strong class="text-dream-300">la technique d'induction la plus puissante</strong> connue à ce jour. Le principe : les phases REM deviennent plus longues et intenses en fin de nuit (30 à 60 min, contre 10 min en début de nuit). En te réveillant après 5 à 6 heures, tu interromps ton sommeil juste avant ces pics REM. La période d'éveil qui suit augmente l'activité du cortex préfrontal dorsolatéral (responsable de la conscience de soi), ce qui se maintient partiellement au retour au sommeil. Résultat : ta conscience critique est bien plus élevée quand tu replonges dans les rêves. Stumbrys et al. (2012) ont identifié le WBTB comme la méthode la plus prometteuse dans leur revue systématique de 35 études. Aspy et al. (2017) : 46% de réussite chez les participants qui se rendorment en moins de 5 minutes après la technique MILD. Erlacher & Stumbrys (2020) : environ 50% des participants ont eu un rêve lucide en une seule nuit de labo via WBTB + MILD, y compris des personnes n'ayant jamais eu de rêve lucide avant.</p>
          <div class="p-3 rounded-lg bg-emerald-900/15 border border-emerald-500/20 mb-3">
            <p class="text-[11px] font-semibold text-emerald-200 mb-1">🎵 Lien avec le TLR Nocturne (voir ci-dessous)</p>
            <p class="text-[11px] text-gray-300 leading-relaxed">Si le refrain « Rêve Mieux » programmé via ton alarme te réveille au lieu de s'intégrer dans ton rêve, <strong class="text-emerald-300">tu es exactement dans un scénario WBTB idéal</strong>. Tu es éveillé en plein pic de sommeil paradoxal, ton cortex préfrontal se réactive, et tu peux appliquer les variantes ci-dessous pour te rendormir avec une conscience accrue. C'est la Stratégie B du TLR Nocturne.</p>
          </div>
          <p class="text-[11px] font-semibold text-dream-200 mb-1.5">Protocole de base :</p>
          <ol class="text-[11px] text-gray-300 space-y-1.5 mb-3">
            <li><strong class="text-dream-300">1. Réveil à 5-6h après l'endormissement.</strong> C'est le moment optimal, juste avant le pic REM. (La Stratégie B du TLR Nocturne utilise ce principe.)</li>
            <li><strong class="text-dream-300">2. Lève-toi physiquement</strong> (toilettes, verre d'eau) pour activer ton cortex préfrontal. 20 à 60 min d'éveil.</li>
            <li><strong class="text-dream-300">3. Pendant l'éveil :</strong> ne touche surtout pas ton téléphone. Repense mentalement à tes rêves récents, formule ton intention de devenir lucide et visualise-toi en train de reconnaître un rêve. Reste dans un état calme, sans écran ni lumière vive.</li>
            <li><strong class="text-dream-300">4. Au recoucher, choisis une variante</strong> parmi les deux ci-dessous selon ta préférence.</li>
          </ol>

          <div class="mt-3 space-y-3">
            <div class="p-3 rounded-lg bg-dream-900/20 border border-dream-500/20">
              <p class="text-xs font-semibold text-dream-200 mb-1.5">🧠 Variante MILD (Mnemonic Induction)</p>
              <p class="text-[11px] text-gray-300 leading-relaxed mb-2">Développée par Stephen LaBerge (Stanford, 1980), la MILD repose sur la <strong class="text-dream-300">mémoire prospective</strong> : programmer ton esprit pour reconnaître l'état de rêve. C'est la technique la plus validée scientifiquement, avec un taux de réussite de 46% chez les participants qui se rendorment en moins de 5 minutes après WBTB (Aspy et al., 2017). L'étude ILDIS (2020) confirme son efficacité même chez des débutants complets.</p>
              <ol class="text-[11px] text-gray-300 space-y-1">
                <li><strong class="text-dream-300">1.</strong> Remémore-toi le rêve que tu viens de faire. Note les éléments bizarres ou impossibles.</li>
                <li><strong class="text-dream-300">2.</strong> Répète-toi : « La prochaine fois que je rêve, je me rendrai compte que je rêve. »</li>
                <li><strong class="text-dream-300">3.</strong> Visualise-toi dans le rêve précédent : tu reconnais le signe de rêve et tu deviens lucide.</li>
                <li><strong class="text-dream-300">4.</strong> Maintiens cette intention en t'endormant. Si d'autres pensées surgissent, reviens à ton intention.</li>
              </ol>
              <p class="text-[10px] text-gray-500 italic mt-1.5">LaBerge (1985) · Aspy et al. (2017) · ILDIS (2020, PMC7379166)</p>
            </div>

            <div class="p-3 rounded-lg bg-dream-900/20 border border-dream-500/20">
              <p class="text-xs font-semibold text-dream-200 mb-1.5">🧘 Variante SSILD (Senses Initiated Lucid Dream)</p>
              <p class="text-[11px] text-gray-300 leading-relaxed mb-2">Créée par CosmicIron (2011), la SSILD est une alternative plus simple à MILD. Elle consiste à effectuer des cycles courts d'attention sensorielle sans effort de concentration. L'étude ILDIS (2020) a trouvé des résultats comparables à MILD. Recommandée si tu préfères une approche détendue, sans pression mentale.</p>
              <ol class="text-[11px] text-gray-300 space-y-1">
                <li><strong class="text-dream-300">1.</strong> Recouche-toi après ton éveil WBTB (quelques minutes d'éveil suffisent pour SSILD).</li>
                <li><strong class="text-dream-300">2.</strong> Cycle Vue (~20s) : yeux fermés, observe les formes, couleurs ou obscurité. Ne force pas.</li>
                <li><strong class="text-dream-300">3.</strong> Cycle Son (~20s) : porte attention aux sons environnants. Reste passif et réceptif.</li>
                <li><strong class="text-dream-300">4.</strong> Cycle Toucher (~20s) : concentre-toi sur les sensations physiques (poids, température, draps).</li>
                <li><strong class="text-dream-300">5.</strong> Répète 4 à 5 cycles, puis laisse-toi glisser vers le sommeil. La lucidité survient souvent spontanément.</li>
              </ol>
              <p class="text-[10px] text-gray-500 italic mt-1.5">CosmicIron (2011) · ILDIS (2020, PMC7379166)</p>
            </div>
          </div>

          <p class="text-[10px] text-gray-500 italic mt-3">Sources : Stumbrys et al. (2012, revue systématique) · Aspy et al. (2017) · Erlacher & Stumbrys (2020, Frontiers in Psychology) · LaBerge (1985) · ILDIS (2020, PMC7379166)</p>
        </div>

        <!-- Reality Testing -->
        <div class="glass rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2"><span class="text-xl">✋</span><h4 class="font-semibold text-dream-200 text-sm">Reality Testing (Technique de Réflexion)</h4></div>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">Formalisée par Paul Tholey (1983), cette méthode repose sur un principe simple : si tu prends l'habitude de questionner la réalité pendant la journée, ce réflexe finit par se déclencher aussi en rêve. L'élément clé est la <strong class="text-dream-300">qualité intentionnelle</strong> de l'interrogation, pas la quantité mécanique. Il ne suffit pas de faire le geste par habitude : tu dois sincèrement te demander « suis-je en train de rêver ? » et examiner ton environnement avec attention critique. L'efficacité du Reality Testing isolé reste débattue (Stumbrys et al., 2012), mais combiné au WBTB et au MILD, il contribue à un taux de réussite de 17% dès la première semaine (Aspy et al., 2017).</p>
          <p class="text-[11px] font-semibold text-dream-200 mb-1.5">Protocole :</p>
          <ol class="text-[11px] text-gray-300 space-y-1.5 mb-2">
            <li><strong class="text-dream-300">1. Choisis tes déclencheurs :</strong> Associe tes tests à des moments récurrents (passer une porte, regarder l'heure, entendre un son particulier).</li>
            <li><strong class="text-dream-300">2. Questionne-toi sincèrement :</strong> « Suis-je en train de rêver ? » avec une vraie intention. Examine ton environnement.</li>
            <li><strong class="text-dream-300">3. Test physique :</strong> Compte tes doigts, pince-toi le nez et essaie de respirer, ou relis un texte deux fois.</li>
            <li><strong class="text-dream-300">4. Vise 10 à 15 tests par jour.</strong> La régularité est essentielle. Plus le réflexe est ancré, plus il apparaîtra dans tes rêves.</li>
            <li><strong class="text-dream-300">5. En rêve, les résultats seront anormaux :</strong> doigts en trop, air passant à travers le nez pincé, texte qui change.</li>
          </ol>
          <p class="text-[10px] text-gray-500 italic">Sources : Tholey (1983, Reflexionstechnik) · Aspy et al. (2017) · Stumbrys et al. (2012) · LaBerge et al. (1996)</p>
        </div>

        <!-- Journal -->
        <div class="glass rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2"><span class="text-xl">📝</span><h4 class="font-semibold text-dream-200 text-sm">Journal de Rêves</h4></div>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">Le journal est le <strong class="text-dream-300">fondement</strong> de toute pratique de rêve lucide. Sans rappel de tes rêves, même si tu deviens lucide, tu ne t'en souviendras pas au réveil. La recherche sur le rappel onirique (Schredl, 2002 ; 2018) montre que la simple habitude de noter ses rêves augmente significativement le rappel en quelques semaines. Plus tu notes, plus ton cerveau retient les rêves. Le journal permet aussi d'identifier tes « signes de rêve » récurrents, essentiel pour MILD et le Reality Testing.</p>
          <p class="text-[11px] font-semibold text-dream-200 mb-1.5">Bonnes pratiques :</p>
          <ul class="text-[11px] text-gray-300 space-y-1.5 mb-2">
            <li><strong class="text-dream-300">Au réveil, ne bouge pas.</strong> Reste immobile, yeux fermés. Les souvenirs s'effacent très vite avec le mouvement.</li>
            <li><strong class="text-dream-300">Note dans les 5 premières minutes.</strong> Même un fragment, une émotion ou une image.</li>
            <li><strong class="text-dream-300">Écris au présent :</strong> « Je marche dans une forêt » plutôt que « J'étais dans une forêt ». Cela augmente l'immersion et le rappel.</li>
            <li><strong class="text-dream-300">Utilise les étapes de Rêve Mieux :</strong> Découpe tes rêves en scènes distinctes avec les émotions de chaque moment.</li>
            <li><strong class="text-dream-300">Relis tes anciens rêves :</strong> La relecture consolide les souvenirs et t'aide à repérer tes signes de rêve récurrents.</li>
          </ul>
          <p class="text-[10px] text-gray-500 italic">Sources : Schredl (2002 ; 2018) · Cleveland Clinic (2024)</p>
        </div>

        <!-- Incubation -->
        <div class="glass rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2"><span class="text-xl">🌙</span><h4 class="font-semibold text-dream-200 text-sm">Incubation & Séries de Rêves</h4></div>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">L'incubation consiste à influencer le contenu de tes rêves par une suggestion pré-sommeil ciblée. Barrett (Harvard, 1993) : environ 50% des participants ont rêvé du sujet choisi. L'hypothèse de la continuité (Schredl, 2003) confirme que les pensées actives avant le sommeil influencent le contenu onirique. C'est le principe des <strong class="text-dream-300">séries de rêves</strong> dans Rêve Mieux : en relisant tes rêves précédents avant le coucher, tu « recharges » ta mémoire de travail avec ce monde onirique, augmentant les chances d'y retourner.</p>
          <p class="text-[11px] font-semibold text-dream-200 mb-1.5">Protocole avec Rêve Mieux :</p>
          <ol class="text-[11px] text-gray-300 space-y-1.5 mb-2">
            <li><strong class="text-dream-300">1. Crée ou choisis une série :</strong> Regroupe les rêves que tu veux prolonger dans une série narrative.</li>
            <li><strong class="text-dream-300">2. Relis avant le coucher (15-30 min) :</strong> Laisse les détails, les lieux, les personnages et les émotions t'imprégner.</li>
            <li><strong class="text-dream-300">3. Formule ton intention :</strong> « Cette nuit, je veux retourner dans ce rêve et continuer l'histoire. »</li>
            <li><strong class="text-dream-300">4. Visualise la scène :</strong> Imagine-toi dans le dernier lieu de la série. Ressens les émotions, vois les détails. Maintiens cette image en t'endormant.</li>
            <li><strong class="text-dream-300">5. Le lendemain, note le résultat.</strong> Même si ce n'est pas une continuation exacte, note les éléments communs. Ton subconscient intègre progressivement la suggestion.</li>
          </ol>
          <p class="text-[10px] text-gray-500 italic">Sources : Barrett (Harvard, 1993) · Schredl (2003, hypothèse de la continuité) · Dement (1974, protocole d'incubation)</p>
        </div>

        <!-- ===== TLR NOCTURNE (technique d'induction) ===== -->
        <div class="glass rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xl">🌜</span>
            <h4 class="font-semibold text-dream-200 text-sm">TLR Nocturne : Déclencheur Sonore</h4>
          </div>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">
            La <strong class="text-violet-300">Targeted Lucidity Reactivation</strong> (TLR), développée par l'Université de Northwestern (Konkoly et al., 2024, <em>Consciousness and Cognition</em>), consiste à rejouer pendant le sommeil paradoxal un son préalablement associé à l'entraînement au rêve lucide. Dans l'étude originale, les chercheurs ont utilisé une app Android dédiée qui jouait automatiquement les sons 6h après l'endormissement, avec détection de mouvement et ajustement dynamique du volume. Résultat : les participants sont passés de <strong class="text-dream-300">0,74 à 2,11 rêves lucides/semaine</strong>, et 7 participants ont rapporté 14 rêves lucides directement déclenchés par le son.
          </p>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">
            <strong class="text-violet-200">Adaptation :</strong> Rêve Mieux n'intègre pas (encore) d'app TLR automatisée. Le guide ci-dessous te permet de <strong class="text-dream-300">reproduire le même principe manuellement</strong> avec l'appli Horloge de ton téléphone. Tu programmes une alarme avec le refrain « Rêve Mieux » comme sonnerie, à <strong class="text-dream-300">volume très bas</strong>, pour qu'elle sonne <strong class="text-dream-300">6 heures après ton coucher</strong> (pic de sommeil paradoxal). Comme ton cerveau a déjà associé ce refrain au questionnement « suis-je en train de rêver ? » via l'ancrage musical, le son peut s'intégrer dans ton rêve et déclencher la lucidité.
          </p>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">
            <strong class="text-emerald-200">Scénario gagnant-gagnant :</strong> <strong class="text-dream-300">Si tu ne te réveilles pas</strong>, le son s'intègre dans ton rêve et peut déclencher un flash de lucidité. <strong class="text-dream-300">Si la musique te réveille</strong>, tu es dans les conditions idéales d'un <strong class="text-violet-200">WBTB</strong> (voir technique ci-dessus). Tu peux alors formuler ton intention et te rendormir avec une conscience accrue.
          </p>

          <!-- Étape 1 : Télécharger le refrain -->
          <div class="p-3 rounded-xl bg-amber-900/15 border border-amber-500/20 mb-4">
            <p class="text-xs font-semibold text-amber-200 mb-2"><i class="fas fa-download mr-1.5"></i>Étape 1 : Télécharge le refrain</p>
            <p class="text-[11px] text-gray-300 leading-relaxed mb-2.5">Télécharge le fichier audio du refrain « Rêve Mieux » sur ton téléphone. Tu l'utiliseras comme sonnerie d'alarme pour toutes les étapes suivantes.</p>
            <a href="/static/reve-mieux-refrain.mp3" download="reve-mieux-refrain.mp3"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 transition-all">
              <i class="fas fa-music"></i> Télécharger le refrain
            </a>
            <p class="text-[11px] text-gray-500 mt-2">Fichier MP3, enregistre-le pour le sélectionner comme sonnerie dans ton appli Horloge.</p>
          </div>

          <!-- Étape 2 : Routine lucide en 3 alarmes -->
          <div class="p-3 rounded-xl bg-emerald-900/15 border border-emerald-500/20 mb-4">
            <p class="text-xs font-semibold text-emerald-200 mb-2"><i class="fas fa-bed mr-1.5"></i>Étape 2 : Programme ta routine lucide (3 alarmes)</p>
            <p class="text-[11px] text-gray-300 leading-relaxed mb-2">Se coucher à heure fixe chaque soir <strong class="text-emerald-300">augmente la prévisibilité de tes cycles REM</strong>, ce qui rend toutes les techniques de rêve lucide plus efficaces <span class="text-gray-500">(Nature Communications Psychology, 2024 ; Sleep Foundation)</span>.</p>
            <p class="text-[11px] text-gray-300 leading-relaxed mb-2">Mais la régularité seule ne suffit pas. Les études montrent que les techniques pratiquées avant le coucher (relecture de rêves, intention, incubation) ont un <strong class="text-emerald-300">impact direct sur le contenu onirique</strong> et les chances de lucidité (Barrett, 1993 ; Schredl, 2003 ; Aspy et al., 2017). Le principe : <strong class="text-emerald-300">une double imprégnation</strong>. D'abord tu relis tes rêves sur ton téléphone (phase active), puis tu lâches l'écran pendant 1h (phase calme), et au moment de t'endormir tu revisualises tout de mémoire (phase d'ancrage). Ce double passage renforce considérablement la trace mnésique.</p>

            <p class="text-[11px] font-semibold text-emerald-200 mb-2 mt-3"><i class="fas fa-list-ol mr-1"></i>Programme 3 alarmes quotidiennes dans ton appli Horloge</p>

            <!-- Alarme 1 : Préparation active -->
            <div class="p-2.5 rounded-lg bg-night-900/50 border border-emerald-500/10 mb-2">
              <p class="text-[11px] font-semibold text-amber-200 mb-1.5">🔔 Alarme 1 : Préparation active (1h30 avant le coucher)</p>
              <ul class="text-[11px] text-gray-300 space-y-1 ml-3 mb-2">
                <li><span class="whitespace-nowrap">⏰ <strong>Heure :</strong></span> 1h30 avant ton coucher (ex : coucher 23h, alarme à 21h30)</li>
                <li><span class="whitespace-nowrap">🔈 <strong>Volume :</strong></span> <strong class="text-amber-300">fort</strong> (tu dois l'entendre clairement, c'est le signal de départ)</li>
              </ul>
              <p class="text-[11px] text-gray-400 leading-relaxed mb-1">Cette alarme lance ta routine en <strong class="text-emerald-300">3 phases de 10 minutes</strong> :</p>

              <div class="p-2 rounded-lg bg-emerald-900/10 border border-emerald-500/10 mb-1.5">
                <p class="text-[11px] font-semibold text-emerald-200 mb-1">📱 Phase 1 : Relecture sur Rêve Mieux (10 min)</p>
                <ol class="text-[11px] text-gray-300 space-y-1 ml-3">
                  <li><strong class="text-emerald-300">1. Relire tes derniers rêves</strong> dans Rêve Mieux. Repère tes signes de rêve récurrents (lieux, personnages, situations absurdes).</li>
                  <li><strong class="text-emerald-300">2. Reprendre une série de rêves</strong> si tu en as une en cours. Relis les épisodes, laisse les détails et les émotions t'imprégner. Ton cerveau charge ces contenus dans la mémoire de travail (incubation, voir section ci-dessus).</li>
                  <li><strong class="text-emerald-300">3. Formuler ton intention</strong> : « Cette nuit, je me rendrai compte que je rêve. » Si tu suis une série : « Cette nuit, je retourne dans ce rêve et je deviens lucide. » C'est le principe MILD (voir les techniques précédentes).</li>
                  <li><strong class="text-emerald-300">4. Faire un Reality Check</strong> avec le refrain « Rêve Mieux ». Lance le lecteur audio en haut de cette page, compte tes doigts, demande-toi sincèrement « suis-je en train de rêver ? ».</li>
                </ol>
              </div>

              <div class="p-2 rounded-lg bg-amber-900/10 border border-amber-500/10 mb-1.5">
                <p class="text-[11px] font-semibold text-amber-200 mb-1">🚿 Phase 2 : Douche chaude + visualisation (10 min)</p>
                <p class="text-[11px] text-gray-300 leading-relaxed mb-1">Prends une <strong class="text-amber-300">douche chaude (pas brûlante)</strong>. La chaleur détend le corps et facilite l'endormissement : quand tu en sors, ta température corporelle chute naturellement, ce qui envoie un signal de sommeil à ton cerveau.</p>
                <p class="text-[11px] text-gray-300 leading-relaxed">Profite de ce moment pour <strong class="text-amber-300">visualiser des rêves que tu aimerais faire</strong>. Repars de ce que tu viens de relire (tes rêves récents, tes séries en cours) ou laisse de nouvelles idées émerger. La douche est un moment parfait pour ça : ton esprit est libre, détendu, et les images viennent naturellement.</p>
              </div>

              <div class="p-2 rounded-lg bg-violet-900/10 border border-violet-500/10">
                <p class="text-[11px] font-semibold text-violet-200 mb-1">📝 Phase 3 : Retour sur Rêve Mieux (10 min)</p>
                <p class="text-[11px] text-gray-300 leading-relaxed">De retour sur ton téléphone, <strong class="text-violet-300">note les nouvelles idées de rêves</strong> ou de suites de rêves que tu as eues sous la douche dans la page <strong class="text-violet-300">Intentions de rêve</strong>. Enrichis tes séries en cours si de nouvelles scènes te sont venues. Cette dernière phase ancre les visualisations fraîches dans ta mémoire de travail juste avant la phase calme.</p>
              </div>
            </div>

            <!-- Alarme 2 : Temps calme -->
            <div class="p-2.5 rounded-lg bg-night-900/50 border border-violet-500/10 mb-2">
              <p class="text-[11px] font-semibold text-violet-200 mb-1.5">🌙 Alarme 2 : Temps calme (1h avant le coucher)</p>
              <ul class="text-[11px] text-gray-300 space-y-1 ml-3 mb-2">
                <li><span class="whitespace-nowrap">⏰ <strong>Heure :</strong></span> 1h avant ton coucher (ex : coucher 23h, alarme à 22h)</li>
                <li><span class="whitespace-nowrap">🔈 <strong>Volume :</strong></span> modéré</li>
              </ul>
              <p class="text-[11px] text-gray-400 leading-relaxed"><strong class="text-violet-300">Pose ton téléphone et active le mode avion.</strong> C'est le moment de couper tous les écrans. Lumière tamisée, pas de stimulation. Le mode avion te protège à trois niveaux : plus aucune distraction pendant ton temps calme, aucune interruption pendant la nuit, et surtout, au réveil, tu peux ouvrir Rêve Mieux pour noter tes rêves sans qu'un flot de notifications te fasse perdre le fil de ce que tu es en train de te rappeler. Pendant cette heure, ton cerveau consolide naturellement ce que tu viens de lire. Pas besoin de forcer : les images, les lieux et les émotions de tes rêves continuent de travailler en arrière-plan.</p>
            </div>

            <!-- Alarme 3 : Coucher -->
            <div class="p-2.5 rounded-lg bg-night-900/50 border border-dream-500/10">
              <p class="text-[11px] font-semibold text-dream-200 mb-1.5">😴 Alarme 3 : Coucher (heure de dormir)</p>
              <ul class="text-[11px] text-gray-300 space-y-1 ml-3 mb-2">
                <li><span class="whitespace-nowrap">⏰ <strong>Heure :</strong></span> ton heure de coucher (ex : 23h)</li>
                <li><span class="whitespace-nowrap">🔈 <strong>Volume :</strong></span> modéré</li>
              </ul>
              <p class="text-[11px] text-gray-400 leading-relaxed mb-1.5">C'est l'heure. Tu es au lit, <strong class="text-dream-300">sans téléphone depuis 1h</strong>. Maintenant, refais les mêmes techniques que lors de l'alarme 1, mais <strong class="text-dream-300">de mémoire uniquement</strong> :</p>
              <ol class="text-[11px] text-gray-300 space-y-1.5 ml-3">
                <li><strong class="text-dream-300">1. Repense à tes rêves récents.</strong> Quels lieux, quels personnages, quels signes de rêve récurrents te reviennent ?</li>
                <li><strong class="text-dream-300">2. Revisite ta série de rêves</strong> mentalement. Replonge-toi dans les scènes, les émotions, les détails.</li>
                <li><strong class="text-dream-300">3. Reformule ton intention</strong> : « Cette nuit, je me rendrai compte que je rêve. » Répète avec conviction.</li>
                <li><strong class="text-dream-300">4. Visualise-toi lucide</strong> : imagine-toi dans ton dernier rêve. Tu reconnais un signe de rêve, tu deviens lucide, tu prends le contrôle. Maintiens cette image en t'endormant.</li>
              </ol>
              <p class="text-[11px] text-gray-500 italic mt-1.5">Cette double imprégnation (téléphone puis mémoire) ancre profondément les contenus oniriques. Le fait de revisualiser sans écran force ton cerveau à reconstruire activement les images, ce qui renforce la trace mnésique bien plus qu'une simple relecture.</p>
            </div>

            <p class="text-[11px] text-gray-400 italic mt-2.5">Toutes les alarmes utilisent le refrain « Rêve Mieux » comme sonnerie. En l'entendant 3 fois chaque soir, tu renforces l'ancrage musical qui servira de déclencheur nocturne via le TLR.</p>
          </div>

          <!-- Étape 3 : Choisir sa stratégie -->
          <div class="mb-4">
            <p class="text-xs font-semibold text-violet-200 mb-3"><i class="fas fa-route mr-1.5"></i>Étape 3 : Choisis ta stratégie et programme tes alarmes nocturnes</p>
            
            <!-- Stratégie A : Douce -->
            <div class="p-3 rounded-xl bg-violet-900/20 border border-violet-500/20 mb-3">
              <p class="text-xs font-bold text-violet-200 mb-1.5">🌙 Stratégie A : Douce (sans réveil)</p>
              <p class="text-[11px] text-gray-300 leading-relaxed mb-2">L'objectif est que le refrain s'intègre directement dans ton rêve <strong class="text-violet-300">sans te réveiller</strong>. Le volume doit être très bas : juste assez pour que ton cerveau endormi capte le son.</p>
              <div class="p-2.5 rounded-lg bg-night-900/50 border border-violet-500/10 space-y-1.5">
                <p class="text-[11px] text-gray-200"><strong class="text-dream-300">Programme 1 alarme</strong> dans ton appli Horloge</p>
                <ul class="text-[11px] text-gray-300 space-y-1 ml-3">
                  <li><span class="whitespace-nowrap">⏰ <strong>Heure :</strong></span> 5h30 après ton coucher (ex : coucher 23h, alarme à 4h30)</li>
                  <li><span class="whitespace-nowrap">🎵 <strong>Sonnerie :</strong></span> le fichier « Rêve Mieux » téléchargé</li>
                  <li><span class="whitespace-nowrap">🔈 <strong>Volume :</strong></span> le plus bas possible (1 à 2 barres max)</li>
                  <li><span class="whitespace-nowrap">🔁 <strong>Répéter :</strong></span> active le rappel (snooze) à 20 min d'intervalle, 3 fois max</li>
                  <li><span class="whitespace-nowrap">📳 <strong>Vibration :</strong></span> désactivée</li>
                </ul>
                <p class="text-[11px] text-gray-400 italic mt-1">Le refrain sonnera 3 fois à 20 min d'intervalle (5h30, 5h50, 6h10 après le coucher), couvrant une large fenêtre de sommeil paradoxal. Le volume ultra-bas fait que tu ne te réveilleras pas, mais ton cerveau endormi pourra capter le son et l'intégrer dans le rêve en cours.</p>
              </div>
            </div>

            <!-- Stratégie B : WBTB Combinée -->
            <div class="p-3 rounded-xl bg-dream-900/20 border border-dream-500/20">
              <p class="text-xs font-bold text-dream-200 mb-1.5">⏰ Stratégie B : WBTB combinée (réveil + rendormissement)</p>
              <p class="text-[11px] text-gray-300 leading-relaxed mb-2">Plus efficace mais plus engagée. Tu te réveilles brièvement en plein pic de sommeil paradoxal, tu appliques une technique d'induction (MILD ou SSILD), puis tu te rendors avec une conscience accrue. 30 min plus tard, le refrain joue à volume ultra-bas pour s'intégrer dans ton rêve.</p>
              <div class="p-2.5 rounded-lg bg-night-900/50 border border-dream-500/10 space-y-2">
                <div>
                  <p class="text-[11px] text-gray-200"><strong class="text-amber-300">Alarme 1 : Réveil bref</strong></p>
                  <ul class="text-[11px] text-gray-300 space-y-0.5 ml-3">
                    <li><span class="whitespace-nowrap">⏰ <strong>Heure :</strong></span> 5h30 après ton coucher</li>
                    <li><span class="whitespace-nowrap">🎵 <strong>Sonnerie :</strong></span> le fichier « Rêve Mieux » téléchargé, <strong class="text-amber-300">à volume suffisant pour te réveiller</strong></li>
                    <li><span class="whitespace-nowrap">🔈 <strong>Volume :</strong></span> fort (l'objectif ici est de te réveiller, pas de rester endormi)</li>
                    <li><span class="whitespace-nowrap">💡 <strong>Action :</strong></span> lève-toi 5 à 10 min (toilettes, verre d'eau). Applique ensuite une <strong class="text-dream-300">technique d'induction</strong> : MILD (intention + visualisation) ou SSILD (cycles sensoriels). Voir les techniques d'induction ci-dessus pour les protocoles détaillés. Puis recouche-toi.</li>
                  </ul>
                </div>
                <div>
                  <p class="text-[11px] text-gray-200"><strong class="text-violet-300">Alarme 2 : Refrain lucide</strong></p>
                  <ul class="text-[11px] text-gray-300 space-y-0.5 ml-3">
                    <li><span class="whitespace-nowrap">⏰ <strong>Heure :</strong></span> 30 min après l'alarme 1 (tu seras rendormi)</li>
                    <li><span class="whitespace-nowrap">🎵 <strong>Sonnerie :</strong></span> le fichier « Rêve Mieux » téléchargé</li>
                    <li><span class="whitespace-nowrap">🔈 <strong>Volume :</strong></span> très bas (1 à 2 barres)</li>
                    <li><span class="whitespace-nowrap">🔁 <strong>Répéter :</strong></span> rappel à 10 min, 2 à 3 fois</li>
                    <li><span class="whitespace-nowrap">📳 <strong>Vibration :</strong></span> désactivée</li>
                  </ul>
                </div>
                <p class="text-[11px] text-gray-400 italic">La combinaison WBTB + induction est la plus puissante : Aspy et al. (2017) montrent 46% de réussite chez ceux qui se rendorment rapidement après MILD, et Konkoly et al. (2024) montrent que le TLR augmente la fréquence de rêves lucides de 2,8 fois.</p>
              </div>
            </div>
          </div>

          <!-- Conseils volume -->
          <div class="p-2.5 rounded-lg bg-violet-500/8 border border-violet-500/15 mb-3">
            <p class="text-[11px] text-gray-300 leading-relaxed">
              <i class="fas fa-volume-down text-violet-400 mr-1"></i>
              <strong class="text-violet-200">Réglage du volume :</strong> L'objectif est de trouver le seuil où le son est <strong class="text-violet-300">perceptible par ton cerveau endormi</strong> mais <strong class="text-violet-300">pas assez fort pour te réveiller</strong>. Commence au minimum et augmente progressivement sur plusieurs nuits. Si tu te réveilles systématiquement, baisse d'un cran. Ce seuil est personnel, il faut quelques nuits pour le trouver.
            </p>
          </div>

          <!-- Explication scientifique courte -->
          <div class="p-2.5 rounded-lg bg-violet-500/8 border border-violet-500/15">
            <p class="text-[11px] text-gray-300 leading-relaxed">
              <i class="fas fa-flask text-violet-400 mr-1"></i>
              <strong class="text-violet-200">Pourquoi 5h30 :</strong> Les phases REM les plus longues (30 à 60 min) surviennent en fin de nuit. L'étude TLR a montré que les indices sonores à partir de 5h30 après l'endormissement ciblent le pic de sommeil paradoxal. En espaçant les répétitions de 20 min, on couvre la fenêtre 5h30 à 6h10, ce qui compense les variations de temps d'endormissement.
            </p>
          </div>
          <p class="text-[10px] text-gray-500 italic mt-2">Sources : Konkoly et al. (2024, Consciousness and Cognition, PMC11542932) · Aspy et al. (2017) · Erlacher & Stumbrys (2020, Frontiers in Psychology) · Nature Communications Psychology (2024) · Sleep Foundation</p>
        </div>

      </div>

      <!-- ===== BOUTONS NAVIGATION ===== -->
      <div class="flex flex-col sm:flex-row justify-center gap-3 mt-5">
        <button onclick="navigate('lucidity')"
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold glass text-gray-300 hover:text-white transition-all">
          <i class="fas fa-arrow-left text-xs"></i> Tableau de bord
        </button>
        <button onclick="navigate('lucidity-level2')"
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 transition-all">
          Niveau 2 : Optimise ton sommeil paradoxal <i class="fas fa-chevron-right text-xs ml-1"></i>
        </button>
      </div>
    </div>`;
}

// ========== LUCIDITÉ NIVEAU 2 : OPTIMISER SON SOMMEIL ==========
function renderLucidityLevel2() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="animate-slideUp">
      <!-- Bouton retour -->
      <button onclick="navigate('lucidity')" class="flex items-center gap-2 text-sm text-gray-400 hover:text-dream-300 transition-colors mb-4">
        <i class="fas fa-arrow-left"></i> Retour au tableau de bord
      </button>

      <!-- ===== HERO TITRE ===== -->
      <div class="relative rounded-2xl p-5 mb-6 overflow-hidden" style="background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(56,189,248,0.10), rgba(139,92,246,0.08));">
        <div class="absolute inset-0 opacity-20" style="background: radial-gradient(circle at 20% 50%, rgba(139,92,246,0.4), transparent 60%), radial-gradient(circle at 80% 30%, rgba(56,189,248,0.3), transparent 50%);"></div>
        <div class="relative text-center">
          <div class="text-3xl mb-2">🧪</div>
          <p class="text-sm font-display font-semibold text-dream-300 mb-1">Niveau 2</p>
          <h2 class="text-xl font-display font-bold text-white mb-1.5">Optimise ton sommeil paradoxal</h2>
          <p class="text-xs text-gray-400">Augmente la durée de ton sommeil paradoxal pour rêver plus et plus intensément</p>
        </div>
      </div>

      <!-- ===== INTRO : POURQUOI LE REM ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">🧠</span>
          <h3 class="text-sm font-display font-bold text-dream-100">Pourquoi le sommeil paradoxal est la « zone des rêves »</h3>
        </div>
        <p class="text-xs text-gray-300 leading-relaxed mb-3">Chez l'adulte en bonne santé, le <strong class="text-dream-300">sommeil paradoxal représente 20 à 25% du temps de sommeil total</strong>, soit environ <strong class="text-dream-300">90 à 120 minutes par nuit</strong> si tu dors 7 à 9 heures.</p>
        <div class="space-y-2 mb-3">
          <div class="flex items-start gap-2">
            <span class="text-dream-400 mt-0.5">▸</span>
            <p class="text-xs text-gray-300">L'activité cérébrale est intense, proche de l'éveil.</p>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-dream-400 mt-0.5">▸</span>
            <p class="text-xs text-gray-300">C'est la phase <strong class="text-dream-300">la plus propice aux rêves</strong> complexes et mémorisables.</p>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-dream-400 mt-0.5">▸</span>
            <p class="text-xs text-gray-300">La durée du REM <strong class="text-dream-300">augmente progressivement au fil de la nuit</strong> : les premiers épisodes durent 10 à 20 min, les derniers peuvent dépasser 30 min.</p>
          </div>
        </div>
        <div class="p-3 rounded-lg bg-dream-900/20 border border-dream-500/15">
          <p class="text-xs text-gray-300 leading-relaxed"><i class="fas fa-lightbulb text-amber-400 mr-1.5"></i><strong class="text-dream-200">En clair :</strong> plus tu dors longtemps et de manière continue, plus tu permets à ces longs épisodes de REM de se dérouler, donc plus tu crées de rêves, souvent plus intenses en fin de nuit.</p>
        </div>
      </div>

      <!-- ===== 1. DORMIR ASSEZ LONGTEMPS ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">⏰</span>
          <h3 class="text-sm font-display font-bold text-dream-100">Dormir assez longtemps et régulièrement</h3>
        </div>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-dream-500/40 mb-3">
          <p class="text-xs font-semibold text-dream-200 mb-1.5">Viser 7 à 9 heures de sommeil</p>
          <p class="text-xs text-gray-300 leading-relaxed mb-2">Pour atteindre 90 à 120 minutes de REM, il faut un volume total de sommeil suffisant.</p>
          <ul class="text-xs text-gray-300 space-y-1.5 ml-1">
            <li class="flex items-start gap-2"><span class="text-dream-400 mt-0.5">▸</span><span>En dessous de 6 heures, tu coupes surtout la <strong class="text-dream-300">fin de nuit</strong>, là où le REM est le plus long et le plus riche en rêves.</span></li>
            <li class="flex items-start gap-2"><span class="text-dream-400 mt-0.5">▸</span><span>Recommandation : <strong class="text-dream-300">7 à 9 heures par nuit</strong>, ce qui laisse au cerveau le temps de traverser plusieurs cycles complets avec des REM prolongés.</span></li>
          </ul>
          <div class="p-2.5 rounded-lg bg-dream-900/15 border border-dream-500/10 mt-2.5">
            <p class="text-[11px] text-gray-400"><i class="fas fa-check text-emerald-400 mr-1.5"></i><strong class="text-emerald-200">Stratégie :</strong> Calcule ton heure de coucher à partir de ton heure de réveil cible en te laissant au moins 7h30 de temps au lit. Garde cette fenêtre de sommeil stable chaque nuit.</p>
          </div>
        </div>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-violet-500/40">
          <p class="text-xs font-semibold text-violet-200 mb-1.5">Rendre ton horloge interne ultra régulière</p>
          <p class="text-xs text-gray-300 leading-relaxed mb-2">La <strong class="text-violet-300">régularité des horaires</strong> est l'un des leviers les plus puissants pour stabiliser les cycles de sommeil et garantir un REM bien structuré chaque nuit.</p>
          <ul class="text-xs text-gray-300 space-y-1.5 ml-1">
            <li class="flex items-start gap-2"><span class="text-violet-400 mt-0.5">▸</span><span>Se coucher et se lever <strong class="text-violet-300">tous les jours à la même heure</strong>, week-end compris.</span></li>
            <li class="flex items-start gap-2"><span class="text-violet-400 mt-0.5">▸</span><span>Ne pas décaler ses horaires de plus d'<strong class="text-violet-300">une heure</strong> d'un jour à l'autre.</span></li>
          </ul>
          <div class="p-2.5 rounded-lg bg-violet-900/15 border border-violet-500/10 mt-2.5">
            <p class="text-[11px] text-gray-400"><i class="fas fa-check text-emerald-400 mr-1.5"></i><strong class="text-emerald-200">Stratégie :</strong> Choisis une plage horaire réaliste et durable (ex : 23h à 7h) et tiens-t'y chaque jour. Évite les nuits blanches ou très décalées qui cassent cette programmation.</p>
          </div>
        </div>
      </div>

      <!-- ===== 2. PROTÉGER LE REM ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">🛡️</span>
          <h3 class="text-sm font-display font-bold text-dream-100">Protéger ton REM : éliminer les ennemis des rêves</h3>
        </div>
        <p class="text-xs text-gray-400 mb-3">Certaines substances réduisent, fragmentent ou retardent le REM, donc diminuent la quantité et l'intensité des rêves.</p>

        <div class="space-y-3">
          <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-amber-500/40">
            <p class="text-xs font-semibold text-amber-200 mb-1.5">☕ Limiter caféine et stimulants</p>
            <p class="text-xs text-gray-300 leading-relaxed mb-2">La caféine (café, thé fort, boissons énergisantes) <strong class="text-amber-300">retarde l'endormissement et perturbe la structure du sommeil</strong>, y compris la répartition du REM.</p>
            <ul class="text-[11px] text-gray-300 space-y-1 ml-1">
              <li class="flex items-start gap-2"><span class="text-amber-400 mt-0.5">▸</span><span><strong class="text-amber-300">Éviter la caféine dans l'après-midi et le soir.</strong></span></li>
              <li class="flex items-start gap-2"><span class="text-amber-400 mt-0.5">▸</span><span>Limiter aussi les autres excitants le soir : sucre en grande quantité, boissons énergétiques.</span></li>
            </ul>
          </div>

          <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-red-500/40">
            <p class="text-xs font-semibold text-red-200 mb-1.5">🍷 Réduire l'alcool, surtout le soir</p>
            <p class="text-xs text-gray-300 leading-relaxed mb-2">L'alcool peut donner l'impression de faciliter l'endormissement, mais il fragmente le sommeil et <strong class="text-red-300">réduit et retarde le sommeil paradoxal</strong>, avec parfois un rebond de REM peu réparateur plus tard dans la nuit.</p>
            <p class="text-[11px] text-gray-400"><i class="fas fa-check text-emerald-400 mr-1.5"></i><strong class="text-emerald-200">Conseil :</strong> Limiter ou éviter l'alcool dans les heures précédant le coucher.</p>
          </div>

          <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-gray-500/40">
            <p class="text-xs font-semibold text-gray-200 mb-1.5">💊 Autres substances et médicaments</p>
            <p class="text-xs text-gray-300 leading-relaxed mb-1.5">La <strong class="text-gray-200">nicotine</strong> et certains stimulants fragmentent le sommeil et peuvent réduire la continuité du REM. De nombreux <strong class="text-gray-200">médicaments psychotropes</strong> (certains antidépresseurs, antipsychotiques, hypnotiques) sont connus pour diminuer ou remodeler le REM.</p>
            <p class="text-[11px] text-gray-400 italic">Si tu prends ce genre de traitements et que la disparition de tes rêves te gêne, parles-en à un professionnel de santé.</p>
          </div>
        </div>
      </div>

      <!-- ===== 3. ENVIRONNEMENT ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">🏠</span>
          <h3 class="text-sm font-display font-bold text-dream-100">Un environnement qui favorise un REM abondant</h3>
        </div>
        <p class="text-xs text-gray-400 mb-3">Un environnement de sommeil optimisé permet un sommeil plus continu, donc des cycles complets avec un REM préservé.</p>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-dream-500/40 mb-3">
          <p class="text-xs font-semibold text-dream-200 mb-1.5">🌑 Chambre sombre, silencieuse et fraîche</p>
          <ul class="text-xs text-gray-300 space-y-1.5 ml-1">
            <li class="flex items-start gap-2"><span class="text-dream-400 mt-0.5">▸</span><span><strong class="text-dream-300">Obscurité :</strong> la mélatonine, qui régule le sommeil, est mieux sécrétée dans le noir.</span></li>
            <li class="flex items-start gap-2"><span class="text-dream-400 mt-0.5">▸</span><span><strong class="text-dream-300">Silence</strong> ou bruit neutre : limiter les réveils nocturnes qui cassent les cycles.</span></li>
            <li class="flex items-start gap-2"><span class="text-dream-400 mt-0.5">▸</span><span><strong class="text-dream-300">Température :</strong> idéalement <strong class="text-dream-300">16 à 19 °C</strong> dans la chambre.</span></li>
          </ul>
        </div>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-violet-500/40">
          <p class="text-xs font-semibold text-violet-200 mb-1.5">🛏️ Literie et aménagement</p>
          <ul class="text-xs text-gray-300 space-y-1.5 ml-1">
            <li class="flex items-start gap-2"><span class="text-violet-400 mt-0.5">▸</span><span>Une <strong class="text-violet-300">bonne literie</strong> (matelas + oreiller adaptés) réduit les micro-réveils liés à l'inconfort.</span></li>
            <li class="flex items-start gap-2"><span class="text-violet-400 mt-0.5">▸</span><span>Utiliser une <strong class="text-violet-300">literie respirante</strong> qui évacue l'humidité aide à maintenir une température corporelle stable.</span></li>
            <li class="flex items-start gap-2"><span class="text-violet-400 mt-0.5">▸</span><span>Une chambre <strong class="text-violet-300">désencombrée</strong>, avec des couleurs douces, favorise une ambiance apaisante.</span></li>
          </ul>
        </div>
      </div>

      <!-- ===== 4. LUMIÈRE ET ÉCRANS ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">💡</span>
          <h3 class="text-sm font-display font-bold text-dream-100">Lumière et écrans : laisser la mélatonine faire son travail</h3>
        </div>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-amber-500/40 mb-3">
          <p class="text-xs font-semibold text-amber-200 mb-1.5">📵 Réduire la lumière bleue le soir</p>
          <p class="text-xs text-gray-300 leading-relaxed mb-2">La lumière bleue des écrans <strong class="text-amber-300">inhibe la mélatonine</strong> et retarde l'endormissement, ce qui désorganise toute l'architecture de la nuit, y compris le REM.</p>
          <ul class="text-[11px] text-gray-300 space-y-1 ml-1">
            <li class="flex items-start gap-2"><span class="text-amber-400 mt-0.5">▸</span><span><strong class="text-amber-300">Éviter les écrans 1 à 2 heures avant le coucher.</strong></span></li>
            <li class="flex items-start gap-2"><span class="text-amber-400 mt-0.5">▸</span><span>Privilégie des activités calmes : lecture, musique douce, écriture, dessin.</span></li>
          </ul>
        </div>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-emerald-500/40">
          <p class="text-xs font-semibold text-emerald-200 mb-1.5">☀️ S'exposer à la lumière le matin</p>
          <p class="text-xs text-gray-300 leading-relaxed mb-2">Recevoir de la lumière intense tôt dans la journée aide à <strong class="text-emerald-300">calibrer ton rythme circadien</strong>, ce qui se traduit par des nuits mieux organisées et un REM plus stable.</p>
          <ul class="text-[11px] text-gray-300 space-y-1 ml-1">
            <li class="flex items-start gap-2"><span class="text-emerald-400 mt-0.5">▸</span><span>S'exposer à la lumière du jour le matin, ou utiliser un dispositif de luminothérapie.</span></li>
            <li class="flex items-start gap-2"><span class="text-emerald-400 mt-0.5">▸</span><span>Les dispositifs de luminothérapie sont recommandés <strong class="text-emerald-300">le matin après le réveil</strong>, pendant 10 à 30 minutes.</span></li>
          </ul>
        </div>
      </div>

      <!-- ===== 5. ALIMENTATION ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">🍽️</span>
          <h3 class="text-sm font-display font-bold text-dream-100">Alimentation : soutenir le REM</h3>
        </div>
        <p class="text-xs text-gray-400 mb-3">L'alimentation ne « crée » pas du REM à elle seule, mais elle peut faciliter un sommeil plus stable et une bonne sécrétion de mélatonine.</p>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-red-500/40 mb-3">
          <p class="text-xs font-semibold text-red-200 mb-1.5">🚫 Éviter les repas lourds le soir</p>
          <p class="text-xs text-gray-300 leading-relaxed mb-1.5">Les repas trop copieux sont associés à un endormissement difficile et à un sommeil plus fragmenté.</p>
          <p class="text-[11px] text-gray-400"><i class="fas fa-check text-emerald-400 mr-1.5"></i><strong class="text-emerald-200">Conseil :</strong> Laisser quelques heures entre le dîner et le coucher.</p>
        </div>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-emerald-500/40">
          <p class="text-xs font-semibold text-emerald-200 mb-1.5">✅ Favoriser certains aliments le soir</p>
          <p class="text-xs text-gray-300 leading-relaxed mb-2">Les aliments riches en <strong class="text-emerald-300">tryptophane</strong>, précurseur de la sérotonine et de la mélatonine, peuvent favoriser un meilleur sommeil :</p>
          <div class="flex flex-wrap gap-2 mb-2">
            <span class="px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-500/20 text-[11px] text-emerald-300">🥜 Noix</span>
            <span class="px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-500/20 text-[11px] text-emerald-300">🌱 Graines</span>
            <span class="px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-500/20 text-[11px] text-emerald-300">🧀 Fromage</span>
            <span class="px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-500/20 text-[11px] text-emerald-300">🥛 Lait</span>
            <span class="px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-500/20 text-[11px] text-emerald-300">🥚 Oeufs</span>
            <span class="px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-500/20 text-[11px] text-emerald-300">🦃 Dinde</span>
          </div>
          <p class="text-[11px] text-gray-400">Des <strong class="text-emerald-200">glucides complexes</strong> (céréales complètes) peuvent également aider à réguler la production de sérotonine.</p>
        </div>
      </div>

      <!-- ===== 6. ACTIVITÉ PHYSIQUE ET RELAXATION ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">🏃</span>
          <h3 class="text-sm font-display font-bold text-dream-100">Activité physique et relaxation</h3>
        </div>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-dream-500/40 mb-3">
          <p class="text-xs font-semibold text-dream-200 mb-1.5">🏋️ Faire du sport, mais au bon moment</p>
          <p class="text-xs text-gray-300 leading-relaxed mb-2">L'activité physique régulière améliore la qualité globale du sommeil, donc la qualité du REM.</p>
          <ul class="text-[11px] text-gray-300 space-y-1 ml-1">
            <li class="flex items-start gap-2"><span class="text-dream-400 mt-0.5">▸</span><span>Pratiquer du <strong class="text-dream-300">sport régulièrement</strong>, mais <strong class="text-dream-300">loin de l'heure du coucher</strong>.</span></li>
            <li class="flex items-start gap-2"><span class="text-dream-400 mt-0.5">▸</span><span>Éviter les activités physiques intenses juste avant d'aller au lit.</span></li>
          </ul>
        </div>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-violet-500/40">
          <p class="text-xs font-semibold text-violet-200 mb-1.5">🧘 Intégrer des routines de relaxation</p>
          <p class="text-xs text-gray-300 leading-relaxed mb-2">Le stress est un grand perturbateur des nuits et favorise les réveils nocturnes qui tronquent les cycles. Des techniques de relaxation aident à s'endormir plus vite et à garder un sommeil plus continu :</p>
          <div class="flex flex-wrap gap-2">
            <span class="px-2.5 py-1 rounded-full bg-violet-900/30 border border-violet-500/20 text-[11px] text-violet-300">🧘 Méditation</span>
            <span class="px-2.5 py-1 rounded-full bg-violet-900/30 border border-violet-500/20 text-[11px] text-violet-300">🌬️ Respiration profonde</span>
            <span class="px-2.5 py-1 rounded-full bg-violet-900/30 border border-violet-500/20 text-[11px] text-violet-300">🧎 Yoga doux</span>
            <span class="px-2.5 py-1 rounded-full bg-violet-900/30 border border-violet-500/20 text-[11px] text-violet-300">🛁 Bain chaud</span>
            <span class="px-2.5 py-1 rounded-full bg-violet-900/30 border border-violet-500/20 text-[11px] text-violet-300">📖 Lecture tranquille</span>
          </div>
          <p class="text-[11px] text-gray-400 mt-2">Ces routines réduisent le stress et améliorent la continuité du sommeil, ce qui permet au <strong class="text-violet-200">REM de s'exprimer pleinement</strong>.</p>
        </div>
      </div>

      <!-- ===== 7. TROUBLES DU SOMMEIL ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">⚕️</span>
          <h3 class="text-sm font-display font-bold text-dream-100">Troubles du sommeil qui sabotent le REM</h3>
        </div>
        <p class="text-xs text-gray-300 leading-relaxed mb-3">Si malgré toutes ces stratégies tu continues à avoir un sommeil très fragmenté, il peut y avoir un <strong class="text-dream-300">trouble du sommeil</strong> sous-jacent.</p>
        <div class="flex flex-wrap gap-2 mb-3">
          <span class="px-2.5 py-1 rounded-full bg-night-900/40 border border-gray-600/30 text-[11px] text-gray-300">Insomnie chronique</span>
          <span class="px-2.5 py-1 rounded-full bg-night-900/40 border border-gray-600/30 text-[11px] text-gray-300">Apnée du sommeil</span>
          <span class="px-2.5 py-1 rounded-full bg-night-900/40 border border-gray-600/30 text-[11px] text-gray-300">Syndrome des jambes sans repos</span>
        </div>
        <div class="p-3 rounded-lg bg-amber-900/15 border border-amber-500/20">
          <p class="text-xs text-gray-300 leading-relaxed"><i class="fas fa-exclamation-triangle text-amber-400 mr-1.5"></i><strong class="text-amber-200">Important :</strong> Identifier et traiter ces troubles avec un professionnel de santé est essentiel pour restaurer une architecture de sommeil normale, incluant un REM suffisant.</p>
        </div>
      </div>

      <!-- ===== 8. ALLER PLUS LOIN ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">🚀</span>
          <h3 class="text-sm font-display font-bold text-dream-100">Aller plus loin : maximiser quantité et intensité</h3>
        </div>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-dream-500/40 mb-3">
          <p class="text-xs font-semibold text-dream-200 mb-1.5">🌅 Exploiter le REM de fin de nuit</p>
          <p class="text-xs text-gray-300 leading-relaxed mb-2">Puisque les épisodes de REM sont <strong class="text-dream-300">plus longs en fin de nuit</strong>, tu peux :</p>
          <ul class="text-[11px] text-gray-300 space-y-1.5 ml-1">
            <li class="flex items-start gap-2"><span class="text-dream-400 mt-0.5">▸</span><span>Éviter les réveils trop précoces.</span></li>
            <li class="flex items-start gap-2"><span class="text-dream-400 mt-0.5">▸</span><span>T'accorder, lorsque c'est possible, un <strong class="text-dream-300">réveil naturel sans alarme</strong>, pour te réveiller spontanément durant ou juste après un épisode REM.</span></li>
          </ul>
          <p class="text-[11px] text-gray-400 mt-2">Tu augmentes ainsi la probabilité de te réveiller en pleine phase de rêve, ce qui facilite énormément le souvenir du rêve.</p>
        </div>

        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-violet-500/40">
          <p class="text-xs font-semibold text-violet-200 mb-1.5">📝 Développer le rappel des rêves</p>
          <p class="text-xs text-gray-300 leading-relaxed mb-2">Même avec un bon REM, tu peux ne pas te souvenir de tes rêves. Tu peux entraîner ton cerveau à mieux les mémoriser :</p>
          <ul class="text-[11px] text-gray-300 space-y-1.5 ml-1">
            <li class="flex items-start gap-2"><span class="text-violet-400 mt-0.5">▸</span><span><strong class="text-violet-300">Journal de rêves :</strong> garde un carnet près du lit (ou utilise Rêve Mieux) et note au réveil tout ce dont tu te souviens, même quelques fragments.</span></li>
            <li class="flex items-start gap-2"><span class="text-violet-400 mt-0.5">▸</span><span><strong class="text-violet-300">Intention avant le sommeil :</strong> te répéter que tu veux te rappeler tes rêves renforce l'attention portée à ceux-ci à chaque micro-réveil.</span></li>
          </ul>
          <p class="text-[11px] text-gray-400 mt-2">Ces techniques ne modifient pas directement la quantité de REM, mais augmentent la <strong class="text-violet-200">richesse et la vivacité des souvenirs</strong>, ce qui revient, subjectivement, à rêver plus et plus intensément.</p>
        </div>
      </div>

      <!-- ===== SYNTHÈSE ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">📋</span>
          <h3 class="text-sm font-display font-bold text-dream-100">Synthèse : ta stratégie pro-REM</h3>
        </div>
        <p class="text-xs text-gray-400 mb-3">Pour augmenter au maximum la durée du sommeil paradoxal, et donc la quantité et l'intensité de tes rêves, l'ensemble des sources convergent sur ces piliers :</p>
        <div class="space-y-2">
          <div class="flex items-start gap-2.5 p-2 rounded-lg bg-night-900/30">
            <span class="text-lg mt-0.5">⏰</span>
            <p class="text-xs text-gray-300"><strong class="text-dream-300">Dormir 7 à 9h par nuit</strong> pour laisser le temps aux épisodes REM de s'allonger.</p>
          </div>
          <div class="flex items-start gap-2.5 p-2 rounded-lg bg-night-900/30">
            <span class="text-lg mt-0.5">📅</span>
            <p class="text-xs text-gray-300"><strong class="text-dream-300">Horaires réguliers</strong> de coucher et de lever pour stabiliser le rythme circadien.</p>
          </div>
          <div class="flex items-start gap-2.5 p-2 rounded-lg bg-night-900/30">
            <span class="text-lg mt-0.5">☕</span>
            <p class="text-xs text-gray-300"><strong class="text-dream-300">Limiter caféine, alcool et excitants</strong>, surtout l'après-midi et le soir.</p>
          </div>
          <div class="flex items-start gap-2.5 p-2 rounded-lg bg-night-900/30">
            <span class="text-lg mt-0.5">🌑</span>
            <p class="text-xs text-gray-300"><strong class="text-dream-300">Chambre sombre, calme, à 16-19 °C</strong>, avec une literie confortable.</p>
          </div>
          <div class="flex items-start gap-2.5 p-2 rounded-lg bg-night-900/30">
            <span class="text-lg mt-0.5">📵</span>
            <p class="text-xs text-gray-300"><strong class="text-dream-300">Réduire les écrans 1 à 2h avant de dormir</strong>, privilégier des activités calmes.</p>
          </div>
          <div class="flex items-start gap-2.5 p-2 rounded-lg bg-night-900/30">
            <span class="text-lg mt-0.5">🍽️</span>
            <p class="text-xs text-gray-300"><strong class="text-dream-300">Ne pas manger trop lourd le soir</strong>, favoriser le tryptophane et les glucides complexes.</p>
          </div>
          <div class="flex items-start gap-2.5 p-2 rounded-lg bg-night-900/30">
            <span class="text-lg mt-0.5">🏃</span>
            <p class="text-xs text-gray-300"><strong class="text-dream-300">Faire de l'exercice régulièrement</strong>, mais pas juste avant le coucher.</p>
          </div>
          <div class="flex items-start gap-2.5 p-2 rounded-lg bg-night-900/30">
            <span class="text-lg mt-0.5">🧘</span>
            <p class="text-xs text-gray-300"><strong class="text-dream-300">Pratiquer des techniques de relaxation</strong> pour réduire le stress.</p>
          </div>
          <div class="flex items-start gap-2.5 p-2 rounded-lg bg-night-900/30">
            <span class="text-lg mt-0.5">⚕️</span>
            <p class="text-xs text-gray-300"><strong class="text-dream-300">Traiter les troubles du sommeil</strong> éventuels avec un professionnel.</p>
          </div>
          <div class="flex items-start gap-2.5 p-2 rounded-lg bg-night-900/30">
            <span class="text-lg mt-0.5">📝</span>
            <p class="text-xs text-gray-300"><strong class="text-dream-300">Entraîner le rappel de rêves</strong> (journal, intention) pour tirer pleinement parti du REM optimisé.</p>
          </div>
        </div>
      </div>

      <!-- Bouton scroll to top -->
      <div class="flex justify-center mt-5">
        <button onclick="document.getElementById('main-content').scrollTo({top:0,behavior:'smooth'});"
          class="w-10 h-10 rounded-full glass border border-dream-500/30 flex items-center justify-center text-dream-400 hover:text-dream-200 hover:border-dream-400/50 transition-all">
          <i class="fas fa-arrow-up"></i>
        </button>
      </div>

    </div>`;
}

window.doRealityCheck = async function(type) { try { await api('/reality-checks', { method: 'POST', body: JSON.stringify({ checkType: type, wasDreaming: false }) }); showToast('✅ Reality check enregistré !'); if (state.currentView === 'lucidity-level1') renderLucidity(); else if (state.currentView === 'lucidity') renderDashboard(); } catch {} };

// Quick RC depuis le bouton flottant (type 'general')
window.quickRealityCheck = async function() {
  const btn = document.getElementById('floating-rc-btn');
  if (btn) { btn.style.transform = 'scale(1.2)'; setTimeout(() => btn.style.transform = '', 200); }
  try {
    await api('/reality-checks', { method: 'POST', body: JSON.stringify({ checkType: 'general', wasDreaming: false }) });
    showToast('✅ Check validé !');
    if (state.currentView === 'lucidity-level1') renderLucidity();
    else if (state.currentView === 'lucidity') renderDashboard();
  } catch {}
};

// ========== LECTEUR AUDIO — RÊVE MIEUX (ANCRAGE MUSICAL) ==========
let reveMieuxAudio = null;
let reveMieuxAnimFrame = null;

function syncPlayerUI(playing) {
  // Sync page player (if on lucidity page)
  const icon = document.getElementById('reve-mieux-play-icon');
  const btn = document.getElementById('reve-mieux-play-btn');
  if (playing) {
    if (icon) icon.className = 'fas fa-pause';
    if (btn) btn.classList.add('bg-amber-500/30', 'shadow-lg', 'shadow-amber-500/10');
  } else {
    if (icon) icon.className = 'fas fa-play';
    if (btn) btn.classList.remove('bg-amber-500/30', 'shadow-lg', 'shadow-amber-500/10');
  }
  // Sync floating player
  const fIcon = document.getElementById('floating-play-icon');
  const fBtn = document.getElementById('floating-play-btn');
  if (playing) {
    if (fIcon) fIcon.className = 'fas fa-pause text-sm';
    if (fBtn) fBtn.style.background = 'linear-gradient(135deg,rgba(245,158,11,1),rgba(139,92,246,1))';
  } else {
    if (fIcon) fIcon.className = 'fas fa-play text-sm';
    if (fBtn) fBtn.style.background = 'linear-gradient(135deg,rgba(245,158,11,0.85),rgba(139,92,246,0.85))';
  }
}

window.toggleReveMieuxPlayer = function() {
  if (!reveMieuxAudio) {
    reveMieuxAudio = new Audio('/static/reve-mieux-refrain.mp3');
    reveMieuxAudio.loop = false;
    reveMieuxAudio.addEventListener('ended', () => {
      syncPlayerUI(false);
      const progress = document.getElementById('reve-mieux-progress');
      if (progress) progress.style.width = '0%';
      const timeEl = document.getElementById('reve-mieux-time');
      if (timeEl) timeEl.textContent = '0:00';
      // Reset floating progress ring
      const circle = document.getElementById('floating-progress-circle');
      if (circle) circle.style.strokeDashoffset = '125.66';
      if (reveMieuxAnimFrame) cancelAnimationFrame(reveMieuxAnimFrame);
    });
  }
  if (reveMieuxAudio.paused) {
    reveMieuxAudio.play().then(() => {
      syncPlayerUI(true);
      updateReveMieuxProgress();
    }).catch(() => {});
  } else {
    reveMieuxAudio.pause();
    syncPlayerUI(false);
    if (reveMieuxAnimFrame) cancelAnimationFrame(reveMieuxAnimFrame);
  }
};

function updateReveMieuxProgress() {
  if (!reveMieuxAudio || reveMieuxAudio.paused) return;
  const progress = document.getElementById('reve-mieux-progress');
  const timeEl = document.getElementById('reve-mieux-time');
  const pct = reveMieuxAudio.duration ? (reveMieuxAudio.currentTime / reveMieuxAudio.duration) : 0;
  if (progress) progress.style.width = (pct * 100) + '%';
  if (timeEl) {
    const cur = Math.floor(reveMieuxAudio.currentTime);
    timeEl.textContent = Math.floor(cur / 60) + ':' + String(cur % 60).padStart(2, '0');
  }
  // Update floating progress ring
  const circle = document.getElementById('floating-progress-circle');
  if (circle) {
    const circumference = 125.66; // 2 * PI * 20
    circle.style.strokeDashoffset = circumference * (1 - pct);
  }
  reveMieuxAnimFrame = requestAnimationFrame(updateReveMieuxProgress);
}

// ========== TLR NOCTURNE (Service Worker + Notification Persistante) ==========
let tlrInterval = null;
let tlrSWReady = false;
let tlrNotifInterval = null;

// === Keep-Alive Audio Silencieux ===
// Jouer un audio silencieux en boucle maintient l'app vivante même écran verrouillé.
// C'est LA technique qui garantit que le refrain pourra se jouer automatiquement.
let tlrKeepAliveAudio = null;

function startTLRKeepAlive() {
  if (tlrKeepAliveAudio) return; // Déjà actif
  tlrKeepAliveAudio = new Audio('/static/silence.mp3');
  tlrKeepAliveAudio.loop = true;
  tlrKeepAliveAudio.volume = 0.01; // Volume minimum mais PAS mute (important !)
  // MediaSession pour maintenir le focus audio sur écran verrouillé
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Rêve Mieux — TLR actif',
      artist: 'Rêve Mieux',
      album: 'Déclencheur Lucide'
    });
  }
  tlrKeepAliveAudio.play().catch(err => {
    console.warn('Keep-alive audio failed:', err);
  });
}

function stopTLRKeepAlive() {
  if (tlrKeepAliveAudio) {
    tlrKeepAliveAudio.pause();
    tlrKeepAliveAudio.src = '';
    tlrKeepAliveAudio = null;
  }
}

// Enregistrement du Service Worker
async function registerTLRServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.register('/tlr-sw.js');
    await navigator.serviceWorker.ready;
    tlrSWReady = true;
    return true;
  } catch (err) {
    console.warn('SW registration failed:', err);
    return false;
  }
}

// Écouter les messages du SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'TLR_STOP_FROM_SW') {
      localStorage.setItem('tlr_active', '0');
      stopTLRCounters();
      sendSWMessage({ type: 'TLR_STOP' });
      if (state.currentView === 'lucidity-level1') renderLucidity();
      else if (state.currentView === 'lucidity') renderDashboard();
    }
    if (event.data?.type === 'REALITY_CHECK_FROM_SW') {
      // RC already recorded by SW directly — just update UI
      showToast('✅ Check validé !');
      if (state.currentView === 'lucidity-level1') renderLucidity();
      else if (state.currentView === 'lucidity') renderDashboard();
    }
    if (event.data?.type === 'PLAY_REFRAIN_FROM_SW') {
      // Push serveur TLR : jouer le refrain automatiquement au volume TLR
      setTimeout(() => {
        if (!reveMieuxAudio || reveMieuxAudio.paused) {
          playTLRRefrain();
        }
      }, 300);
    }
  });
}

function sendSWMessage(data) {
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage(data);
}

function getTLRBedtime() { return localStorage.getItem('tlr_bedtime') || '23:00'; }
function saveTLRBedtime(val) { localStorage.setItem('tlr_bedtime', val); }
window.calcTriggerTimeStr = function(bedtime) { const [h,m] = bedtime.split(':').map(Number); return String((h+6)%24).padStart(2,'0') + ':' + String(m).padStart(2,'0'); };

function getTLRTonightOverride() { 
  const data = localStorage.getItem('tlr_tonight');
  if (!data) return '';
  try { 
    const parsed = JSON.parse(data);
    if (parsed.date === new Date().toISOString().split('T')[0]) return parsed.time;
    localStorage.removeItem('tlr_tonight');
    return '';
  } catch { return ''; }
}
function saveTLRTonightOverride(val) { 
  if (!val) { localStorage.removeItem('tlr_tonight'); return; }
  localStorage.setItem('tlr_tonight', JSON.stringify({ time: val, date: new Date().toISOString().split('T')[0] }));
}
window.clearTLRTonightOverride = function() {
  localStorage.removeItem('tlr_tonight');
  const el = document.getElementById('tlr-tonight-override');
  if (el) el.value = '';
};

function getTLRVolume() { return parseInt(localStorage.getItem('tlr_volume') || '1'); }
window.setTLRVolume = function(v) {
  localStorage.setItem('tlr_volume', v);
  document.querySelectorAll('.tlr-vol-btn').forEach(btn => {
    const isActive = parseInt(btn.dataset.vol) === v;
    btn.className = `tlr-vol-btn w-8 h-8 rounded-lg text-xs font-bold border transition-all ${isActive ? 'border-violet-400 bg-violet-600/30 text-violet-200' : 'border-violet-700/20 bg-night-900/40 text-gray-500 hover:text-gray-300'}`;
  });
};

function isTLRActive() { return false; } // TLR automatique désactivé — l'utilisateur utilise son appli Horloge

function getEffectiveBedtime() {
  return getTLRBedtime();
}

// Le cycle TLR est de 24h basé sur le TRIGGER (bedtime + 6h).
// Le trigger est le point de référence : dès qu'il passe, on passe au cycle suivant.
// - 18 premières heures après le trigger : "Tu dois dormir dans X" (countdown vers bedtime)
// - 6 dernières heures (bedtime passé → trigger) : "Tu devrais dormir depuis X" (elapsed depuis bedtime, max 6h)
function getTriggerDate() {
  const bedtimeStr = getEffectiveBedtime();
  const [h, m] = bedtimeStr.split(':').map(Number);
  const now = new Date();
  // Trigger = bedtime + 6h
  const triggerH = (h + 6) % 24;
  const trigger = new Date(now);
  trigger.setHours(triggerH, m, 0, 0);
  // Si le trigger est dans le passé, c'est le trigger d'aujourd'hui qui est passé → prochain trigger = demain
  if (trigger <= now) {
    trigger.setDate(trigger.getDate() + 1);
  }
  return trigger;
}

function getBedtimeDate() {
  // Bedtime = trigger - 6h (toujours 6h avant le prochain trigger)
  const trigger = getTriggerDate();
  return new Date(trigger.getTime() - 6 * 60 * 60 * 1000);
}

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatCountdownHM(ms) {
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h${String(m).padStart(2,'0')}`;
}

// === Web Push pour TLR serveur (fonctionne même téléphone verrouillé) ===
async function subscribeToPush() {
  try {
    if (!('PushManager' in window)) { console.warn('PushManager non supporté'); return false; }
    
    // Récupérer la clé VAPID depuis le serveur
    const vapidResp = await fetch('/api/push/vapid-key', { headers: authHeaders() });
    if (!vapidResp.ok) return false;
    const { publicKey } = await vapidResp.json();
    
    // Convertir la clé VAPID en Uint8Array
    const vapidKeyBytes = Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    
    // S'abonner au Push Manager
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyBytes
      });
    }
    
    // Envoyer la subscription au backend
    const subJSON = subscription.toJSON();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subJSON.endpoint, keys: subJSON.keys })
    });
    
    return true;
  } catch (err) {
    console.warn('Push subscribe failed:', err);
    return false;
  }
}

async function sendTLRScheduleToServer(active) {
  try {
    if (active) {
      // Utiliser l'override "ce soir" s'il existe, sinon le bedtime par défaut
      const tonightOverride = getTLRTonightOverride();
      const bedtime = tonightOverride || getTLRBedtime();
      const triggerTime = calcTriggerTimeStr(bedtime);
      // Convertir en UTC pour le serveur
      const [bh, bm] = bedtime.split(':').map(Number);
      const [th, tm] = triggerTime.split(':').map(Number);
      const now = new Date();
      const offset = now.getTimezoneOffset(); // minutes, ex: -120 pour UTC+2
      const bedUTC_h = ((bh * 60 + bm + offset) / 60 + 24) % 24;
      const trigUTC_h = ((th * 60 + tm + offset) / 60 + 24) % 24;
      const bedUTC = String(Math.floor(bedUTC_h)).padStart(2,'0') + ':' + String(Math.round((bedUTC_h % 1) * 60)).padStart(2,'0');
      const trigUTC = String(Math.floor(trigUTC_h)).padStart(2,'0') + ':' + String(Math.round((trigUTC_h % 1) * 60)).padStart(2,'0');
      
      await fetch('/api/push/tlr-schedule', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedtime: bedUTC, triggerTime: trigUTC, active: true })
      });
    } else {
      await fetch('/api/push/tlr-schedule', {
        method: 'DELETE',
        headers: authHeaders()
      });
    }
  } catch (err) {
    console.warn('TLR schedule sync failed:', err);
  }
}

function authHeaders() {
  return state.token ? { 'Authorization': 'Bearer ' + state.token } : {};
}

window.toggleTLR = async function() {
  if (isTLRActive()) {
    // Désactiver
    localStorage.setItem('tlr_active', '0');
    stopTLRCounters();
    stopTLRKeepAlive(); // Arrêter l'audio silencieux keep-alive
    sendSWMessage({ type: 'TLR_STOP' });
    
    // Désactiver le schedule serveur
    sendTLRScheduleToServer(false);
    
    const btn = document.getElementById('tlr-toggle-btn');
    if (btn) {
      btn.className = 'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 bg-gradient-to-r from-violet-600 to-dream-600 text-white hover:from-violet-500 hover:to-dream-500';
      btn.innerHTML = '<i class="fas fa-moon"></i> Activer TLR Nocturne';
    }
    const counters = document.getElementById('tlr-counters');
    if (counters) counters.classList.add('hidden');
    showToast('TLR nocturne désactivé');
  } else {
    // Activer : enregistrer SW + demander permission notifs + push subscribe
    localStorage.setItem('tlr_active', '1');
    
    // Enregistrer le Service Worker
    await registerTLRServiceWorker();
    
    // Demander la permission de notification
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      await Notification.requestPermission();
    }
    
    // S'abonner au Web Push (pour le trigger serveur)
    const pushOk = await subscribeToPush();
    
    // Envoyer le schedule au serveur
    await sendTLRScheduleToServer(true);
    
    // Démarrer l'audio silencieux keep-alive (maintient l'app vivante écran verrouillé)
    startTLRKeepAlive();
    
    startTLRCounters();
    
    const btn = document.getElementById('tlr-toggle-btn');
    if (btn) {
      btn.className = 'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 bg-violet-600/40 text-violet-200 border border-violet-400/50 shadow-lg shadow-violet-500/10';
      btn.innerHTML = '<i class="fas fa-stop"></i> Désactiver TLR';
    }
    const counters = document.getElementById('tlr-counters');
    if (counters) counters.classList.remove('hidden');
    
    const notifOk = ('Notification' in window && Notification.permission === 'granted');
    showToast(notifOk && pushOk
      ? 'TLR activé ! Le refrain se déclenchera automatiquement, même téléphone verrouillé.' 
      : notifOk
        ? 'TLR activé ! Le déclencheur fonctionne quand l\'app est ouverte.'
        : 'TLR activé ! Autorisez les notifications pour le déclencheur automatique.');
  }
};

function startTLRCounters() {
  stopTLRCounters();
  updateTLRDisplay();
  tlrInterval = setInterval(updateTLRDisplay, 1000);
  // Mettre à jour la notification SW toutes les 30s
  updateSWNotification();
  tlrNotifInterval = setInterval(updateSWNotification, 30000);
}

function stopTLRCounters() {
  if (tlrInterval) { clearInterval(tlrInterval); tlrInterval = null; }
  if (tlrNotifInterval) { clearInterval(tlrNotifInterval); tlrNotifInterval = null; }
}

function restartTLRCounters() { stopTLRCounters(); startTLRCounters(); }

function updateSWNotification() {
  if (!isTLRActive()) return;
  // Envoyer les timestamps absolus + token au SW pour qu'il calcule les countdowns et enregistre les RC en autonomie
  sendSWMessage({
    type: 'TLR_UPDATE',
    bedtimeTimestamp: getBedtimeDate().getTime(),
    triggerTimestamp: getTriggerDate().getTime(),
    token: state.token
  });
}

let tlrTriggered = false;
function updateTLRDisplay() {
  const now = new Date();
  const trigger = getTriggerDate();
  const bed = getBedtimeDate();

  const sleepEl = document.getElementById('tlr-sleep-countdown');
  const sleepLabel = document.getElementById('tlr-sleep-label');
  const triggerEl = document.getElementById('tlr-trigger-countdown');
  const statusEl = document.getElementById('tlr-status-msg');

  const triggerDiff = trigger - now; // toujours > 0 (prochain trigger est dans le futur)
  const sleepDiff = bed - now;       // > 0 = pas encore l'heure de dormir, < 0 = bedtime passé

  // Le trigger countdown est toujours un compte à rebours (max ~24h)
  if (triggerEl) {
    triggerEl.textContent = formatCountdown(Math.max(0, triggerDiff));
    triggerEl.className = triggerDiff <= 6 * 3600000 ? 'text-sm font-mono font-bold text-amber-200 animate-pulse' : 'text-sm font-mono font-bold text-amber-300';
  }

  // Le sleep label bascule entre countdown (max 18h) et elapsed (max 6h)
  if (sleepEl) {
    if (sleepDiff > 0) {
      // Bedtime pas encore atteint → countdown (max 18h)
      if (sleepLabel) sleepLabel.textContent = 'Tu dois dormir dans';
      sleepEl.textContent = formatCountdown(Math.min(sleepDiff, 18 * 3600000));
      sleepEl.className = 'text-sm font-mono font-bold text-violet-300';
    } else {
      // Bedtime passé → elapsed depuis bedtime (max 6h)
      const elapsed = Math.min(Math.abs(sleepDiff), 6 * 3600000);
      if (sleepLabel) sleepLabel.textContent = 'Tu devrais dormir depuis';
      sleepEl.textContent = formatCountdown(elapsed);
      sleepEl.className = 'text-sm font-mono font-bold text-amber-300';
    }
  }

  if (statusEl) {
    if (sleepDiff > 0) {
      statusEl.textContent = 'En attente. Le refrain se jouera automatiquement à l\'heure prévue.';
    } else if (triggerDiff > 30000) {
      statusEl.textContent = 'Vous devriez dormir. Le déclencheur arrivera dans votre sommeil paradoxal.';
    } else {
      statusEl.textContent = 'Le refrain se joue... Faites de beaux rêves lucides.';
    }
  }

  // Auto-play du refrain quand le trigger est atteint (triggerDiff < 1s = trigger now)
  // Note: triggerDiff est toujours positif mais quand il approche 0 avant le reset du cycle
  // On utilise un seuil de 2s pour éviter les races
  const triggerNow = triggerDiff <= 2000 && triggerDiff >= 0;
  if (!tlrTriggered && isTLRActive() && now >= new Date(trigger.getTime() - 2000) && now <= trigger) {
    // Ne rien faire — le trigger est dans ~2s
  }
  // Check if we just passed a trigger point (within last 60s)
  const lastTrigger = new Date(trigger.getTime() - 24 * 3600000); // trigger précédent
  const sinceLast = now - lastTrigger;
  if (sinceLast >= 0 && sinceLast < 60000 && !tlrTriggered && isTLRActive()) {
    tlrTriggered = true;
    playTLRRefrain();
  }
  if (sinceLast >= 60000) tlrTriggered = false;
}

function playTLRRefrain() {
  // Pauser le keep-alive silencieux — le refrain doit être le dernier media joué
  // (important pour que Android maintienne le focus audio sur le refrain)
  if (tlrKeepAliveAudio && !tlrKeepAliveAudio.paused) {
    tlrKeepAliveAudio.pause();
  }

  if (!reveMieuxAudio) {
    reveMieuxAudio = new Audio('/static/reve-mieux-refrain.mp3');
    reveMieuxAudio.loop = false;
    reveMieuxAudio.addEventListener('ended', () => {
      const icon = document.getElementById('reve-mieux-play-icon');
      const btn = document.getElementById('reve-mieux-play-btn');
      if (icon) icon.className = 'fas fa-play';
      if (btn) btn.classList.remove('bg-amber-500/30', 'shadow-lg', 'shadow-amber-500/10');
      const progress = document.getElementById('reve-mieux-progress');
      if (progress) progress.style.width = '0%';
      const timeEl = document.getElementById('reve-mieux-time');
      if (timeEl) timeEl.textContent = '0:00';
      if (reveMieuxAnimFrame) cancelAnimationFrame(reveMieuxAnimFrame);
      // Relancer le keep-alive silencieux après que le refrain a fini
      if (isTLRActive() && tlrKeepAliveAudio) {
        tlrKeepAliveAudio.play().catch(() => {});
      }
    });
  }
  // Appliquer le volume TLR choisi par l'utilisateur
  const volumeMap = { 1: 0.03, 2: 0.08, 3: 0.15 };
  reveMieuxAudio.volume = volumeMap[getTLRVolume()] || 0.03;
  reveMieuxAudio.currentTime = 0; // Toujours repartir du début
  reveMieuxAudio.play().then(() => {
    syncPlayerUI(true);
    updateReveMieuxProgress();
    // Notification trigger via SW
    sendSWMessage({ type: 'TLR_TRIGGER' });
    // MediaSession pour le refrain (affiché sur écran verrouillé)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Rêve Mieux — Déclencheur Lucide',
        artist: 'Rêve Mieux',
        album: 'Rêve Lucide'
      });
    }
  }).catch(() => {
    // Auto-play bloqué — relancer le keep-alive
    if (isTLRActive() && tlrKeepAliveAudio) {
      tlrKeepAliveAudio.play().catch(() => {});
    }
    sendSWMessage({ type: 'TLR_TRIGGER' });
  });
}

// TLR Nocturne est maintenant un guide manuel (alarme téléphone).
// Plus de SW, keep-alive ou push serveur.
// Le code d'ancrage musical (écoute du refrain) reste actif.

// ========== MODAL & TOAST ==========
function showModal(content, maxWidth, flex) {
  const container = document.getElementById('modal-container');
  container.innerHTML = `<div class="modal-overlay animate-fadeIn" onclick="if(event.target===this) closeModal()"><div class="modal-content${flex ? ' modal-flex' : ''} animate-slideUp" style="${maxWidth ? 'max-width:' + maxWidth : ''}">${content}</div></div>`;
}
window.closeModal = function() { document.getElementById('modal-container').innerHTML = ''; };
function showToast(msg) { const t = document.createElement('div'); t.className = 'fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 glass px-5 py-2.5 rounded-xl text-xs text-dream-200 animate-slideUp max-w-[90vw] text-center'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 4000); }

// ========== UTILITIES ==========
function escapeHtml(str) { if (!str) return ''; const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

function autoGrowTextarea(el) { el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight, 80) + 'px'; }

// ========== INIT ==========
checkAuth();

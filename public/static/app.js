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
  filters: { type: 'all', search: '', tagIds: [] }
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
          <div id="register-fields" class="hidden">
            <input type="text" name="username" placeholder="Nom d'utilisateur" class="w-full mb-3 px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none transition-colors">
            <input type="text" name="displayName" placeholder="Nom affiché (optionnel)" class="w-full mb-3 px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none transition-colors">
          </div>
          <input type="email" name="login" placeholder="Email" required class="w-full mb-3 px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none transition-colors">
          <input type="password" name="password" placeholder="Mot de passe" required minlength="6" class="w-full mb-4 px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none transition-colors">
          <div id="auth-error" class="text-red-300 text-sm mb-3 hidden px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg"></div>
          <button type="submit" id="auth-btn" class="w-full py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg font-semibold hover:from-dream-400 hover:to-dream-600 transition-all shadow-lg shadow-dream-500/20">Se connecter</button>
        </form>
        <div class="mt-6 p-3 bg-dream-900/20 rounded-lg border border-dream-700/20">
          <p class="text-xs text-gray-400 text-center"><i class="fas fa-flask mr-1"></i>Basé sur les recherches de Schredl (2002), LaBerge (1985) et Stumbrys et al. (2012).</p>
        </div>
      </div>
    </div>`;
}

let authMode = 'login';
window.showAuthTab = function(mode) {
  authMode = mode;
  document.getElementById('tab-login').className = `flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'login' ? 'bg-dream-600 text-white' : 'text-gray-400 hover:text-white'}`;
  document.getElementById('tab-register').className = `flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'register' ? 'bg-dream-600 text-white' : 'text-gray-400 hover:text-white'}`;
  document.getElementById('register-fields').classList.toggle('hidden', mode === 'login');
  const usernameField = document.querySelector('input[name="username"]');
  if (usernameField) usernameField.required = (mode === 'register');
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
      const username = form.get('username') || email.split('@')[0];
      data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, username, password: form.get('password'), displayName: form.get('displayName') || username })});
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
            <button onclick="navigate('lucidity')" data-nav="lucidity" class="nav-tab px-3 py-2 rounded-lg text-sm font-medium transition-all"><i class="fas fa-eye mr-1"></i>Lucidité</button>
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
        <div class="flex justify-around items-end py-1.5 px-1">
          <button onclick="navigate('journal')" data-nav="journal" class="nav-tab flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all min-w-[48px]">
            <i class="fas fa-book-open text-base"></i><span>Journal</span>
          </button>
          <button onclick="openDreamEditor()" class="flex flex-col items-center -mt-4">
            <div class="w-12 h-12 bg-gradient-to-br from-dream-400 to-dream-600 rounded-full shadow-lg shadow-dream-500/30 flex items-center justify-center text-white text-lg animate-glow">
              <i class="fas fa-plus"></i>
            </div>
          </button>
          <button onclick="navigate('series')" data-nav="series" class="nav-tab flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all min-w-[48px]">
            <i class="fas fa-layer-group text-base"></i><span>Séries</span>
          </button>
          <button onclick="navigate('lucidity')" data-nav="lucidity" class="nav-tab flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all min-w-[48px]">
            <i class="fas fa-eye text-base"></i><span>Lucidité</span>
          </button>
        </div>
      </nav>

      <!-- Desktop FAB -->
      <button onclick="openDreamEditor()" id="fab-add" class="hidden sm:flex fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-dream-400 to-dream-600 rounded-full shadow-lg shadow-dream-500/30 items-center justify-center text-white text-xl hover:scale-110 transition-transform animate-glow">
        <i class="fas fa-plus"></i>
      </button>
    </div>
    <div id="modal-container"></div>
  `;
  navigate(state.currentView);
}

window.navigate = function(view) {
  state.currentView = view;
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === view);
    btn.classList.toggle('text-dream-300', btn.dataset.nav === view);
    btn.classList.toggle('text-gray-400', btn.dataset.nav !== view);
  });
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="flex justify-center py-12"><div class="animate-spin text-dream-400 text-2xl"><i class="fas fa-circle-notch"></i></div></div>';
  switch (view) {
    case 'journal': renderJournal(); break;
    case 'series': renderSeries(); break;
    case 'lucidity': renderLucidity(); break;
  }
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
    if (state.filters.search) params.set('search', state.filters.search);
    if (state.filters.tagIds.length > 0) params.set('tags', state.filters.tagIds.join(','));
    const data = await api(`/dreams?${params}`);
    state.dreams = data.dreams; state.pagination = data.pagination;
  } catch (err) { main.innerHTML = `<div class="text-center py-12 text-red-400">${err.message}</div>`; return; }

  const activeFilterCount = state.filters.tagIds.length + (state.filters.type !== 'all' ? 1 : 0);

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

  main.innerHTML = `
    <div class="animate-slideUp">
      <div class="flex flex-col gap-3 mb-5">
        <div class="relative">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
          <input type="text" id="search-input" value="${state.filters.search}" placeholder="Rechercher dans vos rêves..."
            class="w-full pl-10 pr-4 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-xl text-white text-sm placeholder-gray-500 focus:border-dream-400 focus:outline-none"
            oninput="debounceSearch(this.value)">
        </div>
        <div class="flex gap-2 items-center flex-wrap">
          <select onchange="filterType(this.value)" class="flex-1 sm:flex-none px-3 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-xl text-gray-300 text-sm focus:border-dream-400 focus:outline-none appearance-auto">
            <option value="all" ${state.filters.type === 'all' ? 'selected' : ''}>Tous les types</option>
            <option value="normal" ${state.filters.type === 'normal' ? 'selected' : ''}>🌀 Normal</option>
            <option value="lucid" ${state.filters.type === 'lucid' ? 'selected' : ''}>✨ Lucide</option>
            <option value="nightmare" ${state.filters.type === 'nightmare' ? 'selected' : ''}>👹 Cauchemar</option>
            <option value="recurring" ${state.filters.type === 'recurring' ? 'selected' : ''}>🔄 Récurrent</option>
            <option value="hypnagogic" ${state.filters.type === 'hypnagogic' ? 'selected' : ''}>🌊 Hypnagogique</option>
            <option value="false_awakening" ${state.filters.type === 'false_awakening' ? 'selected' : ''}>🪞 Faux éveil</option>
          </select>
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
        <!-- Active tag filters display -->
        ${state.filters.tagIds.length > 0 ? `
        <div class="flex flex-wrap gap-1 items-center">
          <span class="text-[9px] text-gray-500 mr-1">Filtres actifs :</span>
          ${state.filters.tagIds.map(tid => {
            const tag = Object.values(groupedTags).flat().find(t => t.id === tid);
            return tag ? `<span class="px-1.5 py-0.5 rounded-full text-[9px] font-medium flex items-center gap-1" style="background:${tag.color}30; color:${tag.color}; border:1px solid ${tag.color}50">${escapeHtml(tag.name)} <i class="fas fa-times cursor-pointer text-[7px] opacity-60 hover:opacity-100" onclick="toggleTagFilter(${tid})"></i></span>` : '';
          }).join('')}
        </div>` : ''}
      </div>

      <!-- Expandable filter panel -->
      <div id="filter-panel" class="hidden mb-4 glass rounded-xl p-3 animate-slideUp">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-semibold text-dream-200"><i class="fas fa-filter mr-1.5"></i>Filtrer par tags</h4>
          <button onclick="toggleFilterPanel()" class="text-gray-400 hover:text-white text-xs"><i class="fas fa-times"></i></button>
        </div>
        ${hasAnyTags ? tagFilterHTML : '<p class="text-[10px] text-gray-500 italic py-2 text-center">Aucun tag créé. Ajoutez des tags à vos rêves pour les utiliser comme filtres.</p>'}
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
  const typeIcons = { normal: '🌀', lucid: '✨', nightmare: '👹', recurring: '🔄', hypnagogic: '🌊', false_awakening: '🪞' };
  const typeLabels = { normal: 'Normal', lucid: 'Lucide', nightmare: 'Cauchemar', recurring: 'Récurrent', hypnagogic: 'Hypnago.', false_awakening: 'Faux éveil' };
  const emotionEmojis = { joy: '😊', fear: '😨', anxiety: '😰', wonder: '🤩', sadness: '😢', anger: '😡', confusion: '😵', peace: '😌', excitement: '🤯', love: '💗', nostalgia: '🥺' };
  const emotionLabels = { joy: 'Joie', fear: 'Peur', anxiety: 'Anxiété', wonder: 'Émerveillement', sadness: 'Tristesse', anger: 'Colère', confusion: 'Confusion', peace: 'Paix', excitement: 'Excitation', love: 'Amour', nostalgia: 'Nostalgie' };
  const dateStr = new Date(d.dream_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const preview = d.content.length > 150 ? d.content.substring(0, 150) + '...' : d.content;
  // Émotion dominante (la plus intense)
  const topEmotion = d.emotions?.length ? d.emotions.reduce((best, e) => (!best || e.intensity > best.intensity) ? e : best, null) : null;
  return `
    <div class="glass rounded-xl p-3 sm:p-4 hover:border-dream-400/30 transition-all cursor-pointer animate-fadeIn group" style="user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;" onclick="openDreamDetail(${d.id})">
      <div class="flex items-start gap-2.5">
        <div class="text-xl mt-0.5 shrink-0">${typeIcons[d.dream_type] || '🌀'}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 mb-1 flex-wrap">
            <h3 class="font-semibold text-dream-100 text-sm truncate max-w-[55vw] sm:max-w-none">${escapeHtml(d.title)}</h3>
            ${d.is_favorite ? '<i class="fas fa-star text-yellow-400 text-[10px]"></i>' : ''}
          </div>
          <div class="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span class="badge-${d.dream_type} text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium">${typeLabels[d.dream_type] || 'Normal'}</span>
            ${d.lucidity_level > 0 ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-600/30 text-emerald-300">Lucidité ${d.lucidity_level}/5</span>` : ''}
            ${d.clarity ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-600/25 text-blue-300">Clarté ${d.clarity}/5</span>` : ''}
            ${topEmotion ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-dream-800/30 text-dream-200">${emotionEmojis[topEmotion.emotion] || ''} ${emotionLabels[topEmotion.emotion] || topEmotion.emotion} ${topEmotion.intensity}/5</span>` : ''}
          </div>
          <p class="text-xs text-gray-400 mb-2 line-clamp-2">${escapeHtml(preview)}</p>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[10px] text-gray-500"><i class="far fa-calendar mr-1"></i>${dateStr}</span>
            ${d.tags?.length ? `<div class="flex gap-1 flex-wrap">${d.tags.slice(0, 3).map(t => `<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-dream-800/40 text-dream-300">${escapeHtml(t.name)}</span>`).join('')}${d.tags.length > 3 ? `<span class="text-[9px] text-gray-500">+${d.tags.length - 3}</span>` : ''}</div>` : ''}
          </div>
        </div>
        <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
          <button onclick="event.stopPropagation(); openDreamEditor(${d.id})" class="p-1.5 text-gray-400 hover:text-dream-300"><i class="fas fa-edit text-xs"></i></button>
          <button onclick="event.stopPropagation(); deleteDream(${d.id})" class="p-1.5 text-gray-400 hover:text-red-400"><i class="fas fa-trash text-xs"></i></button>
        </div>
      </div>
    </div>`;
}

let searchTimeout;
window.debounceSearch = function(val) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { state.filters.search = val; state.pagination.page = 1; renderJournal(); }, 400); };
window.filterType = function(val) { state.filters.type = val; state.pagination.page = 1; renderJournal(); };
window.goToPage = function(p) { state.pagination.page = p; renderJournal(); };

// Tag-based filtering
window.toggleTagFilter = function(tagId) {
  const idx = state.filters.tagIds.indexOf(tagId);
  if (idx >= 0) { state.filters.tagIds.splice(idx, 1); } else { state.filters.tagIds.push(tagId); }
  state.pagination.page = 1;
  renderJournal();
};

window.toggleFilterPanel = function() {
  const panel = document.getElementById('filter-panel');
  if (panel) panel.classList.toggle('hidden');
};

window.clearAllFilters = function() {
  state.filters.type = 'all';
  state.filters.search = '';
  state.filters.tagIds = [];
  state.pagination.page = 1;
  renderJournal();
};

// ========== DREAM DETAIL ==========
window.openDreamDetail = async function(id) {
  try { const dream = await api(`/dreams/${id}`); showModal(renderDreamDetailModal(dream)); } catch (err) { alert(err.message); }
};

function renderDreamDetailModal(d) {
  const typeLabels = { normal: 'Normal', lucid: 'Lucide', nightmare: 'Cauchemar', recurring: 'Récurrent', hypnagogic: 'Hypnagogique', false_awakening: 'Faux éveil' };
  const emotionEmojis = { joy: '😊', fear: '😨', anxiety: '😰', wonder: '🤩', sadness: '😢', anger: '😡', confusion: '😵', peace: '😌', excitement: '🤯', love: '💗', nostalgia: '🥺' };
  const dateStr = new Date(d.dream_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `
    <div class="p-4 sm:p-6">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="badge-${d.dream_type} text-[10px] px-2 py-1 rounded-full text-white font-medium">${typeLabels[d.dream_type] || 'Normal'}</span>
          ${d.lucidity_level > 0 ? `<span class="text-[10px] px-2 py-1 rounded-full bg-emerald-600/30 text-emerald-300">Lucidité ${d.lucidity_level}/5</span>` : ''}
          ${d.is_favorite ? '<i class="fas fa-star text-yellow-400"></i>' : ''}
        </div>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white p-1"><i class="fas fa-times"></i></button>
      </div>
      <h2 class="text-xl font-display font-bold text-dream-100 mb-2">${escapeHtml(d.title)}</h2>
      <p class="text-xs text-gray-400 mb-4"><i class="far fa-calendar mr-1"></i>${dateStr}</p>
      <div class="mb-5"><p class="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">${escapeHtml(d.content)}</p></div>

      ${d.phases?.length ? `
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
      </div>` : ''}

      ${d.interpretations?.length ? `
      <div class="mb-4">
        <h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2"><i class="fas fa-lightbulb mr-1"></i>Interprétations</h4>
        <div class="space-y-1.5">
          ${d.interpretations.map(interp => `<div class="p-2.5 rounded-lg bg-amber-900/10 border border-amber-500/10"><p class="text-xs text-amber-200/90 italic">${escapeHtml(interp.content)}</p></div>`).join('')}
        </div>
      </div>` : ''}

      ${d.wished_continuation ? `
      <div class="mb-4">
        <h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2"><i class="fas fa-moon mr-1 text-indigo-400/60"></i>Suite souhaitée</h4>
        <div class="p-3 rounded-lg bg-indigo-900/15 border border-indigo-500/15">
          <p class="text-xs text-indigo-200/90 leading-relaxed whitespace-pre-wrap">${escapeHtml(d.wished_continuation)}</p>
        </div>
      </div>` : ''}

      ${d.emotions?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Émotions globales</h4><div class="flex flex-wrap gap-1.5">${d.emotions.map(e => `<span class="flex items-center gap-1 px-2 py-1 rounded-full bg-dream-800/30 text-xs">${emotionEmojis[e.emotion] || ''} <span class="text-dream-200 capitalize">${e.emotion}</span> <span class="text-[9px] text-gray-500">${e.intensity}/5</span></span>`).join('')}</div></div>` : ''}
      ${d.tags?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Tags</h4><div class="flex flex-wrap gap-1.5">${d.tags.map(t => `<span class="px-2 py-1 rounded-full text-[10px] font-medium" style="background:${t.color}20; color:${t.color}; border: 1px solid ${t.color}40">${escapeHtml(t.name)}</span>`).join('')}</div></div>` : ''}
      ${d.connections?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Connexions</h4><div class="space-y-1">${d.connections.map(cn => `<div class="flex items-center gap-2 p-2 rounded-lg bg-night-900/40 cursor-pointer hover:bg-night-900/60" onclick="closeModal(); setTimeout(() => openDreamDetail(${cn.connected_dream_id}), 300)"><i class="fas fa-link text-dream-400 text-xs"></i><span class="text-xs text-dream-200">${escapeHtml(cn.connected_dream_title)}</span><span class="text-[9px] text-gray-500 capitalize">${cn.connection_type}</span></div>`).join('')}</div></div>` : ''}
      ${d.series?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Séries</h4><div class="flex flex-wrap gap-1.5">${d.series.map(s => `<span class="px-2 py-1 rounded-full text-[10px] font-medium" style="background:${s.color}20; color:${s.color}">${escapeHtml(s.name)}</span>`).join('')}</div></div>` : ''}
      <div class="flex gap-2 pt-3 border-t border-dream-700/20">
        <button onclick="closeModal(); openDreamEditor(${d.id})" class="flex-1 py-2 bg-dream-600/30 text-dream-300 rounded-lg hover:bg-dream-600/50 transition-all text-xs font-medium"><i class="fas fa-edit mr-1"></i>Modifier</button>
        <button onclick="toggleFavorite(${d.id}, ${d.is_favorite})" class="py-2 px-3 bg-night-800/50 text-gray-300 rounded-lg hover:bg-night-800/70 transition-all text-sm"><i class="${d.is_favorite ? 'fas' : 'far'} fa-star text-yellow-400"></i></button>
      </div>
    </div>`;
}

// ========== DREAM EDITOR ==========
const DREAM_TYPES = [
  { value: 'normal', icon: '🌀', label: 'Normal' },
  { value: 'lucid', icon: '✨', label: 'Lucide' },
  { value: 'nightmare', icon: '👹', label: 'Cauchemar' },
  { value: 'recurring', icon: '🔄', label: 'Récurrent' },
  { value: 'hypnagogic', icon: '🌊', label: 'Hypnago.' },
  { value: 'false_awakening', icon: '🪞', label: 'Faux éveil' }
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
  let allTags = [], allSeries = [];
  try { allTags = (await api('/tags')).tags; } catch {}
  try { allSeries = (await api('/series')).series; } catch {}
  if (id) { try { dream = await api(`/dreams/${id}`); } catch {} }

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
    interpretations: existingInterpretations.map(i => i.content)
  };
  window._allTags = allTags;

  showModal(`
    <div class="p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-display font-bold text-dream-100">${dream ? 'Modifier le rêve' : '🌙 Nouveau rêve'}</h2>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white p-1"><i class="fas fa-times"></i></button>
      </div>
      <form onsubmit="saveDream(event, ${id || 'null'})" id="dream-form">
        <input type="text" name="title" value="${dream ? escapeHtml(dream.title) : ''}" placeholder="Titre du rêve..." required
          class="w-full mb-3 px-3 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-lg text-white font-medium placeholder-gray-500 focus:border-dream-400 focus:outline-none text-sm">
        <div class="mb-3">
          <textarea name="content" rows="3" placeholder="Récit global du rêve..." required
            class="w-full px-3 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-sm placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none">${dream ? escapeHtml(dream.content) : ''}</textarea>
        </div>

        <!-- Date -->
        <div class="mb-3">
          <label class="text-[10px] text-gray-400 mb-1 block">Date du rêve</label>
          <input type="date" name="dreamDate" value="${dream?.dream_date || new Date().toISOString().split('T')[0]}"
            class="w-full px-3 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white focus:border-dream-400 focus:outline-none text-sm">
        </div>

        <!-- Type de rêve — BOUTONS -->
        <div class="mb-3">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Type de rêve</label>
          <div class="grid grid-cols-3 gap-1.5" id="dream-type-picker">
            ${DREAM_TYPES.map(t => `
              <button type="button" onclick="selectDreamType('${t.value}')" data-type="${t.value}"
                class="dream-type-btn flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium border transition-all ${currentType === t.value ? 'border-dream-400 bg-dream-600/30 text-dream-200' : 'border-dream-700/20 bg-night-900/40 text-gray-400 hover:text-gray-200 hover:border-dream-700/40'}">
                <span>${t.icon}</span><span>${t.label}</span>
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
            ${EMOTION_LIST.map(em => `
              <button type="button" onclick="toggleEmotion('${em}')" id="em-${em}"
                class="emotion-btn px-2 py-1 rounded-full text-xs border transition-all ${selectedEmotions[em] ? 'border-dream-400 bg-dream-600/30 text-dream-200 selected' : 'border-dream-700/30 bg-night-900/40 text-gray-400'}">
                ${EMOTION_EMOJIS[em]} ${EMOTION_LABELS[em]}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Tags -->
        <div class="mb-4">
          <label class="text-[10px] text-gray-400 mb-1.5 block">Tags</label>
          <div id="selected-tags" class="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
            ${selectedTags.length ? selectedTags.map(t => renderTagChip(t)).join('') : '<span class="text-[10px] text-gray-600 italic">Aucun tag</span>'}
          </div>
          ${allTags.length ? `
          <div class="mb-2">
            <span class="text-[9px] text-gray-500 mb-1 block">Tags existants :</span>
            <div class="flex flex-wrap gap-1 p-2 bg-night-900/30 rounded-lg border border-dream-700/10 max-h-28 overflow-y-auto">
              ${allTags.map(t => `
                <button type="button" onclick="pickExistingTag(${t.id})"
                  id="pick-tag-${t.id}"
                  class="existing-tag-btn px-2 py-0.5 rounded-full text-[10px] transition-all cursor-pointer ${selectedTags.find(st => st.name === t.name) ? 'opacity-40 pointer-events-none' : 'hover:scale-105'}"
                  style="background:${t.color}15; color:${t.color}; border: 1px solid ${t.color}30"
                  ${selectedTags.find(st => st.name === t.name) ? 'disabled' : ''}>
                  ${TAG_CATEGORIES.find(c => c.value === t.category)?.icon || '🏷️'} ${escapeHtml(t.name)}
                </button>
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

        <!-- ========== SUITE SOUHAITÉE (INCUBATION) ========== -->
        <div class="mb-4 border border-indigo-700/20 rounded-lg p-3 bg-indigo-900/10" id="dream-continuation-section">
          <div class="flex items-center gap-2 mb-2">
            <i class="fas fa-moon text-indigo-400/70 text-xs"></i>
            <label class="text-[10px] text-gray-400 font-semibold uppercase">Suite souhaitée pour ce rêve</label>
          </div>
          <p class="text-[9px] text-gray-500 mb-2">Décrivez ce que vous aimeriez qu'il se passe ensuite. Relisez-le avant de dormir pour orienter vos prochains rêves.</p>
          <textarea name="wishedContinuation" rows="3" placeholder="Quelle suite imaginez-vous pour ce rêve ? Décrivez la scène, les actions, les sensations..."
            class="w-full px-3 py-2 bg-night-900/60 border border-indigo-700/25 rounded-lg text-white text-xs placeholder-gray-500 focus:border-indigo-400 focus:outline-none resize-none">${dream?.wished_continuation ? escapeHtml(dream.wished_continuation) : ''}</textarea>
        </div>

        <div id="save-error" class="text-red-400 text-sm mb-3 hidden"></div>
        <button type="submit" class="w-full py-2.5 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg font-semibold hover:from-dream-400 hover:to-dream-600 transition-all text-sm">
          <i class="fas fa-save mr-2"></i>${dream ? 'Enregistrer' : 'Enregistrer ce rêve'}
        </button>
      </form>
    </div>
  `, '650px');
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
      <textarea rows="2" placeholder="Que se passe-t-il dans cette scène ?"
        class="w-full px-2 py-1.5 bg-night-900/60 border border-dream-700/20 rounded text-white text-xs placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none mb-2"
        oninput="updatePhase(${idx}, 'content', this.value)">${escapeHtml(phase.content || '')}</textarea>
      <div class="mb-1.5">
        <span class="text-[9px] text-gray-500">Émotions :</span>
        <div class="flex flex-wrap gap-1 mt-1">
          ${EMOTION_LIST.map(em => `
            <button type="button" onclick="togglePhaseEmotion(${idx}, '${em}')" id="phase-em-${idx}-${em}"
              class="px-1.5 py-0.5 rounded-full text-[9px] border transition-all ${phase.emotions?.[em] ? 'border-dream-400 bg-dream-600/30 text-dream-200' : 'border-dream-700/20 bg-night-900/40 text-gray-500'}">
              ${EMOTION_EMOJIS[em]}
            </button>
          `).join('')}
        </div>
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
  if (phase.emotions[em]) delete phase.emotions[em]; else phase.emotions[em] = 3;
  const btn = document.getElementById(`phase-em-${idx}-${em}`);
  if (btn) {
    const isSelected = !!phase.emotions[em];
    btn.className = `px-1.5 py-0.5 rounded-full text-[9px] border transition-all ${isSelected ? 'border-dream-400 bg-dream-600/30 text-dream-200' : 'border-dream-700/20 bg-night-900/40 text-gray-500'}`;
  }
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
    btn.className = `dream-type-btn flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium border transition-all ${isSelected ? 'border-dream-400 bg-dream-600/30 text-dream-200' : 'border-dream-700/20 bg-night-900/40 text-gray-400 hover:text-gray-200 hover:border-dream-700/40'}`;
  });
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
  if (window._editorState.emotions[em]) { delete window._editorState.emotions[em]; } else { window._editorState.emotions[em] = 3; }
  const btn = document.getElementById(`em-${em}`);
  const isSelected = !!window._editorState.emotions[em];
  btn.className = `emotion-btn px-2 py-1 rounded-full text-xs border transition-all ${isSelected ? 'border-dream-400 bg-dream-600/30 text-dream-200 selected' : 'border-dream-700/30 bg-night-900/40 text-gray-400'}`;
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
    closeModal();
    const tagCount = body.tags?.length || 0;
    showToast(id ? 'Rêve mis à jour' + (tagCount ? ' (' + tagCount + ' tag' + (tagCount > 1 ? 's' : '') + ')' : '') : 'Rêve enregistré !');
    if (state.currentView === 'journal') renderJournal();
    else if (state.currentView === 'series') renderSeries();
    else renderJournal();
  } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
};

window.deleteDream = async function(id) {
  if (!confirm('Supprimer ce rêve ? Cette action est irréversible.')) return;
  try { await api(`/dreams/${id}`, { method: 'DELETE' }); renderJournal(); } catch (err) { alert(err.message); }
};

window.toggleFavorite = async function(id, current) {
  try {
    const dream = await api(`/dreams/${id}`);
    dream.isFavorite = !current; dream.dreamDate = dream.dream_date; dream.dreamType = dream.dream_type;
    dream.lucidityLevel = dream.lucidity_level; dream.sleepQuality = 0;
    await api(`/dreams/${id}`, { method: 'PUT', body: JSON.stringify(dream) });
    closeModal(); openDreamDetail(id);
  } catch (err) { alert(err.message); }
};

// ========== SERIES VIEW ==========
async function renderSeries() {
  const main = document.getElementById('main-content');
  try { const data = await api('/series'); state.series = data.series; } catch (err) { main.innerHTML = `<div class="text-center py-12 text-red-400">${err.message}</div>`; return; }
  main.innerHTML = `
    <div class="animate-slideUp">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-base font-display font-semibold text-dream-200"><i class="fas fa-layer-group mr-2"></i>Séries</h2>
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
                <div class="w-3 h-3 rounded-full shrink-0" style="background:${s.color}"></div>
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
          <div class="flex items-center gap-2"><div class="w-4 h-4 rounded-full" style="background:${series.color}"></div><h2 class="text-lg font-display font-bold text-dream-100">${escapeHtml(series.name)}</h2></div>
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
          <button onclick="closeModal(); addDreamToSeries(${id})" class="w-full py-2 bg-dream-600/20 text-dream-300 rounded-lg text-xs hover:bg-dream-600/30 transition-all"><i class="fas fa-plus mr-1"></i>Ajouter un rêve existant</button>
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
        <div class="mb-3"><label class="text-xs text-gray-400 mb-1 block">Couleur</label><input type="color" name="color" value="${series?.color || '#8b5cf6'}" class="w-12 h-8 rounded cursor-pointer bg-transparent"></div>
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

window.addDreamToSeries = async function(seriesId) {
  const data = await api('/dreams?limit=100');
  showModal(`
    <div class="p-4 sm:p-6">
      <div class="flex items-center justify-between mb-4"><h2 class="text-base font-display font-bold text-dream-100">Ajouter un rêve existant</h2><button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button></div>
      <div class="space-y-1.5 max-h-80 overflow-y-auto">
        ${data.dreams.map(d => `
          <div class="flex items-center gap-2 p-2.5 rounded-lg bg-night-900/40 hover:bg-night-900/60 cursor-pointer transition-all" onclick="addToSeries(${seriesId}, ${d.id}, this)">
            <p class="text-xs font-medium text-dream-200 flex-1 truncate">${escapeHtml(d.title)}</p>
            <p class="text-[10px] text-gray-500 shrink-0">${d.dream_date}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `);
};

window.addToSeries = async function(seriesId, dreamId, el) { try { await api(`/series/${seriesId}/dreams`, { method: 'POST', body: JSON.stringify({ dreamId }) }); el.style.opacity = '0.5'; el.innerHTML += '<span class="text-[10px] text-emerald-400 ml-2">✓</span>'; } catch (err) { alert(err.message); } };
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

// ========== LUCIDITY VIEW ==========
async function renderLucidity() {
  const main = document.getElementById('main-content');
  let rcStats = { total: 0, today: 0 }; try { rcStats = await api('/reality-checks/stats'); } catch {}
  main.innerHTML = `
    <div class="animate-slideUp">
      <h2 class="text-base font-display font-semibold text-dream-200 mb-5"><i class="fas fa-eye mr-2"></i>Aide à la Lucidité</h2>

      <!-- ===== CONTRÔLES DE RÉALITÉ ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <h3 class="text-lg font-display font-bold text-dream-100 mb-2 text-center">Contrôle de Réalité</h3>
        <p class="text-xs text-gray-400 mb-4 text-center">Effectuez un test maintenant. En rêve, ces actions produisent des résultats anormaux.</p>
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
          <p class="text-[10px] text-gray-400 mb-2">Lancez le refrain pendant chaque contrôle de réalité pour créer l'association musique / questionnement.</p>
          <div class="flex items-center gap-3 p-3 rounded-lg bg-night-900/50 border border-amber-500/15" id="music-player-container">
            <button onclick="toggleReveMieuxPlayer()" id="reve-mieux-play-btn"
              class="w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all shrink-0 border border-amber-500/40 bg-amber-600/20 text-amber-300 hover:bg-amber-600/40 hover:scale-105 active:scale-95">
              <i class="fas fa-play" id="reve-mieux-play-icon"></i>
            </button>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-amber-200 truncate">Rêve Mieux · Orelsan</p>
              <p class="text-[10px] text-gray-400">Refrain · En boucle automatique</p>
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
            <p class="text-[10px] text-gray-400"><strong>Quoi faire :</strong> Regardez attentivement vos mains et comptez vos doigts un par un, en vous demandant sincèrement si vous rêvez.</p>
            <p class="text-[10px] text-gray-400 mt-1"><strong>Pourquoi :</strong> En rêve, le cortex visuel primaire fonctionne de façon altérée (Hobson, 2009). Le cerveau peine à maintenir une représentation stable des détails : vos doigts peuvent apparaître en nombre incorrect, déformés ou flous. La répétition quotidienne crée un réflexe qui se déclenche aussi en rêve (Tholey, 1983).</p>
          </div>
          <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-dream-500/40">
            <p class="text-xs font-semibold text-dream-200 mb-1">📖 Lire un texte</p>
            <p class="text-[10px] text-gray-400"><strong>Quoi faire :</strong> Lisez un texte (panneau, écran, livre), détournez le regard, puis relisez-le. Demandez-vous : le texte est-il resté identique ?</p>
            <p class="text-[10px] text-gray-400 mt-1"><strong>Pourquoi :</strong> Les travaux de Stephen LaBerge à Stanford (1985) ont démontré que les aires de Broca et Wernicke (responsables du langage écrit) fonctionnent de manière instable pendant le sommeil paradoxal. Le texte se transforme, se brouille ou change de contenu entre deux lectures. C'est l'un des indicateurs de rêve les plus fiables, avec un taux de détection d'environ 75% (LaBerge & Rheingold, 1990).</p>
          </div>
          <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-dream-500/40">
            <p class="text-xs font-semibold text-dream-200 mb-1">⏰ Regarder l'heure</p>
            <p class="text-[10px] text-gray-400"><strong>Quoi faire :</strong> Regardez une horloge ou une montre, détournez le regard, puis regardez à nouveau. L'heure est-elle cohérente ?</p>
            <p class="text-[10px] text-gray-400 mt-1"><strong>Pourquoi :</strong> Comme pour le texte, les représentations numériques sont instables en rêve. Le cortex préfrontal, qui gère la logique temporelle et séquentielle, est partiellement désactivé pendant le sommeil REM (Hobson et al., 2000). Les chiffres se transforment ou n'ont aucun sens.</p>
          </div>
        </div>

        <!-- ===== EXPLICATION ANCRAGE MUSICAL ===== -->
        <div class="p-3 rounded-lg bg-night-900/30 border-l-2 border-amber-500/40 mb-2">
          <p class="text-xs font-semibold text-amber-200 mb-1">🎵 Ancrage Musical : le conditionnement sonore</p>
          <p class="text-[10px] text-gray-400"><strong>Le principe :</strong> Écoutez le refrain « Rêve Mieux » à chaque contrôle de réalité. L'objectif est de créer un conditionnement associatif entre la musique et le questionnement « suis-je en train de rêver ? ». Avec la répétition, votre cerveau associe les deux de manière automatique.</p>
          <p class="text-[10px] text-gray-400 mt-1"><strong>Pourquoi ça fonctionne :</strong> Ce mécanisme repose sur le conditionnement classique (Pavlov, 1927) et l'apprentissage associatif. À force de coupler un stimulus (la musique) avec un comportement (le questionnement de la réalité), le stimulus finit par déclencher le comportement seul, y compris en rêve. Konkoly et al. (2021, <em>Current Biology</em>) ont démontré que des stimuli sensoriels externes (sons, lumières) peuvent être intégrés dans les rêves pendant le sommeil paradoxal.</p>
          <p class="text-[10px] text-gray-400 mt-1"><strong>L'effet dans les rêves :</strong> La mémoire musicale dépend de l'hippocampe et du cortex auditif, deux structures actives pendant le REM (Stickgold, 2005). L'effet earworm (Williamson et al., 2012) montre que les fragments musicaux répétés s'inscrivent involontairement dans la boucle phonologique de la mémoire de travail. Un refrain écouté en boucle pendant vos reality checks a de fortes chances de se « rejouer » spontanément dans vos rêves, et comme votre cerveau a associé ce refrain au questionnement de la réalité, il peut déclencher un moment de lucidité automatique.</p>
          <p class="text-[10px] text-gray-400 mt-1"><strong>Le bénéfice nocturne :</strong> Au-delà de l'écoute en journée, ce même refrain peut servir d'indice sonore nocturne grâce à la fonctionnalité TLR (voir ci-dessous). Joué à volume ultra-faible pendant le sommeil paradoxal (6h après le coucher), le son est trop discret pour vous réveiller, mais suffisant pour que votre cerveau endormi le capte et l'intègre dans le rêve en cours. Et comme il a été conditionné en journée avec le questionnement « suis-je en train de rêver ? », il peut provoquer un flash de lucidité spontané. L'étude de Northwestern (Konkoly et al., 2024) a validé cette approche.</p>
          <p class="text-[9px] text-gray-500 italic mt-1.5">Sources : Pavlov (1927) · Konkoly et al. (2021, Current Biology ; 2024, Consciousness and Cognition) · Williamson et al. (2012, Psychology of Music) · Stickgold (2005, Nature Reviews Neuroscience)</p>
        </div>
      </div>

      <!-- ===== TLR NOCTURNE ===== -->
      <div class="glass rounded-xl p-4 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">🌜</span>
          <h3 class="text-lg font-display font-bold text-violet-100">TLR Nocturne : Déclencheur Automatique</h3>
        </div>
        <p class="text-xs text-gray-300 leading-relaxed mb-3">
          La <strong class="text-violet-300">Targeted Lucidity Reactivation</strong> (TLR), développée par l'Université de Northwestern (Konkoly et al., 2024, <em>Consciousness and Cognition</em>), consiste à rejouer pendant le sommeil paradoxal un son préalablement associé à l'entraînement au rêve lucide. L'étude a montré que les participants utilisant l'app TLR sont passés de <strong class="text-dream-300">0,74 à 2,11 rêves lucides/semaine</strong>, et 7 participants ont rapporté 14 rêves lucides directement déclenchés par le son.
        </p>
        <p class="text-xs text-gray-300 leading-relaxed mb-3">
          <strong class="text-violet-200">Comment ça marche ici :</strong> Tu définis ton heure de coucher habituelle. <strong class="text-dream-300">6 heures</strong> après (pic de sommeil paradoxal), le refrain « Rêve Mieux » se joue automatiquement à un volume ultra-faible. Comme ton cerveau a déjà associé ce refrain au questionnement « suis-je en train de rêver ? » via l'ancrage musical, le son peut s'intégrer dans ton rêve et <strong class="text-dream-300">déclencher la lucidité</strong>.
        </p>
        <p class="text-xs text-gray-300 leading-relaxed mb-3">
          <strong class="text-emerald-200">Scénario gagnant-gagnant :</strong> Que la musique te réveille ou non, tu es gagnant. <strong class="text-dream-300">Si tu ne te réveilles pas</strong>, le son s'intègre dans ton rêve et peut déclencher un flash de lucidité. <strong class="text-dream-300">Si la musique te réveille</strong>, c'est tout aussi bénéfique : tu es exactement dans les conditions idéales d'un <strong class="text-violet-200">WBTB</strong> (Wake Back To Bed). Tu peux alors appliquer la technique MILD — formuler ton intention de devenir lucide, visualiser un rêve — et te rendormir avec une conscience accrue. L'étude de Aspy et al. (2017) montre un taux de succès de 46% pour cette combinaison.
        </p>

        <!-- Configuration -->
        <div id="tlr-config" class="space-y-3">
          <div class="flex items-center gap-3">
            <label class="text-xs text-gray-400 shrink-0 w-36">Coucher habituel :</label>
            <input type="time" id="tlr-bedtime" value="${getTLRBedtime()}" onchange="saveTLRBedtime(this.value)"
              class="px-3 py-1.5 bg-night-900/60 border border-violet-700/30 rounded-lg text-white text-sm focus:border-violet-400 focus:outline-none">
          </div>
          <div class="flex items-center gap-3">
            <label class="text-xs text-gray-400 shrink-0 w-36">Ce soir (optionnel) :</label>
            <input type="time" id="tlr-tonight-override" value="${getTLRTonightOverride()}" onchange="saveTLRTonightOverride(this.value)"
              class="px-3 py-1.5 bg-night-900/60 border border-violet-700/30 rounded-lg text-white text-sm focus:border-violet-400 focus:outline-none">
            <button onclick="clearTLRTonightOverride()" class="text-[10px] text-gray-500 hover:text-red-400 transition-all" title="Effacer"><i class="fas fa-times"></i></button>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-xs text-gray-400 shrink-0 w-36">Volume nocturne :</label>
            <div class="flex gap-1.5" id="tlr-volume-picker">
              ${[1,2,3].map(v => `<button onclick="setTLRVolume(${v})" data-vol="${v}" class="tlr-vol-btn w-8 h-8 rounded-lg text-xs font-bold border transition-all ${getTLRVolume() === v ? 'border-violet-400 bg-violet-600/30 text-violet-200' : 'border-violet-700/20 bg-night-900/40 text-gray-500 hover:text-gray-300'}">${v}</button>`).join('')}
            </div>
            <span class="text-[10px] text-gray-500">${['', 'Très faible', 'Faible', 'Modéré'][getTLRVolume()]}</span>
          </div>
          <div class="flex items-center gap-3 pt-1">
            <button onclick="toggleTLR()" id="tlr-toggle-btn"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${isTLRActive() ? 'bg-violet-600/40 text-violet-200 border border-violet-400/50 shadow-lg shadow-violet-500/10' : 'bg-gradient-to-r from-violet-600 to-dream-600 text-white hover:from-violet-500 hover:to-dream-500'}">
              <i class="fas ${isTLRActive() ? 'fa-stop' : 'fa-moon'}"></i>
              ${isTLRActive() ? 'Désactiver TLR' : 'Activer TLR Nocturne'}
            </button>
          </div>
        </div>

        <!-- Compteurs TLR (visible quand actif) -->
        <div id="tlr-counters" class="${isTLRActive() ? '' : 'hidden'} mt-4 p-3 rounded-xl bg-night-900/50 border border-violet-500/20 space-y-2">
          <div class="flex items-center gap-2">
            <i class="fas fa-question-circle text-dream-400 text-xs"></i>
            <span class="text-xs text-dream-200 font-semibold">Est-ce que tu rêves ?</span>
          </div>
          <div class="flex items-center gap-2">
            <i class="fas fa-bed text-violet-400 text-xs"></i>
            <span class="text-xs text-gray-400">Tu dois dormir dans</span>
            <span id="tlr-sleep-countdown" class="text-sm font-mono font-bold text-violet-300">--:--</span>
          </div>
          <div class="flex items-center gap-2">
            <i class="fas fa-bolt text-amber-400 text-xs"></i>
            <span class="text-xs text-gray-400">Déclencheur lucide dans</span>
            <span id="tlr-trigger-countdown" class="text-sm font-mono font-bold text-amber-300">--:--</span>
          </div>
          <div id="tlr-status-msg" class="text-[10px] text-gray-500 italic"></div>
        </div>

        <!-- Explication scientifique courte -->
        <div class="mt-3 p-2.5 rounded-lg bg-violet-500/8 border border-violet-500/15">
          <p class="text-[10px] text-gray-300 leading-relaxed">
            <i class="fas fa-flask text-violet-400 mr-1"></i>
            <strong class="text-violet-200">Pourquoi 6 heures :</strong> Les phases REM les plus longues (30 à 60 min) surviennent en fin de nuit. L'étude TLR a montré que commencer les indices sonores 6h après l'endormissement cible le pic de sommeil paradoxal. Le volume est maintenu au seuil de discrimination perceptive : assez fort pour que le cerveau endormi intègre le son dans le rêve, pas assez pour provoquer le réveil.
          </p>
        </div>
        <p class="text-[9px] text-gray-500 italic mt-2">Sources : Konkoly et al. (2024, Consciousness and Cognition, PMC11542932) · Erlacher & Stumbrys (2020) · Carr et al. (2020, Frontiers in Psychology)</p>
      </div>

      <!-- ===== TECHNIQUES D'INDUCTION ===== -->
      <h3 class="text-sm font-display font-semibold text-dream-200 mb-3"><i class="fas fa-tools mr-2"></i>Techniques d'Induction</h3>
      <div class="space-y-3 mb-5">

        <!-- MILD -->
        <div class="glass rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2"><span class="text-xl">🧠</span><h4 class="font-semibold text-dream-200 text-sm">MILD (Mnemonic Induction of Lucid Dreams)</h4></div>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">Développée par Stephen LaBerge (Stanford, 1980), la MILD est la technique la plus validée par la recherche. Elle repose sur la <strong class="text-dream-300">mémoire prospective</strong> : la capacité de se souvenir d'effectuer une action dans le futur. Le principe est de programmer ton esprit pour qu'il reconnaisse l'état de rêve au moment où il se produit. Aspy et al. (2017) : taux de réussite de 46% combinée au WBTB, contre 3,7% en baseline. L'étude ILDIS (2020) confirme son efficacité même chez des débutants complets. <strong class="text-dream-300">Se pratique idéalement au recoucher d'un WBTB</strong> (voir ci-dessus), mais aussi à l'endormissement du soir.</p>
          <p class="text-[10px] font-semibold text-dream-200 mb-1.5">Protocole :</p>
          <ol class="text-[10px] text-gray-300 space-y-1.5 mb-2">
            <li><strong class="text-dream-300">1. Rappel du rêve :</strong> Au réveil, garde les yeux fermés et remémore-toi le rêve que tu viens de faire. Note mentalement les éléments marquants.</li>
            <li><strong class="text-dream-300">2. Identification des signes de rêve :</strong> Repère un élément bizarre ou impossible (voler, rencontrer quelqu'un de décédé, lieu qui change). C'est ton « signe de rêve ».</li>
            <li><strong class="text-dream-300">3. Intention :</strong> Répète-toi avec conviction : « La prochaine fois que je rêve, je me rendrai compte que je rêve. »</li>
            <li><strong class="text-dream-300">4. Visualisation :</strong> Imagine-toi de retour dans le rêve précédent. Rejoue la scène, mais cette fois tu reconnais le signe de rêve et deviens lucide.</li>
            <li><strong class="text-dream-300">5. Endormissement :</strong> Maintiens l'intention et la visualisation en t'endormant. Si d'autres pensées surgissent, reviens doucement à ton intention.</li>
          </ol>
          <p class="text-[9px] text-gray-500 italic">Sources : LaBerge (1985, Stanford) · Aspy et al. (2017, Adélaïde) · ILDIS (2020, PMC7379166)</p>
        </div>

        <!-- WBTB -->
        <div class="glass rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2"><span class="text-xl">⏰</span><h4 class="font-semibold text-dream-200 text-sm">WBTB (Wake Back To Bed)</h4></div>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">Le WBTB est un <strong class="text-dream-300">amplificateur</strong> qui se combine à toute autre technique (MILD, SSILD, etc.). Le principe : les phases REM deviennent plus longues et intenses en fin de nuit. En te réveillant après 5 à 6 heures, tu interromps ton sommeil juste avant les périodes REM les plus longues (30 à 60 min, contre 10 min en début de nuit). La période d'éveil qui suit augmente l'activité du cortex préfrontal dorsolatéral — responsable de la conscience de soi — ce qui se maintient partiellement au retour au sommeil. Résultat : ta conscience critique est plus élevée quand tu replonges dans les rêves. Stumbrys et al. (2012) montrent que le WBTB multiplie par 5 les chances de lucidité. Aspy et al. (2017) : 46% de réussite pour WBTB + MILD, et 50% des débutants complets ont réussi leur premier rêve lucide en 5 semaines.</p>
          <p class="text-[10px] font-semibold text-dream-200 mb-1.5">Protocole :</p>
          <ol class="text-[10px] text-gray-300 space-y-1.5 mb-2">
            <li><strong class="text-dream-300">1. Alarme à 5-6h après l'endormissement.</strong> C'est le moment optimal, juste avant le pic REM.</li>
            <li><strong class="text-dream-300">2. Lève-toi physiquement</strong> (toilettes, verre d'eau) pour activer ton cortex préfrontal. 20 à 60 min d'éveil.</li>
            <li><strong class="text-dream-300">3. Pendant l'éveil :</strong> relis tes rêves récents dans Rêve Mieux, réfléchis au rêve lucide. Évite les écrans trop lumineux.</li>
            <li><strong class="text-dream-300">4. Au recoucher, applique MILD ou SSILD</strong> (voir ci-dessous). La conscience préfrontale accrue se maintient dans le sommeil qui suit.</li>
          </ol>
          <p class="text-[9px] text-gray-500 italic">Sources : Stumbrys et al. (2012, méta-analyse) · Aspy et al. (2017) · Frontiers in Psychology (2020, PMC7332853)</p>
        </div>

        <!-- Reality Testing -->
        <div class="glass rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2"><span class="text-xl">✋</span><h4 class="font-semibold text-dream-200 text-sm">Reality Testing (Technique de Réflexion)</h4></div>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">Formalisée par Paul Tholey (1983), cette méthode repose sur un principe simple : si tu prends l'habitude de questionner la réalité pendant la journée, ce réflexe finit par se déclencher aussi en rêve. L'élément clé est la <strong class="text-dream-300">qualité</strong> de l'interrogation, pas la quantité. Il ne suffit pas de faire le geste mécaniquement : tu dois sincèrement te demander « suis-je en train de rêver ? » et examiner ton environnement avec attention critique. Aspy et al. (2017) : taux de succès de 47,5% quand le Reality Testing est pratiqué avec intention, effet négligeable quand il est fait par habitude mécanique.</p>
          <p class="text-[10px] font-semibold text-dream-200 mb-1.5">Protocole :</p>
          <ol class="text-[10px] text-gray-300 space-y-1.5 mb-2">
            <li><strong class="text-dream-300">1. Choisis tes déclencheurs :</strong> Associe tes tests à des moments récurrents (passer une porte, regarder l'heure, entendre un son particulier).</li>
            <li><strong class="text-dream-300">2. Questionne-toi sincèrement :</strong> « Suis-je en train de rêver ? » avec une vraie intention. Examine ton environnement.</li>
            <li><strong class="text-dream-300">3. Test physique :</strong> Compte tes doigts, pince-toi le nez et essaie de respirer, ou relis un texte deux fois.</li>
            <li><strong class="text-dream-300">4. Vise 10 à 15 tests par jour.</strong> La régularité est essentielle. Plus le réflexe est ancré, plus il apparaîtra dans tes rêves.</li>
            <li><strong class="text-dream-300">5. En rêve, les résultats seront anormaux :</strong> doigts en trop, air passant à travers le nez pincé, texte qui change.</li>
          </ol>
          <p class="text-[9px] text-gray-500 italic">Sources : Tholey (1983, Reflexionstechnik) · Aspy et al. (2017) · Erlacher & Schredl (2008)</p>
        </div>

        <!-- Journal -->
        <div class="glass rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2"><span class="text-xl">📝</span><h4 class="font-semibold text-dream-200 text-sm">Journal de Rêves</h4></div>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">Le journal est le <strong class="text-dream-300">fondement</strong> de toute pratique de rêve lucide. Sans rappel de tes rêves, même si tu deviens lucide, tu ne t'en souviendras pas au réveil. Schredl & Erlacher (2004) : la simple habitude de noter ses rêves augmente le rappel en 2 à 3 semaines. Plus tu notes, plus ton cerveau retient les rêves. Le journal permet aussi d'identifier tes « signes de rêve » récurrents — essentiel pour MILD et le Reality Testing.</p>
          <p class="text-[10px] font-semibold text-dream-200 mb-1.5">Bonnes pratiques :</p>
          <ul class="text-[10px] text-gray-300 space-y-1.5 mb-2">
            <li><strong class="text-dream-300">Au réveil, ne bouge pas.</strong> Reste immobile, yeux fermés. Les souvenirs s'effacent très vite avec le mouvement.</li>
            <li><strong class="text-dream-300">Note dans les 5 premières minutes.</strong> Même un fragment, une émotion ou une image.</li>
            <li><strong class="text-dream-300">Écris au présent :</strong> « Je marche dans une forêt » plutôt que « J'étais dans une forêt ». Cela augmente l'immersion et le rappel.</li>
            <li><strong class="text-dream-300">Utilise les étapes de Rêve Mieux :</strong> Découpe tes rêves en scènes distinctes avec les émotions de chaque moment.</li>
            <li><strong class="text-dream-300">Relis tes anciens rêves :</strong> La relecture consolide les souvenirs et t'aide à repérer tes signes de rêve récurrents.</li>
          </ul>
          <p class="text-[9px] text-gray-500 italic">Sources : Schredl & Erlacher (2004) · Schredl (2002) · Cleveland Clinic (2024)</p>
        </div>

        <!-- SSILD -->
        <div class="glass rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2"><span class="text-xl">🧘</span><h4 class="font-semibold text-dream-200 text-sm">SSILD (Senses Initiated Lucid Dream)</h4></div>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">Créée en 2011 par CosmicIron, la SSILD est une alternative simple à MILD. Elle consiste à effectuer des cycles courts d'attention sensorielle (vue, ouïe, toucher) en position allongée, sans effort de concentration. L'objectif n'est pas de rester éveillé consciemment (comme le WILD), mais de créer un état propice à l'apparition spontanée de lucidité. L'étude ILDIS (2020, Consciousness and Cognition) a trouvé que SSILD produit des résultats comparables à MILD. La technique est recommandée aux débutants pour sa simplicité et l'absence de pression mentale.</p>
          <p class="text-[10px] font-semibold text-dream-200 mb-1.5">Protocole <span class="text-gray-400">(à pratiquer après un WBTB — voir ci-dessus)</span> :</p>
          <ol class="text-[10px] text-gray-300 space-y-1.5 mb-2">
            <li><strong class="text-dream-300">1. Après ton réveil WBTB, recouche-toi.</strong> Contrairement au WBTB classique (20-60 min d'éveil), quelques minutes suffisent pour SSILD.</li>
            <li><strong class="text-dream-300">2. Cycle « Vue » (~20s) :</strong> Les yeux fermés, observe ce que tu vois (obscurité, formes, couleurs). Ne force pas, observe simplement.</li>
            <li><strong class="text-dream-300">3. Cycle « Son » (~20s) :</strong> Porte attention aux sons (bourdonnement d'oreilles, silence, bruits de fond). Reste passif et réceptif.</li>
            <li><strong class="text-dream-300">4. Cycle « Toucher » (~20s) :</strong> Concentre-toi sur les sensations physiques (poids du corps, température, contact des draps).</li>
            <li><strong class="text-dream-300">5. Répète 4 à 5 cycles</strong> des 3 sens sans effort ni attente, puis laisse-toi glisser vers le sommeil.</li>
            <li><strong class="text-dream-300">6. La lucidité survient souvent spontanément,</strong> soit à l'endormissement, soit plus tard dans la nuit. Beaucoup de pratiquants rapportent des faux éveils.</li>
          </ol>
          <p class="text-[9px] text-gray-500 italic">Sources : CosmicIron (2011, DreamViews) · ILDIS (2020, PMC7379166) · rapports communautaires</p>
        </div>

        <!-- Incubation -->
        <div class="glass rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2"><span class="text-xl">🌙</span><h4 class="font-semibold text-dream-200 text-sm">Incubation & Séries de Rêves</h4></div>
          <p class="text-xs text-gray-300 leading-relaxed mb-3">L'incubation consiste à influencer le contenu de tes rêves par une suggestion pré-sommeil ciblée. Barrett (Harvard, 1993) : environ 50% des participants ont rêvé du sujet choisi. L'hypothèse de la continuité (Schredl, 2003) confirme que les pensées actives avant le sommeil influencent le contenu onirique. C'est le principe des <strong class="text-dream-300">séries de rêves</strong> dans Rêve Mieux : en relisant tes rêves précédents avant le coucher, tu « recharges » ta mémoire de travail avec ce monde onirique, augmentant les chances d'y retourner.</p>
          <p class="text-[10px] font-semibold text-dream-200 mb-1.5">Protocole avec Rêve Mieux :</p>
          <ol class="text-[10px] text-gray-300 space-y-1.5 mb-2">
            <li><strong class="text-dream-300">1. Crée ou choisis une série :</strong> Regroupe les rêves que tu veux prolonger dans une série narrative.</li>
            <li><strong class="text-dream-300">2. Relis avant le coucher (15-30 min) :</strong> Laisse les détails, les lieux, les personnages et les émotions t'imprégner.</li>
            <li><strong class="text-dream-300">3. Formule ton intention :</strong> « Cette nuit, je veux retourner dans ce rêve et continuer l'histoire. »</li>
            <li><strong class="text-dream-300">4. Visualise la scène :</strong> Imagine-toi dans le dernier lieu de la série. Ressens les émotions, vois les détails. Maintiens cette image en t'endormant.</li>
            <li><strong class="text-dream-300">5. Le lendemain, note le résultat.</strong> Même si ce n'est pas une continuation exacte, note les éléments communs. Ton subconscient intègre progressivement la suggestion.</li>
          </ol>
          <p class="text-[9px] text-gray-500 italic">Sources : Barrett (Harvard, 1993) · Schredl (2003, hypothèse de la continuité) · Dement (1974, protocole d'incubation)</p>
        </div>

      </div>

      <!-- ===== BASES SCIENTIFIQUES ===== -->
      <div class="glass rounded-xl p-4">
        <h3 class="text-xs font-display font-semibold text-dream-200 mb-3"><i class="fas fa-flask mr-2"></i>Bases Scientifiques</h3>
        <div class="space-y-2 text-[10px] text-gray-300">
          <div class="p-2.5 rounded-lg bg-night-900/40"><p class="font-semibold text-dream-200 mb-1">📊 Rappel et journal</p><p>Schredl & Erlacher (2004) : le journal augmente significativement le rappel. Effet mesurable dès 2 à 3 semaines de pratique quotidienne.</p></div>
          <div class="p-2.5 rounded-lg bg-night-900/40"><p class="font-semibold text-dream-200 mb-1">✨ Rêves lucides</p><p>Stumbrys et al. (2012), méta-analyse de 35 études : la combinaison MILD + WBTB + Reality Testing est l'approche la plus efficace connue à ce jour.</p></div>
          <div class="p-2.5 rounded-lg bg-night-900/40"><p class="font-semibold text-dream-200 mb-1">🌙 Incubation et continuité</p><p>Barrett (Harvard, 1993) : environ 50% des participants ont rêvé du sujet choisi. L'hypothèse de la continuité (Schredl, 2003) montre que les pensées pré-sommeil influencent directement le contenu onirique.</p></div>
          <div class="p-2.5 rounded-lg bg-night-900/40"><p class="font-semibold text-dream-200 mb-1">📖 Texte et lecture en rêve</p><p>LaBerge & Rheingold (1990) : dans environ 75% des cas, un texte relu change de contenu en rêve. Les aires corticales du langage écrit sont instables pendant le REM.</p></div>
          <div class="p-2.5 rounded-lg bg-night-900/40"><p class="font-semibold text-dream-200 mb-1">⚠️ Transparence</p><p>MILD, WBTB et Reality Testing sont validés par des études contrôlées. SSILD est principalement communautaire (résultats comparables à MILD selon l'étude ILDIS 2020, mais pas d'étude isolée). Rêve Mieux distingue clairement ce qui est validé de ce qui est exploratoire.</p></div>
        </div>
      </div>
    </div>`;
}

window.doRealityCheck = async function(type) { try { await api('/reality-checks', { method: 'POST', body: JSON.stringify({ checkType: type, wasDreaming: false }) }); showToast('✋ Reality check enregistré !'); renderLucidity(); } catch {} };

// ========== LECTEUR AUDIO — RÊVE MIEUX (ANCRAGE MUSICAL) ==========
let reveMieuxAudio = null;
let reveMieuxAnimFrame = null;

window.toggleReveMieuxPlayer = function() {
  if (!reveMieuxAudio) {
    reveMieuxAudio = new Audio('/static/reve-mieux-refrain.mp3');
    reveMieuxAudio.loop = true;
    reveMieuxAudio.addEventListener('ended', () => {
      // Sécurité : si loop ne fonctionne pas sur certains navigateurs
      reveMieuxAudio.currentTime = 0;
      reveMieuxAudio.play();
    });
  }
  const icon = document.getElementById('reve-mieux-play-icon');
  const btn = document.getElementById('reve-mieux-play-btn');
  if (reveMieuxAudio.paused) {
    reveMieuxAudio.play().then(() => {
      icon.className = 'fas fa-pause';
      btn.classList.add('bg-amber-500/30', 'shadow-lg', 'shadow-amber-500/10');
      updateReveMieuxProgress();
    }).catch(() => {});
  } else {
    reveMieuxAudio.pause();
    icon.className = 'fas fa-play';
    btn.classList.remove('bg-amber-500/30', 'shadow-lg', 'shadow-amber-500/10');
    if (reveMieuxAnimFrame) cancelAnimationFrame(reveMieuxAnimFrame);
  }
};

function updateReveMieuxProgress() {
  if (!reveMieuxAudio || reveMieuxAudio.paused) return;
  const progress = document.getElementById('reve-mieux-progress');
  const timeEl = document.getElementById('reve-mieux-time');
  if (progress && reveMieuxAudio.duration) {
    const pct = (reveMieuxAudio.currentTime / reveMieuxAudio.duration) * 100;
    progress.style.width = pct + '%';
  }
  if (timeEl) {
    const cur = Math.floor(reveMieuxAudio.currentTime);
    timeEl.textContent = Math.floor(cur / 60) + ':' + String(cur % 60).padStart(2, '0');
  }
  reveMieuxAnimFrame = requestAnimationFrame(updateReveMieuxProgress);
}

// ========== TLR NOCTURNE (Service Worker + Notification Persistante) ==========
let tlrInterval = null;
let tlrSWReady = false;
let tlrNotifInterval = null;

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
      if (state.currentView === 'lucidity') renderLucidity();
    }
    if (event.data?.type === 'REALITY_CHECK_FROM_SW') {
      // Enregistrer un reality check et naviguer vers lucidité
      api('/reality-checks', { method: 'POST', body: JSON.stringify({ checkType: 'notification', wasDreaming: false }) }).catch(() => {});
      navigate('lucidity');
      showToast('Reality check depuis la notification !');
    }
  });
}

function sendSWMessage(data) {
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage(data);
}

function getTLRBedtime() { return localStorage.getItem('tlr_bedtime') || '23:00'; }
function saveTLRBedtime(val) { localStorage.setItem('tlr_bedtime', val); if (isTLRActive()) restartTLRCounters(); }

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
  if (isTLRActive()) restartTLRCounters();
}
window.clearTLRTonightOverride = function() {
  localStorage.removeItem('tlr_tonight');
  const el = document.getElementById('tlr-tonight-override');
  if (el) el.value = '';
  if (isTLRActive()) restartTLRCounters();
};

function getTLRVolume() { return parseInt(localStorage.getItem('tlr_volume') || '1'); }
window.setTLRVolume = function(v) {
  localStorage.setItem('tlr_volume', v);
  document.querySelectorAll('.tlr-vol-btn').forEach(btn => {
    const isActive = parseInt(btn.dataset.vol) === v;
    btn.className = `tlr-vol-btn w-8 h-8 rounded-lg text-xs font-bold border transition-all ${isActive ? 'border-violet-400 bg-violet-600/30 text-violet-200' : 'border-violet-700/20 bg-night-900/40 text-gray-500 hover:text-gray-300'}`;
  });
};

function isTLRActive() { return localStorage.getItem('tlr_active') === '1'; }

function getEffectiveBedtime() {
  return getTLRTonightOverride() || getTLRBedtime();
}

function getBedtimeDate() {
  const timeStr = getEffectiveBedtime();
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const bed = new Date(now);
  bed.setHours(h, m, 0, 0);
  if (bed <= now) bed.setDate(bed.getDate() + 1);
  return bed;
}

function getTriggerDate() {
  const bed = getBedtimeDate();
  return new Date(bed.getTime() + 6 * 60 * 60 * 1000);
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

window.toggleTLR = async function() {
  if (isTLRActive()) {
    // Désactiver
    localStorage.setItem('tlr_active', '0');
    stopTLRCounters();
    sendSWMessage({ type: 'TLR_STOP' });
    const btn = document.getElementById('tlr-toggle-btn');
    if (btn) {
      btn.className = 'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 bg-gradient-to-r from-violet-600 to-dream-600 text-white hover:from-violet-500 hover:to-dream-500';
      btn.innerHTML = '<i class="fas fa-moon"></i> Activer TLR Nocturne';
    }
    const counters = document.getElementById('tlr-counters');
    if (counters) counters.classList.add('hidden');
    showToast('TLR nocturne désactivé');
  } else {
    // Activer : enregistrer SW + demander permission notifs
    localStorage.setItem('tlr_active', '1');
    
    // Enregistrer le Service Worker
    await registerTLRServiceWorker();
    
    // Demander la permission de notification
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      await Notification.requestPermission();
    }
    
    startTLRCounters();
    
    const btn = document.getElementById('tlr-toggle-btn');
    if (btn) {
      btn.className = 'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 bg-violet-600/40 text-violet-200 border border-violet-400/50 shadow-lg shadow-violet-500/10';
      btn.innerHTML = '<i class="fas fa-stop"></i> Désactiver TLR';
    }
    const counters = document.getElementById('tlr-counters');
    if (counters) counters.classList.remove('hidden');
    
    const notifOk = ('Notification' in window && Notification.permission === 'granted');
    showToast(notifOk 
      ? 'TLR activé ! Notification fixée sur votre écran. Désactivez ici uniquement.' 
      : 'TLR activé ! Autorisez les notifications pour le rappel permanent sur écran de verrouillage.');
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
  const now = new Date();
  const sleepDiff = getBedtimeDate() - now;
  const triggerDiff = getTriggerDate() - now;
  
  sendSWMessage({
    type: 'TLR_UPDATE',
    sleepCountdown: sleepDiff > 0 ? formatCountdownHM(sleepDiff) : null,
    triggerCountdown: triggerDiff > 0 ? formatCountdownHM(triggerDiff) : null,
    status: triggerDiff <= 0 ? 'triggered' : (sleepDiff <= 0 ? 'sleeping' : 'waiting')
  });
}

let tlrTriggered = false;
function updateTLRDisplay() {
  const now = new Date();
  const bed = getBedtimeDate();
  const trigger = getTriggerDate();

  const sleepEl = document.getElementById('tlr-sleep-countdown');
  const triggerEl = document.getElementById('tlr-trigger-countdown');
  const statusEl = document.getElementById('tlr-status-msg');

  const sleepDiff = bed - now;
  const triggerDiff = trigger - now;

  if (sleepEl) {
    const sc = formatCountdown(sleepDiff);
    if (sc) {
      sleepEl.textContent = sc;
      sleepEl.className = 'text-sm font-mono font-bold text-violet-300';
    } else {
      sleepEl.textContent = 'Bonne nuit !';
      sleepEl.className = 'text-sm font-mono font-bold text-emerald-300';
    }
  }

  if (triggerEl) {
    const tc = formatCountdown(triggerDiff);
    if (tc) {
      triggerEl.textContent = tc;
      triggerEl.className = 'text-sm font-mono font-bold text-amber-300';
    } else {
      triggerEl.textContent = 'En cours !';
      triggerEl.className = 'text-sm font-mono font-bold text-amber-200 animate-pulse';
    }
  }

  if (statusEl) {
    if (triggerDiff <= 0) {
      statusEl.textContent = 'Le refrain se joue... Faites de beaux rêves lucides.';
    } else if (sleepDiff <= 0) {
      statusEl.textContent = 'Vous devriez dormir. Le déclencheur arrivera dans votre sommeil paradoxal.';
    } else {
      statusEl.textContent = 'En attente. Le refrain se jouera automatiquement à l\'heure prévue.';
    }
  }

  // Auto-play du refrain quand le trigger est atteint
  if (triggerDiff <= 0 && !tlrTriggered && isTLRActive()) {
    tlrTriggered = true;
    playTLRRefrain();
  }
  if (triggerDiff > 0) tlrTriggered = false;
}

function playTLRRefrain() {
  if (!reveMieuxAudio) {
    reveMieuxAudio = new Audio('/static/reve-mieux-refrain.mp3');
    reveMieuxAudio.loop = true;
    reveMieuxAudio.addEventListener('ended', () => {
      reveMieuxAudio.currentTime = 0;
      reveMieuxAudio.play().catch(() => {});
    });
  }
  const volumeMap = { 1: 0.03, 2: 0.08, 3: 0.15 };
  reveMieuxAudio.volume = volumeMap[getTLRVolume()] || 0.03;
  reveMieuxAudio.play().then(() => {
    const icon = document.getElementById('reve-mieux-play-icon');
    const btn = document.getElementById('reve-mieux-play-btn');
    if (icon) icon.className = 'fas fa-pause';
    if (btn) btn.classList.add('bg-amber-500/30', 'shadow-lg', 'shadow-amber-500/10');
    updateReveMieuxProgress();
    // Notification trigger via SW
    sendSWMessage({ type: 'TLR_TRIGGER' });
  }).catch(() => {
    // Auto-play bloqué par le navigateur, notification via SW
    sendSWMessage({ type: 'TLR_TRIGGER' });
  });
}

// Au chargement : relancer les compteurs TLR si actif + enregistrer SW
(async function initTLR() {
  if (isTLRActive()) {
    await registerTLRServiceWorker();
    startTLRCounters();
  }
})()

// ========== MODAL & TOAST ==========
function showModal(content, maxWidth) {
  const container = document.getElementById('modal-container');
  container.innerHTML = `<div class="modal-overlay animate-fadeIn" onclick="if(event.target===this) closeModal()"><div class="modal-content animate-slideUp" style="${maxWidth ? 'max-width:' + maxWidth : ''}">${content}</div></div>`;
}
window.closeModal = function() { document.getElementById('modal-container').innerHTML = ''; };
function showToast(msg) { const t = document.createElement('div'); t.className = 'fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 glass px-5 py-2.5 rounded-xl text-xs text-dream-200 animate-slideUp max-w-[90vw] text-center'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 4000); }

// ========== UTILITIES ==========
function escapeHtml(str) { if (!str) return ''; const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

// ========== INIT ==========
checkAuth();

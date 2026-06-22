// ============================================
// Rêve Mieux — Application Frontend SPA
// Journal et Cartographie des Rêves Lucides
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
  graphData: null,
  editingDream: null,
  filters: { type: 'all', search: '' }
};

// ========== API Helper ==========
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) { logout(); throw new Error('Session expirée'); }
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
          <p class="text-gray-400 mt-2 text-sm">Journal & Cartographie des Rêves Lucides</p>
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
          <div id="auth-error" class="text-red-400 text-sm mb-3 hidden"></div>
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
  errEl.classList.add('hidden');
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
    errEl.textContent = err.message; errEl.classList.remove('hidden');
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
            <button onclick="navigate('map')" data-nav="map" class="nav-tab px-3 py-2 rounded-lg text-sm font-medium transition-all"><i class="fas fa-project-diagram mr-1"></i>Carte</button>
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
      <main id="main-content" class="flex-1 overflow-y-auto max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6"></main>

      <!-- Mobile Bottom Nav -->
      <nav class="sm:hidden mobile-bottom-nav" id="main-nav-mobile">
        <div class="flex justify-around items-end py-1.5 px-1">
          <button onclick="navigate('journal')" data-nav="journal" class="nav-tab flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all min-w-[48px]">
            <i class="fas fa-book-open text-base"></i><span>Journal</span>
          </button>
          <button onclick="navigate('map')" data-nav="map" class="nav-tab flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all min-w-[48px]">
            <i class="fas fa-project-diagram text-base"></i><span>Carte</span>
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
    case 'map': renderMap(); break;
    case 'series': renderSeries(); break;
    case 'lucidity': renderLucidity(); break;
  }
};

// ========== JOURNAL VIEW ==========
async function renderJournal() {
  const main = document.getElementById('main-content');
  try {
    const params = new URLSearchParams({ page: state.pagination.page, limit: state.pagination.limit });
    if (state.filters.type !== 'all') params.set('type', state.filters.type);
    if (state.filters.search) params.set('search', state.filters.search);
    const data = await api(`/dreams?${params}`);
    state.dreams = data.dreams; state.pagination = data.pagination;
  } catch (err) { main.innerHTML = `<div class="text-center py-12 text-red-400">${err.message}</div>`; return; }
  main.innerHTML = `
    <div class="animate-slideUp">
      <div class="flex flex-col gap-3 mb-5">
        <div class="relative">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
          <input type="text" id="search-input" value="${state.filters.search}" placeholder="Rechercher dans vos rêves..."
            class="w-full pl-10 pr-4 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-xl text-white text-sm placeholder-gray-500 focus:border-dream-400 focus:outline-none"
            oninput="debounceSearch(this.value)">
        </div>
        <div class="flex gap-2 items-center">
          <select onchange="filterType(this.value)" class="flex-1 sm:flex-none px-3 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-xl text-gray-300 text-sm focus:border-dream-400 focus:outline-none appearance-auto">
            <option value="all" ${state.filters.type === 'all' ? 'selected' : ''}>Tous les types</option>
            <option value="normal" ${state.filters.type === 'normal' ? 'selected' : ''}>🌀 Normal</option>
            <option value="lucid" ${state.filters.type === 'lucid' ? 'selected' : ''}>✨ Lucide</option>
            <option value="nightmare" ${state.filters.type === 'nightmare' ? 'selected' : ''}>👹 Cauchemar</option>
            <option value="recurring" ${state.filters.type === 'recurring' ? 'selected' : ''}>🔄 Récurrent</option>
            <option value="hypnagogic" ${state.filters.type === 'hypnagogic' ? 'selected' : ''}>🌊 Hypnagogique</option>
            <option value="false_awakening" ${state.filters.type === 'false_awakening' ? 'selected' : ''}>🪞 Faux éveil</option>
          </select>
          <button onclick="openDreamEditor()" class="hidden sm:flex px-4 py-2.5 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-xl text-sm font-medium hover:from-dream-400 hover:to-dream-600 transition-all whitespace-nowrap items-center gap-1.5">
            <i class="fas fa-plus"></i> Nouveau rêve
          </button>
        </div>
      </div>
      <div id="dreams-list" class="space-y-3">
        ${state.dreams.length === 0 ? `
          <div class="text-center py-12">
            <div class="text-5xl mb-4 animate-float">🌙</div>
            <h3 class="text-lg font-display font-semibold text-dream-200 mb-2">Votre journal est vide</h3>
            <p class="text-gray-400 mb-6 max-w-md mx-auto text-sm">Commencez à noter vos rêves dès le réveil.</p>
            <button onclick="openDreamEditor()" class="px-6 py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-xl font-medium">
              <i class="fas fa-feather-alt mr-2"></i>Noter mon premier rêve
            </button>
          </div>
        ` : state.dreams.map(d => renderDreamCard(d)).join('')}
      </div>
      ${state.pagination.pages > 1 ? `<div class="flex justify-center gap-2 mt-6">${Array.from({ length: state.pagination.pages }, (_, i) => `<button onclick="goToPage(${i + 1})" class="w-9 h-9 rounded-lg text-sm font-medium transition-all ${state.pagination.page === i + 1 ? 'bg-dream-600 text-white' : 'bg-night-900/60 text-gray-400 hover:text-white'}">${i + 1}</button>`).join('')}</div>` : ''}
    </div>`;
}

function renderDreamCard(d) {
  const typeIcons = { normal: '🌀', lucid: '✨', nightmare: '👹', recurring: '🔄', hypnagogic: '🌊', false_awakening: '🪞' };
  const typeLabels = { normal: 'Normal', lucid: 'Lucide', nightmare: 'Cauchemar', recurring: 'Récurrent', hypnagogic: 'Hypnago.', false_awakening: 'Faux éveil' };
  const dateStr = new Date(d.dream_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const preview = d.content.length > 150 ? d.content.substring(0, 150) + '...' : d.content;
  return `
    <div class="glass rounded-xl p-3 sm:p-4 hover:border-dream-400/30 transition-all cursor-pointer animate-fadeIn group" onclick="openDreamDetail(${d.id})">
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

      ${d.emotions?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Émotions globales</h4><div class="flex flex-wrap gap-1.5">${d.emotions.map(e => `<span class="flex items-center gap-1 px-2 py-1 rounded-full bg-dream-800/30 text-xs">${emotionEmojis[e.emotion] || ''} <span class="text-dream-200 capitalize">${e.emotion}</span> <span class="text-[9px] text-gray-500">${e.intensity}/5</span></span>`).join('')}</div></div>` : ''}
      ${d.tags?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Tags</h4><div class="flex flex-wrap gap-1.5">${d.tags.map(t => `<span class="px-2 py-1 rounded-full text-[10px] font-medium" style="background:${t.color}20; color:${t.color}; border: 1px solid ${t.color}40">${escapeHtml(t.name)}</span>`).join('')}</div></div>` : ''}
      ${d.connections?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Connexions</h4><div class="space-y-1">${d.connections.map(cn => `<div class="flex items-center gap-2 p-2 rounded-lg bg-night-900/40 cursor-pointer hover:bg-night-900/60" onclick="closeModal(); setTimeout(() => openDreamDetail(${cn.connected_dream_id}), 300)"><i class="fas fa-link text-dream-400 text-xs"></i><span class="text-xs text-dream-200">${escapeHtml(cn.connected_dream_title)}</span><span class="text-[9px] text-gray-500 capitalize">${cn.connection_type}</span></div>`).join('')}</div></div>` : ''}
      ${d.series?.length ? `<div class="mb-4"><h4 class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Séries</h4><div class="flex flex-wrap gap-1.5">${d.series.map(s => `<span class="px-2 py-1 rounded-full text-[10px] font-medium" style="background:${s.color}20; color:${s.color}">${escapeHtml(s.name)}</span>`).join('')}</div></div>` : ''}
      <div class="flex gap-2 pt-3 border-t border-dream-700/20">
        <button onclick="closeModal(); openDreamEditor(${d.id})" class="flex-1 py-2 bg-dream-600/30 text-dream-300 rounded-lg hover:bg-dream-600/50 transition-all text-xs font-medium"><i class="fas fa-edit mr-1"></i>Modifier</button>
        <button onclick="closeModal(); openConnectionEditor(${d.id}, '${escapeHtml(d.title).replace(/'/g, "\\'")}')" class="flex-1 py-2 bg-night-800/50 text-gray-300 rounded-lg hover:bg-night-800/70 transition-all text-xs font-medium"><i class="fas fa-link mr-1"></i>Connecter</button>
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
        <div class="relative mb-3">
          <textarea name="content" rows="3" placeholder="Récit global du rêve..." required
            class="w-full px-3 py-2.5 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-sm placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none">${dream ? escapeHtml(dream.content) : ''}</textarea>
          <button type="button" onclick="toggleVoiceRecording()" id="voice-btn" class="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-dream-600/30 text-dream-300 hover:bg-dream-600/50 transition-all flex items-center justify-center text-sm" title="Dictée vocale">
            <i class="fas fa-microphone"></i>
          </button>
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
          <div class="flex gap-1.5 items-center">
            <input type="text" id="tag-input" placeholder="Créer un tag..."
              class="flex-1 px-3 py-1.5 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-xs placeholder-gray-500 focus:border-dream-400 focus:outline-none min-w-0"
              onkeydown="if(event.key==='Enter'){event.preventDefault(); addNewTag()}">
            <select id="tag-category-select" class="px-2 py-1.5 bg-night-900/60 border border-dream-700/30 rounded-lg text-xs text-gray-300 focus:border-dream-400 focus:outline-none">
              ${TAG_CATEGORIES.map(c => `<option value="${c.value}">${c.icon} ${c.label}</option>`).join('')}
            </select>
            <button type="button" onclick="addNewTag()" class="px-2.5 py-1.5 bg-dream-600/40 text-dream-300 rounded-lg hover:bg-dream-600/60 text-xs shrink-0"><i class="fas fa-plus"></i></button>
          </div>
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
  if (!tag || window._editorState.tags.find(t => t.name === tag.name)) return;
  window._editorState.tags.push({ id: tag.id, name: tag.name, category: tag.category, color: tag.color });
  updateTagsDisplay();
  const pickBtn = document.getElementById(`pick-tag-${tagId}`);
  if (pickBtn) { pickBtn.classList.add('opacity-40', 'pointer-events-none'); pickBtn.disabled = true; }
};

// Tag management — create new
window.addNewTag = function() {
  const input = document.getElementById('tag-input');
  const catSelect = document.getElementById('tag-category-select');
  const name = input.value.trim();
  if (!name || window._editorState.tags.find(t => t.name === name)) { input.value = ''; return; }
  const category = catSelect.value || 'custom';
  window._editorState.tags.push({ name, category, color: TAG_COLORS[category] || '#6366f1' });
  input.value = '';
  updateTagsDisplay();
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
    interpretations: interpData
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

// ========== VOICE RECORDING ==========
let isRecording = false;
window.toggleVoiceRecording = function() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) { alert('Dictée vocale non supportée. Essayez Chrome.'); return; }
  if (isRecording) { window._recognition?.stop(); isRecording = false; const btn = document.getElementById('voice-btn'); btn.innerHTML = '<i class="fas fa-microphone"></i>'; btn.classList.remove('bg-red-600/30', 'text-red-300'); btn.classList.add('bg-dream-600/30', 'text-dream-300'); return; }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR'; recognition.continuous = true; recognition.interimResults = true;
  recognition.onresult = (event) => { let t = ''; for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript; const ta = document.querySelector('textarea[name="content"]'); const before = ta.value.substring(0, ta.dataset.voiceStart || ta.value.length); ta.value = before + t; };
  recognition.onstart = () => { isRecording = true; const ta = document.querySelector('textarea[name="content"]'); ta.dataset.voiceStart = ta.value.length; const btn = document.getElementById('voice-btn'); btn.innerHTML = '<i class="fas fa-stop"></i>'; btn.classList.remove('bg-dream-600/30', 'text-dream-300'); btn.classList.add('bg-red-600/30', 'text-red-300'); };
  recognition.onend = () => { isRecording = false; const btn = document.getElementById('voice-btn'); if (btn) { btn.innerHTML = '<i class="fas fa-microphone"></i>'; btn.classList.remove('bg-red-600/30', 'text-red-300'); btn.classList.add('bg-dream-600/30', 'text-dream-300'); } };
  recognition.onerror = () => { isRecording = false; };
  window._recognition = recognition; recognition.start();
};

// ========== CONNECTION EDITOR ==========
window.openConnectionEditor = async function(dreamId, dreamTitle) {
  const data = await api('/dreams?limit=100');
  const otherDreams = data.dreams.filter(d => d.id !== dreamId);
  showModal(`
    <div class="p-4 sm:p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-display font-bold text-dream-100"><i class="fas fa-link mr-2"></i>Connecter</h2>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      <p class="text-xs text-gray-400 mb-3">Connecter "<span class="text-dream-300">${escapeHtml(dreamTitle)}</span>" à :</p>
      <div class="space-y-2 max-h-80 overflow-y-auto mb-4">
        ${otherDreams.map(d => `
          <div class="flex items-center gap-2 p-2.5 rounded-lg bg-night-900/40 hover:bg-night-900/60 cursor-pointer transition-all" onclick="createConnection(${dreamId}, ${d.id}, this)">
            <div class="flex-1 min-w-0"><p class="text-xs font-medium text-dream-200 truncate">${escapeHtml(d.title)}</p><p class="text-[10px] text-gray-500">${d.dream_date}</p></div>
            <select onclick="event.stopPropagation()" id="conn-type-${d.id}" class="text-[10px] px-1.5 py-1 bg-night-900/60 border border-dream-700/30 rounded text-gray-400">
              <option value="related">🔗 Lié</option><option value="sequel">➡️ Suite</option><option value="continuation">📖 Continuation</option>
              <option value="shared_character">👤 Perso commun</option><option value="shared_place">📍 Lieu commun</option><option value="shared_theme">💡 Thème commun</option>
            </select>
          </div>
        `).join('')}
      </div>
    </div>
  `);
};

window.createConnection = async function(fromId, toId, el) {
  const type = document.getElementById(`conn-type-${toId}`).value;
  try { await api('/connections', { method: 'POST', body: JSON.stringify({ dreamFromId: fromId, dreamToId: toId, connectionType: type }) }); el.style.opacity = '0.5'; el.style.pointerEvents = 'none'; el.querySelector('.flex-1').innerHTML += '<span class="text-[10px] text-emerald-400 ml-2">✓ Connecté</span>'; } catch (err) { alert(err.message); }
};

// ========== MAP VIEW ==========
async function renderMap() {
  const main = document.getElementById('main-content');
  try {
    const data = await api('/connections/graph'); state.graphData = data;
    if (data.nodes.length === 0) { main.innerHTML = `<div class="text-center py-12 animate-slideUp"><div class="text-5xl mb-4">🗺️</div><h3 class="text-lg font-display font-semibold text-dream-200 mb-2">Carte vide</h3><p class="text-gray-400 mb-6 max-w-md mx-auto text-sm">Notez vos rêves et créez des connexions pour voir émerger votre carte onirique.</p></div>`; return; }
    main.innerHTML = `
      <div class="animate-slideUp h-full">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h2 class="text-base font-display font-semibold text-dream-200"><i class="fas fa-project-diagram mr-2"></i>Carte des Rêves</h2>
          <div class="flex gap-2 text-[10px] flex-wrap">
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-indigo-400"></span>Normal</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-400"></span>Lucide</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400"></span>Cauchemar</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400"></span>Récurrent</span>
          </div>
        </div>
        <div id="graph-container" class="glass rounded-xl overflow-hidden graph-map-container"></div>
        <div id="graph-tooltip" class="fixed hidden glass rounded-lg p-3 text-sm z-50 pointer-events-none max-w-xs"></div>
      </div>`;
    renderForceGraph(data);
  } catch (err) { main.innerHTML = `<div class="text-center py-12 text-red-400">${err.message}</div>`; }
}

function renderForceGraph(data) {
  const container = document.getElementById('graph-container');
  const width = container.clientWidth, height = container.clientHeight;
  const typeColors = { normal: '#818cf8', lucid: '#34d399', nightmare: '#f87171', recurring: '#fbbf24', hypnagogic: '#22d3ee', false_awakening: '#f472b6' };
  const connColors = { related: '#6366f1', sequel: '#10b981', continuation: '#8b5cf6', shared_character: '#f59e0b', shared_place: '#06b6d4', shared_theme: '#ec4899' };
  const svg = d3.select('#graph-container').append('svg').attr('width', width).attr('height', height).attr('viewBox', [0, 0, width, height]);
  const defs = svg.append('defs'); const filter = defs.append('filter').attr('id', 'glow'); filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur'); const feMerge = filter.append('feMerge'); feMerge.append('feMergeNode').attr('in', 'coloredBlur'); feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
  const g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.3, 4]).on('zoom', (event) => g.attr('transform', event.transform)));
  const simulation = d3.forceSimulation(data.nodes).force('link', d3.forceLink(data.links).id(d => d.id).distance(100).strength(0.5)).force('charge', d3.forceManyBody().strength(-200)).force('center', d3.forceCenter(width / 2, height / 2)).force('collision', d3.forceCollide().radius(30));
  const link = g.append('g').selectAll('line').data(data.links).join('line').attr('stroke', d => connColors[d.connection_type] || '#6366f1').attr('stroke-opacity', 0.4).attr('stroke-width', d => (d.strength || 3) * 0.5);
  const node = g.append('g').selectAll('g').data(data.nodes).join('g').attr('class', 'graph-node')
    .call(d3.drag().on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }).on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; }).on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));
  node.append('circle').attr('r', d => 8 + (d.lucidity || 0) * 2 + (d.series?.length || 0) * 2).attr('fill', d => typeColors[d.type] || '#818cf8').attr('stroke', d => d.favorite ? '#fbbf24' : 'rgba(255,255,255,0.1)').attr('stroke-width', d => d.favorite ? 2 : 1).style('filter', 'url(#glow)');
  node.append('text').text(d => d.title.length > 18 ? d.title.substring(0, 16) + '…' : d.title).attr('dy', d => 20 + (d.lucidity || 0) * 2).attr('text-anchor', 'middle').attr('fill', 'rgba(200,200,220,0.8)').attr('font-size', '10px');
  const tooltip = document.getElementById('graph-tooltip');
  node.on('mouseover', (event, d) => { tooltip.classList.remove('hidden'); tooltip.innerHTML = `<p class="font-semibold text-dream-200">${escapeHtml(d.title)}</p><p class="text-xs text-gray-400">${d.date} • ${d.type}</p>`; })
    .on('mousemove', (event) => { tooltip.style.left = (event.pageX + 15) + 'px'; tooltip.style.top = (event.pageY - 10) + 'px'; })
    .on('mouseout', () => { tooltip.classList.add('hidden'); })
    .on('click', (event, d) => { openDreamDetail(d.id); });
  simulation.on('tick', () => { link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y); node.attr('transform', d => `translate(${d.x},${d.y})`); });
}

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
                <button onclick="event.stopPropagation(); startIncubation(${s.id})" class="flex-1 py-1.5 bg-dream-600/20 text-dream-300 rounded-lg text-[10px] hover:bg-dream-600/30 transition-all"><i class="fas fa-moon mr-1"></i>Incubation</button>
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
window.removeFromSeries = async function(seriesId, dreamId) { try { await api(`/series/${seriesId}/dreams/${dreamId}`, { method: 'DELETE' }); closeModal(); openSeriesDetail(seriesId); } catch (err) { alert(err.message); } };

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

// ========== LUCIDITY VIEW ==========
async function renderLucidity() {
  const main = document.getElementById('main-content');
  let rcStats = { total: 0, today: 0 }; try { rcStats = await api('/reality-checks/stats'); } catch {}
  main.innerHTML = `
    <div class="animate-slideUp">
      <h2 class="text-base font-display font-semibold text-dream-200 mb-5"><i class="fas fa-eye mr-2"></i>Aide à la Lucidité</h2>
      <div class="glass rounded-xl p-4 mb-5 text-center">
        <h3 class="text-lg font-display font-bold text-dream-100 mb-2">Contrôle de Réalité</h3>
        <p class="text-xs text-gray-400 mb-4">Regardez vos mains. Comptez vos doigts. Quelque chose est étrange ?</p>
        <div class="flex gap-2 justify-center flex-wrap mb-4">
          <button onclick="doRealityCheck('hands')" class="px-3 py-2 glass rounded-xl text-xs hover:border-dream-400/40 transition-all">✋ Mains</button>
          <button onclick="doRealityCheck('text')" class="px-3 py-2 glass rounded-xl text-xs hover:border-dream-400/40 transition-all">📖 Texte</button>
          <button onclick="doRealityCheck('time')" class="px-3 py-2 glass rounded-xl text-xs hover:border-dream-400/40 transition-all">⏰ Heure</button>
          <button onclick="doRealityCheck('nose')" class="px-3 py-2 glass rounded-xl text-xs hover:border-dream-400/40 transition-all">👃 Nez pincé</button>
          <button onclick="doRealityCheck('gravity')" class="px-3 py-2 glass rounded-xl text-xs hover:border-dream-400/40 transition-all">🪶 Gravité</button>
          <button onclick="doRealityCheck('light_switch')" class="px-3 py-2 glass rounded-xl text-xs hover:border-dream-400/40 transition-all">💡 Interrupteur</button>
        </div>
        <div class="flex items-center justify-center gap-4 text-xs">
          <span class="text-dream-300"><strong>${rcStats.today}</strong> aujourd'hui</span>
          <span class="text-gray-400"><strong>${rcStats.total}</strong> au total</span>
        </div>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <div class="glass rounded-xl p-4"><div class="text-xl mb-2">🧠</div><h4 class="font-semibold text-dream-200 text-sm mb-2">MILD</h4><p class="text-[10px] text-gray-400 mb-2">Répétez : "La prochaine fois que je rêve, je me rendrai compte que je rêve."</p><ol class="text-[10px] text-gray-300 space-y-1"><li>1. Mémorisez votre dernier rêve</li><li>2. Répétez votre intention</li><li>3. Visualisez-vous devenant lucide</li><li>4. Endormez-vous avec cette intention</li></ol><p class="text-[9px] text-gray-500 mt-2 italic">LaBerge (1985)</p></div>
        <div class="glass rounded-xl p-4"><div class="text-xl mb-2">⏰</div><h4 class="font-semibold text-dream-200 text-sm mb-2">WBTB</h4><p class="text-[10px] text-gray-400 mb-2">Réveil après 5-6h, rester éveillé 20-60 min, puis MILD.</p><ol class="text-[10px] text-gray-300 space-y-1"><li>1. Réveil après 5h</li><li>2. Restez éveillé 20-60 min</li><li>3. MILD au recoucher</li><li>4. Le REM facilite la lucidité</li></ol><p class="text-[9px] text-gray-500 mt-2 italic">Stumbrys et al. (2012)</p></div>
        <div class="glass rounded-xl p-4"><div class="text-xl mb-2">✋</div><h4 class="font-semibold text-dream-200 text-sm mb-2">Reality Testing</h4><p class="text-[10px] text-gray-400 mb-2">Tests réguliers créent un réflexe dans les rêves.</p><ol class="text-[10px] text-gray-300 space-y-1"><li>1. Questionnez la réalité 10-15x/jour</li><li>2. Comptez vos doigts</li><li>3. Poussez un doigt dans votre paume</li><li>4. Relisez un texte deux fois</li></ol><p class="text-[9px] text-gray-500 mt-2 italic">Tholey (1983)</p></div>
        <div class="glass rounded-xl p-4"><div class="text-xl mb-2">📝</div><h4 class="font-semibold text-dream-200 text-sm mb-2">Journal de Rêves</h4><p class="text-[10px] text-gray-400 mb-2">La base. Noter au réveil améliore le rappel.</p><ul class="text-[10px] text-gray-300 space-y-1"><li>• Écrivez dans les 5 min du réveil</li><li>• Notez même les fragments</li><li>• Utilisez le présent</li><li>• Identifiez vos signes de rêve</li></ul><p class="text-[9px] text-gray-500 mt-2 italic">Schredl (2002)</p></div>
        <div class="glass rounded-xl p-4"><div class="text-xl mb-2">🧘</div><h4 class="font-semibold text-dream-200 text-sm mb-2">SSILD</h4><p class="text-[10px] text-gray-400 mb-2">Rotation de l'attention entre les sens.</p><ol class="text-[10px] text-gray-300 space-y-1"><li>1. Après WBTB, allongez-vous</li><li>2. Vision (yeux fermés) ~20s</li><li>3. Ouïe ~20s</li><li>4. Sensations corporelles ~20s</li><li>5. Répétez 4-5 cycles</li></ol><p class="text-[9px] text-gray-500 mt-2 italic">Exploratoire</p></div>
        <div class="glass rounded-xl p-4"><div class="text-xl mb-2">🌙</div><h4 class="font-semibold text-dream-200 text-sm mb-2">Incubation</h4><p class="text-[10px] text-gray-400 mb-2">Suggestion pré-sommeil pour influencer les rêves.</p><ol class="text-[10px] text-gray-300 space-y-1"><li>1. Intention claire et positive</li><li>2. Visualisez la scène</li><li>3. Répétez au coucher</li><li>4. Gardez l'image en s'endormant</li></ol><p class="text-[9px] text-gray-500 mt-2 italic">Barrett (1993) — ~50% de succès.</p></div>
      </div>
      <div class="glass rounded-xl p-4">
        <h3 class="text-xs font-display font-semibold text-dream-200 mb-3"><i class="fas fa-flask mr-2"></i>Bases Scientifiques</h3>
        <div class="space-y-2 text-[10px] text-gray-300">
          <div class="p-2.5 rounded-lg bg-night-900/40"><p class="font-semibold text-dream-200 mb-1">📊 Rappel & journal</p><p>Schredl & Erlacher (2004) : le journal augmente significativement le rappel. Effet dès 2-3 semaines.</p></div>
          <div class="p-2.5 rounded-lg bg-night-900/40"><p class="font-semibold text-dream-200 mb-1">✨ Rêves lucides</p><p>Stumbrys et al. (2012), méta-analyse : MILD + WBTB + Reality Testing = approche la plus efficace.</p></div>
          <div class="p-2.5 rounded-lg bg-night-900/40"><p class="font-semibold text-dream-200 mb-1">🌙 Incubation</p><p>Barrett (Harvard, 1993) : ~50% ont rêvé du sujet choisi.</p></div>
          <div class="p-2.5 rounded-lg bg-night-900/40"><p class="font-semibold text-dream-200 mb-1">⚠️ Transparence</p><p>MILD et WBTB validés empiriquement. SSILD principalement communautaire. Rêve Mieux distingue clairement le validé de l'exploratoire.</p></div>
        </div>
      </div>
    </div>`;
}

window.doRealityCheck = async function(type) { try { await api('/reality-checks', { method: 'POST', body: JSON.stringify({ checkType: type, wasDreaming: false }) }); showToast('✋ Reality check enregistré !'); renderLucidity(); } catch {} };

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

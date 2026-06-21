// ============================================
// DreamScape — Application Frontend SPA
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
      <div class="glass rounded-2xl p-8 w-full max-w-md animate-slideUp">
        <div class="text-center mb-8">
          <div class="text-5xl mb-3 animate-float">🌙</div>
          <h1 class="text-3xl font-display font-bold bg-gradient-to-r from-dream-300 to-dream-500 bg-clip-text text-transparent">DreamScape</h1>
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
          <button type="submit" id="auth-btn" class="w-full py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg font-semibold hover:from-dream-400 hover:to-dream-600 transition-all shadow-lg shadow-dream-500/20">
            Se connecter
          </button>
        </form>
        
        <div class="mt-6 p-4 bg-dream-900/20 rounded-lg border border-dream-700/20">
          <p class="text-xs text-gray-400 text-center">
            <i class="fas fa-flask mr-1"></i>
            Basé sur les recherches de Schredl (2002), LaBerge (1985) et Stumbrys et al. (2012) sur le rappel onirique et les rêves lucides.
          </p>
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
      data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ 
        email: form.get('login'), username: form.get('username'), 
        password: form.get('password'), displayName: form.get('displayName')
      })});
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
    <div class="min-h-screen flex flex-col">
      <!-- Header -->
      <header class="glass sticky top-0 z-30 px-4 py-3">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🌙</span>
            <h1 class="text-lg font-display font-bold text-dream-200 hidden sm:block">DreamScape</h1>
          </div>
          <nav class="flex gap-1" id="main-nav">
            <button onclick="navigate('journal')" data-nav="journal" class="nav-tab px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all">
              <i class="fas fa-book-open mr-1"></i><span class="hidden sm:inline">Journal</span>
            </button>
            <button onclick="navigate('map')" data-nav="map" class="nav-tab px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all">
              <i class="fas fa-project-diagram mr-1"></i><span class="hidden sm:inline">Carte</span>
            </button>
            <button onclick="navigate('series')" data-nav="series" class="nav-tab px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all">
              <i class="fas fa-layer-group mr-1"></i><span class="hidden sm:inline">Séries</span>
            </button>
            <button onclick="navigate('stats')" data-nav="stats" class="nav-tab px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all">
              <i class="fas fa-chart-line mr-1"></i><span class="hidden sm:inline">Stats</span>
            </button>
            <button onclick="navigate('lucidity')" data-nav="lucidity" class="nav-tab px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all">
              <i class="fas fa-eye mr-1"></i><span class="hidden sm:inline">Lucidité</span>
            </button>
          </nav>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400 hidden md:block">${state.user?.displayName}</span>
            <button onclick="logout()" class="text-gray-400 hover:text-red-400 transition-colors p-2" title="Déconnexion">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main id="main-content" class="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
      </main>

      <!-- Quick Add FAB (mobile) -->
      <button onclick="openDreamEditor()" id="fab-add" class="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-dream-400 to-dream-600 rounded-full shadow-lg shadow-dream-500/30 flex items-center justify-center text-white text-xl hover:scale-110 transition-transform animate-glow">
        <i class="fas fa-plus"></i>
      </button>
    </div>

    <!-- Modal container -->
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
    case 'stats': renderStats(); break;
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
    state.dreams = data.dreams;
    state.pagination = data.pagination;
  } catch (err) {
    main.innerHTML = `<div class="text-center py-12 text-red-400">${err.message}</div>`;
    return;
  }
  
  main.innerHTML = `
    <div class="animate-slideUp">
      <!-- Search & Filters -->
      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <div class="flex-1 relative">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
          <input type="text" id="search-input" value="${state.filters.search}" placeholder="Rechercher dans vos rêves..." 
            class="w-full pl-10 pr-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-xl text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none"
            oninput="debounceSearch(this.value)">
        </div>
        <div class="flex gap-2">
          <select onchange="filterType(this.value)" class="px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-xl text-gray-300 focus:border-dream-400 focus:outline-none appearance-none cursor-pointer">
            <option value="all" ${state.filters.type === 'all' ? 'selected' : ''}>Tous les types</option>
            <option value="normal" ${state.filters.type === 'normal' ? 'selected' : ''}>🌀 Normal</option>
            <option value="lucid" ${state.filters.type === 'lucid' ? 'selected' : ''}>✨ Lucide</option>
            <option value="nightmare" ${state.filters.type === 'nightmare' ? 'selected' : ''}>👹 Cauchemar</option>
            <option value="recurring" ${state.filters.type === 'recurring' ? 'selected' : ''}>🔄 Récurrent</option>
            <option value="hypnagogic" ${state.filters.type === 'hypnagogic' ? 'selected' : ''}>🌊 Hypnagogique</option>
            <option value="false_awakening" ${state.filters.type === 'false_awakening' ? 'selected' : ''}>🪞 Faux éveil</option>
          </select>
          <button onclick="openDreamEditor()" class="px-4 py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-xl font-medium hover:from-dream-400 hover:to-dream-600 transition-all whitespace-nowrap">
            <i class="fas fa-plus mr-1"></i> Nouveau rêve
          </button>
        </div>
      </div>

      <!-- Dreams List -->
      <div id="dreams-list" class="space-y-3">
        ${state.dreams.length === 0 ? `
          <div class="text-center py-16">
            <div class="text-6xl mb-4 animate-float">🌙</div>
            <h3 class="text-xl font-display font-semibold text-dream-200 mb-2">Votre journal est vide</h3>
            <p class="text-gray-400 mb-6 max-w-md mx-auto">Commencez à noter vos rêves dès le réveil. La régularité est la clé — chaque rêve noté renforce votre capacité de rappel onirique.</p>
            <button onclick="openDreamEditor()" class="px-6 py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-xl font-medium hover:from-dream-400 hover:to-dream-600 transition-all">
              <i class="fas fa-feather-alt mr-2"></i>Noter mon premier rêve
            </button>
          </div>
        ` : state.dreams.map(d => renderDreamCard(d)).join('')}
      </div>

      <!-- Pagination -->
      ${state.pagination.pages > 1 ? `
        <div class="flex justify-center gap-2 mt-6">
          ${Array.from({ length: state.pagination.pages }, (_, i) => `
            <button onclick="goToPage(${i + 1})" class="w-10 h-10 rounded-lg text-sm font-medium transition-all ${state.pagination.page === i + 1 ? 'bg-dream-600 text-white' : 'bg-night-900/60 text-gray-400 hover:text-white'}">${i + 1}</button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderDreamCard(d) {
  const typeIcons = { normal: '🌀', lucid: '✨', nightmare: '👹', recurring: '🔄', hypnagogic: '🌊', false_awakening: '🪞' };
  const typeLabels = { normal: 'Normal', lucid: 'Lucide', nightmare: 'Cauchemar', recurring: 'Récurrent', hypnagogic: 'Hypnagogique', false_awakening: 'Faux éveil' };
  const emotionEmojis = { joy: '😊', fear: '😨', anxiety: '😰', wonder: '🤩', sadness: '😢', anger: '😡', confusion: '😵', peace: '😌', excitement: '🤯', love: '💗', nostalgia: '🥺' };
  
  const dateStr = new Date(d.dream_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const preview = d.content.length > 180 ? d.content.substring(0, 180) + '...' : d.content;
  
  return `
    <div class="glass rounded-xl p-4 hover:border-dream-400/30 transition-all cursor-pointer animate-fadeIn group" onclick="openDreamDetail(${d.id})">
      <div class="flex items-start gap-3">
        <div class="text-2xl mt-1">${typeIcons[d.dream_type] || '🌀'}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <h3 class="font-semibold text-dream-100 truncate">${escapeHtml(d.title)}</h3>
            ${d.is_favorite ? '<i class="fas fa-star text-yellow-400 text-xs"></i>' : ''}
            <span class="badge-${d.dream_type} text-[10px] px-2 py-0.5 rounded-full text-white font-medium">${typeLabels[d.dream_type] || 'Normal'}</span>
            ${d.lucidity_level > 0 ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/30 text-emerald-300">Lucidité: ${d.lucidity_level}/5</span>` : ''}
          </div>
          <p class="text-sm text-gray-400 mb-2 line-clamp-2">${escapeHtml(preview)}</p>
          <div class="flex items-center gap-3 flex-wrap">
            <span class="text-xs text-gray-500"><i class="far fa-calendar mr-1"></i>${dateStr}</span>
            ${d.emotions?.length ? `<span class="text-sm">${d.emotions.map(e => emotionEmojis[e.emotion] || '').join('')}</span>` : ''}
            ${d.tags?.length ? `<div class="flex gap-1 flex-wrap">${d.tags.slice(0, 3).map(t => `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-dream-800/40 text-dream-300">${escapeHtml(t.name)}</span>`).join('')}${d.tags.length > 3 ? `<span class="text-[10px] text-gray-500">+${d.tags.length - 3}</span>` : ''}</div>` : ''}
          </div>
        </div>
        <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button onclick="event.stopPropagation(); openDreamEditor(${d.id})" class="p-2 text-gray-400 hover:text-dream-300" title="Modifier"><i class="fas fa-edit text-xs"></i></button>
          <button onclick="event.stopPropagation(); deleteDream(${d.id})" class="p-2 text-gray-400 hover:text-red-400" title="Supprimer"><i class="fas fa-trash text-xs"></i></button>
        </div>
      </div>
    </div>
  `;
}

let searchTimeout;
window.debounceSearch = function(val) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { state.filters.search = val; state.pagination.page = 1; renderJournal(); }, 400);
};
window.filterType = function(val) { state.filters.type = val; state.pagination.page = 1; renderJournal(); };
window.goToPage = function(p) { state.pagination.page = p; renderJournal(); };

// ========== DREAM DETAIL VIEW ==========
window.openDreamDetail = async function(id) {
  try {
    const dream = await api(`/dreams/${id}`);
    showModal(renderDreamDetailModal(dream));
  } catch (err) { alert(err.message); }
};

function renderDreamDetailModal(d) {
  const typeLabels = { normal: 'Normal', lucid: 'Lucide', nightmare: 'Cauchemar', recurring: 'Récurrent', hypnagogic: 'Hypnagogique', false_awakening: 'Faux éveil' };
  const emotionEmojis = { joy: '😊', fear: '😨', anxiety: '😰', wonder: '🤩', sadness: '😢', anger: '😡', confusion: '😵', peace: '😌', excitement: '🤯', love: '💗', nostalgia: '🥺' };
  const dateStr = new Date(d.dream_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  return `
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="badge-${d.dream_type} text-xs px-3 py-1 rounded-full text-white font-medium">${typeLabels[d.dream_type] || 'Normal'}</span>
          ${d.lucidity_level > 0 ? `<span class="text-xs px-3 py-1 rounded-full bg-emerald-600/30 text-emerald-300">Lucidité ${d.lucidity_level}/5</span>` : ''}
          ${d.is_favorite ? '<i class="fas fa-star text-yellow-400"></i>' : ''}
        </div>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      
      <h2 class="text-2xl font-display font-bold text-dream-100 mb-2">${escapeHtml(d.title)}</h2>
      <p class="text-sm text-gray-400 mb-4"><i class="far fa-calendar mr-1"></i>${dateStr}</p>
      
      <div class="prose prose-invert max-w-none mb-6">
        <p class="text-gray-200 leading-relaxed whitespace-pre-wrap">${escapeHtml(d.content)}</p>
      </div>
      
      ${d.emotions?.length ? `
        <div class="mb-4">
          <h4 class="text-xs font-semibold text-gray-400 uppercase mb-2">Émotions</h4>
          <div class="flex flex-wrap gap-2">
            ${d.emotions.map(e => `
              <span class="flex items-center gap-1 px-3 py-1 rounded-full bg-dream-800/30 text-sm">
                ${emotionEmojis[e.emotion] || ''}
                <span class="text-dream-200 capitalize">${e.emotion}</span>
                <span class="text-[10px] text-gray-500">${e.intensity}/5</span>
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${d.tags?.length ? `
        <div class="mb-4">
          <h4 class="text-xs font-semibold text-gray-400 uppercase mb-2">Tags</h4>
          <div class="flex flex-wrap gap-2">
            ${d.tags.map(t => `<span class="px-3 py-1 rounded-full text-xs font-medium" style="background:${t.color}20; color:${t.color}; border: 1px solid ${t.color}40">${escapeHtml(t.name)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      
      ${d.connections?.length ? `
        <div class="mb-4">
          <h4 class="text-xs font-semibold text-gray-400 uppercase mb-2">Connexions</h4>
          <div class="space-y-1">
            ${d.connections.map(c => `
              <div class="flex items-center gap-2 p-2 rounded-lg bg-night-900/40 cursor-pointer hover:bg-night-900/60" onclick="closeModal(); setTimeout(() => openDreamDetail(${c.connected_dream_id}), 300)">
                <i class="fas fa-link text-dream-400 text-xs"></i>
                <span class="text-sm text-dream-200">${escapeHtml(c.connected_dream_title)}</span>
                <span class="text-[10px] text-gray-500 capitalize">${c.connection_type}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${d.series?.length ? `
        <div class="mb-4">
          <h4 class="text-xs font-semibold text-gray-400 uppercase mb-2">Séries</h4>
          <div class="flex flex-wrap gap-2">
            ${d.series.map(s => `<span class="px-3 py-1 rounded-full text-xs font-medium" style="background:${s.color}20; color:${s.color}">${escapeHtml(s.name)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="flex gap-2 pt-4 border-t border-dream-700/20">
        <button onclick="closeModal(); openDreamEditor(${d.id})" class="flex-1 py-2 bg-dream-600/30 text-dream-300 rounded-lg hover:bg-dream-600/50 transition-all text-sm font-medium">
          <i class="fas fa-edit mr-1"></i>Modifier
        </button>
        <button onclick="closeModal(); openConnectionEditor(${d.id}, '${escapeHtml(d.title)}')" class="flex-1 py-2 bg-night-800/50 text-gray-300 rounded-lg hover:bg-night-800/70 transition-all text-sm font-medium">
          <i class="fas fa-link mr-1"></i>Connecter
        </button>
        <button onclick="toggleFavorite(${d.id}, ${d.is_favorite})" class="py-2 px-4 bg-night-800/50 text-gray-300 rounded-lg hover:bg-night-800/70 transition-all text-sm">
          <i class="${d.is_favorite ? 'fas' : 'far'} fa-star text-yellow-400"></i>
        </button>
      </div>
    </div>
  `;
}

// ========== DREAM EDITOR ==========
window.openDreamEditor = async function(id) {
  let dream = null;
  let allTags = [];
  try { allTags = (await api('/tags')).tags; } catch {}
  
  if (id) {
    try { dream = await api(`/dreams/${id}`); } catch {}
  }
  
  const emotionList = ['joy', 'fear', 'anxiety', 'wonder', 'sadness', 'anger', 'confusion', 'peace', 'excitement', 'love', 'nostalgia'];
  const emotionEmojis = { joy: '😊', fear: '😨', anxiety: '😰', wonder: '🤩', sadness: '😢', anger: '😡', confusion: '😵', peace: '😌', excitement: '🤯', love: '💗', nostalgia: '🥺' };
  const emotionLabels = { joy: 'Joie', fear: 'Peur', anxiety: 'Anxiété', wonder: 'Émerveillement', sadness: 'Tristesse', anger: 'Colère', confusion: 'Confusion', peace: 'Paix', excitement: 'Excitation', love: 'Amour', nostalgia: 'Nostalgie' };
  
  const selectedEmotions = dream?.emotions?.reduce((acc, e) => { acc[e.emotion] = e.intensity; return acc; }, {}) || {};
  const selectedTags = dream?.tags || [];
  
  window._editorState = { emotions: selectedEmotions, tags: [...selectedTags], dream };
  
  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-display font-bold text-dream-100">${dream ? 'Modifier le rêve' : '🌙 Nouveau rêve'}</h2>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      
      <form onsubmit="saveDream(event, ${id || 'null'})">
        <input type="text" name="title" value="${dream ? escapeHtml(dream.title) : ''}" placeholder="Titre du rêve..." required
          class="w-full mb-3 px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-lg font-medium placeholder-gray-500 focus:border-dream-400 focus:outline-none">
        
        <div class="relative mb-3">
          <textarea name="content" rows="6" placeholder="Décrivez votre rêve en détail... Plus vous êtes précis, mieux c'est pour votre rappel onirique." required
            class="w-full px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none">${dream ? escapeHtml(dream.content) : ''}</textarea>
          <button type="button" onclick="toggleVoiceRecording()" id="voice-btn" class="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-dream-600/30 text-dream-300 hover:bg-dream-600/50 transition-all flex items-center justify-center" title="Dictée vocale">
            <i class="fas fa-microphone"></i>
          </button>
        </div>
        
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label class="text-xs text-gray-400 mb-1 block">Date du rêve</label>
            <input type="date" name="dreamDate" value="${dream?.dream_date || new Date().toISOString().split('T')[0]}"
              class="w-full px-3 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white focus:border-dream-400 focus:outline-none text-sm">
          </div>
          <div>
            <label class="text-xs text-gray-400 mb-1 block">Type de rêve</label>
            <select name="dreamType" class="w-full px-3 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white focus:border-dream-400 focus:outline-none text-sm">
              <option value="normal" ${dream?.dream_type === 'normal' ? 'selected' : ''}>🌀 Normal</option>
              <option value="lucid" ${dream?.dream_type === 'lucid' ? 'selected' : ''}>✨ Lucide</option>
              <option value="nightmare" ${dream?.dream_type === 'nightmare' ? 'selected' : ''}>👹 Cauchemar</option>
              <option value="recurring" ${dream?.dream_type === 'recurring' ? 'selected' : ''}>🔄 Récurrent</option>
              <option value="hypnagogic" ${dream?.dream_type === 'hypnagogic' ? 'selected' : ''}>🌊 Hypnagogique</option>
              <option value="false_awakening" ${dream?.dream_type === 'false_awakening' ? 'selected' : ''}>🪞 Faux éveil</option>
            </select>
          </div>
        </div>
        
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label class="text-xs text-gray-400 mb-1 block">Lucidité</label>
            <input type="range" name="lucidityLevel" min="0" max="5" value="${dream?.lucidity_level || 0}" oninput="this.nextElementSibling.textContent = this.value + '/5'" class="w-full accent-dream-400">
            <span class="text-xs text-dream-300">${dream?.lucidity_level || 0}/5</span>
          </div>
          <div>
            <label class="text-xs text-gray-400 mb-1 block">Clarté</label>
            <input type="range" name="clarity" min="1" max="5" value="${dream?.clarity || 3}" oninput="this.nextElementSibling.textContent = this.value + '/5'" class="w-full accent-dream-400">
            <span class="text-xs text-dream-300">${dream?.clarity || 3}/5</span>
          </div>
          <div>
            <label class="text-xs text-gray-400 mb-1 block">Sommeil</label>
            <input type="range" name="sleepQuality" min="0" max="5" value="${dream?.sleep_quality || 0}" oninput="this.nextElementSibling.textContent = this.value + '/5'" class="w-full accent-dream-400">
            <span class="text-xs text-dream-300">${dream?.sleep_quality || 0}/5</span>
          </div>
        </div>
        
        <!-- Emotions -->
        <div class="mb-4">
          <label class="text-xs text-gray-400 mb-2 block">Émotions ressenties</label>
          <div class="flex flex-wrap gap-2" id="emotions-picker">
            ${emotionList.map(em => `
              <button type="button" onclick="toggleEmotion('${em}')" id="em-${em}" 
                class="emotion-btn px-3 py-1.5 rounded-full text-sm border transition-all ${selectedEmotions[em] ? 'border-dream-400 bg-dream-600/30 text-dream-200 selected' : 'border-dream-700/30 bg-night-900/40 text-gray-400'}"
                title="${emotionLabels[em]}">
                ${emotionEmojis[em]} ${emotionLabels[em]}
              </button>
            `).join('')}
          </div>
        </div>
        
        <!-- Tags -->
        <div class="mb-4">
          <label class="text-xs text-gray-400 mb-2 block">Tags</label>
          <div id="selected-tags" class="flex flex-wrap gap-1 mb-2">
            ${selectedTags.map(t => `<span class="tag-chip px-2 py-1 rounded-full text-xs flex items-center gap-1" style="background:${t.color}20; color:${t.color}; border: 1px solid ${t.color}40">${escapeHtml(t.name)} <i class="fas fa-times cursor-pointer text-[10px] opacity-60 hover:opacity-100" onclick="removeTag('${escapeHtml(t.name)}')"></i></span>`).join('')}
          </div>
          <div class="flex gap-2">
            <input type="text" id="tag-input" placeholder="Ajouter un tag..." 
              class="flex-1 px-3 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-sm placeholder-gray-500 focus:border-dream-400 focus:outline-none"
              onkeydown="if(event.key==='Enter'){event.preventDefault(); addTag()}">
            <select id="tag-category" class="px-2 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-gray-400 text-xs focus:outline-none">
              <option value="custom">🏷 Custom</option>
              <option value="person">👤 Personne</option>
              <option value="place">📍 Lieu</option>
              <option value="theme">💡 Thème</option>
              <option value="symbol">🔮 Symbole</option>
            </select>
            <button type="button" onclick="addTag()" class="px-3 py-2 bg-dream-600/30 text-dream-300 rounded-lg hover:bg-dream-600/50 text-sm"><i class="fas fa-plus"></i></button>
          </div>
          ${allTags.length ? `
            <div class="flex flex-wrap gap-1 mt-2">
              ${allTags.slice(0, 10).map(t => `
                <button type="button" onclick="addExistingTag(${JSON.stringify(t).replace(/"/g, '&quot;')})" class="text-[10px] px-2 py-0.5 rounded-full bg-night-900/40 text-gray-500 hover:text-dream-300 transition-colors">${escapeHtml(t.name)}</button>
              `).join('')}
            </div>
          ` : ''}
        </div>
        
        <div id="save-error" class="text-red-400 text-sm mb-3 hidden"></div>
        
        <button type="submit" class="w-full py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg font-semibold hover:from-dream-400 hover:to-dream-600 transition-all">
          <i class="fas fa-save mr-2"></i>${dream ? 'Enregistrer les modifications' : 'Enregistrer ce rêve'}
        </button>
      </form>
    </div>
  `, '700px');
};

window.toggleEmotion = function(em) {
  if (window._editorState.emotions[em]) {
    delete window._editorState.emotions[em];
  } else {
    window._editorState.emotions[em] = 3;
  }
  const btn = document.getElementById(`em-${em}`);
  const isSelected = !!window._editorState.emotions[em];
  btn.className = `emotion-btn px-3 py-1.5 rounded-full text-sm border transition-all ${isSelected ? 'border-dream-400 bg-dream-600/30 text-dream-200 selected' : 'border-dream-700/30 bg-night-900/40 text-gray-400'}`;
};

window.addTag = function() {
  const input = document.getElementById('tag-input');
  const category = document.getElementById('tag-category').value;
  const name = input.value.trim();
  if (!name) return;
  if (window._editorState.tags.find(t => t.name === name)) return;
  
  const colors = { custom: '#6366f1', person: '#f59e0b', place: '#10b981', theme: '#ec4899', symbol: '#06b6d4' };
  window._editorState.tags.push({ name, category, color: colors[category] || '#6366f1' });
  input.value = '';
  updateTagsDisplay();
};

window.addExistingTag = function(tag) {
  if (window._editorState.tags.find(t => t.name === tag.name)) return;
  window._editorState.tags.push(tag);
  updateTagsDisplay();
};

window.removeTag = function(name) {
  window._editorState.tags = window._editorState.tags.filter(t => t.name !== name);
  updateTagsDisplay();
};

function updateTagsDisplay() {
  const container = document.getElementById('selected-tags');
  container.innerHTML = window._editorState.tags.map(t => 
    `<span class="tag-chip px-2 py-1 rounded-full text-xs flex items-center gap-1" style="background:${t.color}20; color:${t.color}; border: 1px solid ${t.color}40">${escapeHtml(t.name)} <i class="fas fa-times cursor-pointer text-[10px] opacity-60 hover:opacity-100" onclick="removeTag('${escapeHtml(t.name)}')"></i></span>`
  ).join('');
}

window.saveDream = async function(e, id) {
  e.preventDefault();
  const form = new FormData(e.target);
  const errEl = document.getElementById('save-error');
  errEl.classList.add('hidden');
  
  const body = {
    title: form.get('title'),
    content: form.get('content'),
    dreamDate: form.get('dreamDate'),
    dreamType: form.get('dreamType'),
    lucidityLevel: parseInt(form.get('lucidityLevel')),
    clarity: parseInt(form.get('clarity')),
    sleepQuality: parseInt(form.get('sleepQuality')),
    isFavorite: window._editorState.dream?.is_favorite || false,
    emotions: Object.entries(window._editorState.emotions).map(([emotion, intensity]) => ({ emotion, intensity })),
    tags: window._editorState.tags
  };
  
  try {
    if (id) {
      await api(`/dreams/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await api('/dreams', { method: 'POST', body: JSON.stringify(body) });
    }
    closeModal();
    if (state.currentView === 'journal') renderJournal();
  } catch (err) {
    errEl.textContent = err.message; errEl.classList.remove('hidden');
  }
};

window.deleteDream = async function(id) {
  if (!confirm('Supprimer ce rêve ? Cette action est irréversible.')) return;
  try {
    await api(`/dreams/${id}`, { method: 'DELETE' });
    renderJournal();
  } catch (err) { alert(err.message); }
};

window.toggleFavorite = async function(id, current) {
  try {
    const dream = await api(`/dreams/${id}`);
    dream.isFavorite = !current;
    dream.dreamDate = dream.dream_date;
    dream.dreamType = dream.dream_type;
    dream.lucidityLevel = dream.lucidity_level;
    dream.sleepQuality = dream.sleep_quality;
    await api(`/dreams/${id}`, { method: 'PUT', body: JSON.stringify(dream) });
    closeModal();
    openDreamDetail(id);
  } catch (err) { alert(err.message); }
};

// ========== VOICE RECORDING ==========
let mediaRecorder, audioChunks = [];
let isRecording = false;

window.toggleVoiceRecording = function() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    alert('La dictée vocale n\'est pas supportée par votre navigateur. Essayez Chrome.');
    return;
  }
  
  if (isRecording) {
    window._recognition?.stop();
    isRecording = false;
    const btn = document.getElementById('voice-btn');
    btn.innerHTML = '<i class="fas fa-microphone"></i>';
    btn.classList.remove('bg-red-600/30', 'text-red-300');
    btn.classList.add('bg-dream-600/30', 'text-dream-300');
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.continuous = true;
  recognition.interimResults = true;
  
  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    const textarea = document.querySelector('textarea[name="content"]');
    const before = textarea.value.substring(0, textarea.dataset.voiceStart || textarea.value.length);
    textarea.value = before + transcript;
  };
  
  recognition.onstart = () => {
    isRecording = true;
    const textarea = document.querySelector('textarea[name="content"]');
    textarea.dataset.voiceStart = textarea.value.length;
    const btn = document.getElementById('voice-btn');
    btn.innerHTML = '<i class="fas fa-stop"></i>';
    btn.classList.remove('bg-dream-600/30', 'text-dream-300');
    btn.classList.add('bg-red-600/30', 'text-red-300');
  };
  
  recognition.onend = () => {
    isRecording = false;
    const btn = document.getElementById('voice-btn');
    if (btn) {
      btn.innerHTML = '<i class="fas fa-microphone"></i>';
      btn.classList.remove('bg-red-600/30', 'text-red-300');
      btn.classList.add('bg-dream-600/30', 'text-dream-300');
    }
  };
  
  recognition.onerror = (e) => {
    console.error('Speech recognition error:', e.error);
    isRecording = false;
  };
  
  window._recognition = recognition;
  recognition.start();
};

// ========== CONNECTION EDITOR ==========
window.openConnectionEditor = async function(dreamId, dreamTitle) {
  const data = await api('/dreams?limit=100');
  const otherDreams = data.dreams.filter(d => d.id !== dreamId);
  
  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-display font-bold text-dream-100"><i class="fas fa-link mr-2"></i>Connecter "${escapeHtml(dreamTitle)}"</h2>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
      </div>
      
      <div class="space-y-3 max-h-96 overflow-y-auto mb-4">
        ${otherDreams.map(d => `
          <div class="flex items-center gap-3 p-3 rounded-lg bg-night-900/40 hover:bg-night-900/60 cursor-pointer transition-all" onclick="createConnection(${dreamId}, ${d.id}, this)">
            <div class="flex-1">
              <p class="text-sm font-medium text-dream-200">${escapeHtml(d.title)}</p>
              <p class="text-xs text-gray-500">${d.dream_date}</p>
            </div>
            <select onclick="event.stopPropagation()" id="conn-type-${d.id}" class="text-xs px-2 py-1 bg-night-900/60 border border-dream-700/30 rounded text-gray-400">
              <option value="related">🔗 Lié</option>
              <option value="sequel">➡️ Suite</option>
              <option value="continuation">📖 Continuation</option>
              <option value="shared_character">👤 Personnage commun</option>
              <option value="shared_place">📍 Lieu commun</option>
              <option value="shared_theme">💡 Thème commun</option>
            </select>
          </div>
        `).join('')}
      </div>
    </div>
  `);
};

window.createConnection = async function(fromId, toId, el) {
  const type = document.getElementById(`conn-type-${toId}`).value;
  try {
    await api('/connections', { method: 'POST', body: JSON.stringify({ dreamFromId: fromId, dreamToId: toId, connectionType: type }) });
    el.style.opacity = '0.5';
    el.style.pointerEvents = 'none';
    el.querySelector('.flex-1').innerHTML += '<span class="text-xs text-emerald-400 ml-2">✓ Connecté</span>';
  } catch (err) { alert(err.message); }
};

// ========== MAP VIEW (D3.js Force Graph) ==========
async function renderMap() {
  const main = document.getElementById('main-content');
  try {
    const data = await api('/connections/graph');
    state.graphData = data;
    
    if (data.nodes.length === 0) {
      main.innerHTML = `
        <div class="text-center py-16 animate-slideUp">
          <div class="text-6xl mb-4">🗺️</div>
          <h3 class="text-xl font-display font-semibold text-dream-200 mb-2">Votre carte des rêves est vide</h3>
          <p class="text-gray-400 mb-6 max-w-md mx-auto">Notez vos rêves et créez des connexions entre eux pour voir émerger votre carte onirique.</p>
        </div>`;
      return;
    }
    
    main.innerHTML = `
      <div class="animate-slideUp">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-display font-semibold text-dream-200"><i class="fas fa-project-diagram mr-2"></i>Carte des Rêves</h2>
          <div class="flex gap-2 text-xs">
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-indigo-400 inline-block"></span>Normal</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span>Lucide</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-red-400 inline-block"></span>Cauchemar</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>Récurrent</span>
          </div>
        </div>
        <div id="graph-container" class="glass rounded-xl overflow-hidden" style="height: 500px; position: relative;"></div>
        <div id="graph-tooltip" class="fixed hidden glass rounded-lg p-3 text-sm z-50 pointer-events-none max-w-xs"></div>
      </div>`;
    
    renderForceGraph(data);
  } catch (err) {
    main.innerHTML = `<div class="text-center py-12 text-red-400">${err.message}</div>`;
  }
}

function renderForceGraph(data) {
  const container = document.getElementById('graph-container');
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  const typeColors = { normal: '#818cf8', lucid: '#34d399', nightmare: '#f87171', recurring: '#fbbf24', hypnagogic: '#22d3ee', false_awakening: '#f472b6' };
  const connColors = { related: '#6366f1', sequel: '#10b981', continuation: '#8b5cf6', shared_character: '#f59e0b', shared_place: '#06b6d4', shared_theme: '#ec4899' };
  
  const svg = d3.select('#graph-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height]);
  
  // Defs for glow effect
  const defs = svg.append('defs');
  const filter = defs.append('filter').attr('id', 'glow');
  filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
  const feMerge = filter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
  
  const g = svg.append('g');
  
  // Zoom
  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);
  
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.links).id(d => d.id).distance(100).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(30));
  
  // Links
  const link = g.append('g')
    .selectAll('line')
    .data(data.links)
    .join('line')
    .attr('stroke', d => connColors[d.connection_type] || '#6366f1')
    .attr('stroke-opacity', 0.4)
    .attr('stroke-width', d => (d.strength || 3) * 0.5);
  
  // Nodes
  const node = g.append('g')
    .selectAll('g')
    .data(data.nodes)
    .join('g')
    .attr('class', 'graph-node')
    .call(d3.drag()
      .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );
  
  node.append('circle')
    .attr('r', d => 8 + (d.lucidity || 0) * 2 + (d.series?.length || 0) * 2)
    .attr('fill', d => typeColors[d.type] || '#818cf8')
    .attr('stroke', d => d.favorite ? '#fbbf24' : 'rgba(255,255,255,0.1)')
    .attr('stroke-width', d => d.favorite ? 2 : 1)
    .style('filter', 'url(#glow)');
  
  // Labels
  node.append('text')
    .text(d => d.title.length > 20 ? d.title.substring(0, 18) + '...' : d.title)
    .attr('dy', d => 20 + (d.lucidity || 0) * 2)
    .attr('text-anchor', 'middle')
    .attr('fill', 'rgba(200,200,220,0.8)')
    .attr('font-size', '10px');
  
  // Tooltip
  const tooltip = document.getElementById('graph-tooltip');
  node.on('mouseover', (event, d) => {
    tooltip.classList.remove('hidden');
    tooltip.innerHTML = `
      <p class="font-semibold text-dream-200">${escapeHtml(d.title)}</p>
      <p class="text-xs text-gray-400">${d.date} • ${d.type}</p>
      ${d.emotions?.length ? `<p class="text-xs mt-1">${d.emotions.join(', ')}</p>` : ''}
      ${d.series?.length ? `<p class="text-xs text-dream-400 mt-1">Série: ${d.series.map(s => s.name).join(', ')}</p>` : ''}
    `;
  }).on('mousemove', (event) => {
    tooltip.style.left = (event.pageX + 15) + 'px';
    tooltip.style.top = (event.pageY - 10) + 'px';
  }).on('mouseout', () => {
    tooltip.classList.add('hidden');
  }).on('click', (event, d) => {
    openDreamDetail(d.id);
  });
  
  simulation.on('tick', () => {
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

// ========== SERIES VIEW ==========
async function renderSeries() {
  const main = document.getElementById('main-content');
  try {
    const data = await api('/series');
    state.series = data.series;
  } catch (err) {
    main.innerHTML = `<div class="text-center py-12 text-red-400">${err.message}</div>`;
    return;
  }
  
  main.innerHTML = `
    <div class="animate-slideUp">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-display font-semibold text-dream-200"><i class="fas fa-layer-group mr-2"></i>Séries de Rêves</h2>
        <button onclick="openSeriesEditor()" class="px-4 py-2 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg text-sm font-medium hover:from-dream-400 hover:to-dream-600 transition-all">
          <i class="fas fa-plus mr-1"></i>Nouvelle série
        </button>
      </div>
      
      ${state.series.length === 0 ? `
        <div class="text-center py-16">
          <div class="text-6xl mb-4">📚</div>
          <h3 class="text-xl font-display font-semibold text-dream-200 mb-2">Aucune série créée</h3>
          <p class="text-gray-400 mb-6 max-w-md mx-auto">Regroupez vos rêves en séries narratives pour suivre des trames qui se poursuivent de nuit en nuit.</p>
          <button onclick="openSeriesEditor()" class="px-6 py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-xl font-medium">
            <i class="fas fa-plus mr-2"></i>Créer ma première série
          </button>
        </div>
      ` : `
        <div class="grid gap-4 md:grid-cols-2">
          ${state.series.map(s => `
            <div class="glass rounded-xl p-5 hover:border-dream-400/30 transition-all cursor-pointer" onclick="openSeriesDetail(${s.id})">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-4 h-4 rounded-full" style="background:${s.color}"></div>
                <h3 class="font-semibold text-dream-100 flex-1">${escapeHtml(s.name)}</h3>
                <span class="text-xs text-gray-500">${s.dream_count || 0} rêve(s)</span>
              </div>
              ${s.description ? `<p class="text-sm text-gray-400 mb-3 line-clamp-2">${escapeHtml(s.description)}</p>` : ''}
              ${s.incubation_prompt ? `
                <div class="p-2 rounded-lg bg-dream-900/20 border border-dream-700/20">
                  <p class="text-xs text-dream-300"><i class="fas fa-moon mr-1"></i>Intention: ${escapeHtml(s.incubation_prompt)}</p>
                </div>
              ` : ''}
              ${s.last_dream_date ? `<p class="text-xs text-gray-500 mt-2">Dernier rêve: ${s.last_dream_date}</p>` : ''}
              <div class="flex gap-2 mt-3">
                <button onclick="event.stopPropagation(); startIncubation(${s.id})" class="flex-1 py-2 bg-dream-600/20 text-dream-300 rounded-lg text-xs hover:bg-dream-600/30 transition-all">
                  <i class="fas fa-moon mr-1"></i>Incubation ce soir
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

window.openSeriesDetail = async function(id) {
  try {
    const series = await api(`/series/${id}`);
    showModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded-full" style="background:${series.color}"></div>
            <h2 class="text-xl font-display font-bold text-dream-100">${escapeHtml(series.name)}</h2>
          </div>
          <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
        </div>
        
        ${series.description ? `<p class="text-gray-400 mb-4">${escapeHtml(series.description)}</p>` : ''}
        
        ${series.incubation_prompt ? `
          <div class="p-3 rounded-lg bg-dream-900/20 border border-dream-700/20 mb-4">
            <p class="text-sm text-dream-300"><i class="fas fa-moon mr-2"></i>${escapeHtml(series.incubation_prompt)}</p>
          </div>
        ` : ''}
        
        <h4 class="text-xs font-semibold text-gray-400 uppercase mb-3">Rêves de la série (${series.dreams?.length || 0})</h4>
        <div class="space-y-2 max-h-64 overflow-y-auto mb-4">
          ${(series.dreams || []).map((d, i) => `
            <div class="flex items-center gap-3 p-3 rounded-lg bg-night-900/40">
              <span class="w-6 h-6 rounded-full bg-dream-600/30 text-dream-300 text-xs flex items-center justify-center font-bold">${i + 1}</span>
              <div class="flex-1">
                <p class="text-sm font-medium text-dream-200">${escapeHtml(d.title)}</p>
                <p class="text-xs text-gray-500">${d.dream_date}</p>
              </div>
              <button onclick="removeFromSeries(${id}, ${d.id})" class="text-gray-500 hover:text-red-400 text-xs"><i class="fas fa-times"></i></button>
            </div>
          `).join('')}
        </div>
        
        <button onclick="closeModal(); addDreamToSeries(${id})" class="w-full py-2 bg-dream-600/20 text-dream-300 rounded-lg text-sm hover:bg-dream-600/30 transition-all mb-2">
          <i class="fas fa-plus mr-1"></i>Ajouter un rêve à cette série
        </button>
        <button onclick="closeModal(); startIncubation(${id})" class="w-full py-2 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg text-sm font-medium">
          <i class="fas fa-moon mr-1"></i>Mode incubation pour ce soir
        </button>
      </div>
    `);
  } catch (err) { alert(err.message); }
};

window.openSeriesEditor = function(series) {
  showModal(`
    <div class="p-6">
      <h2 class="text-xl font-display font-bold text-dream-100 mb-4">${series ? 'Modifier la série' : '📚 Nouvelle série'}</h2>
      <form onsubmit="saveSeries(event, ${series?.id || 'null'})">
        <input type="text" name="name" value="${series?.name || ''}" placeholder="Nom de la série" required
          class="w-full mb-3 px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none">
        <textarea name="description" rows="2" placeholder="Description (optionnel)"
          class="w-full mb-3 px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none">${series?.description || ''}</textarea>
        <textarea name="incubationPrompt" rows="2" placeholder="Intention d'incubation — Ce que vous souhaitez rêver ce soir pour cette série..."
          class="w-full mb-3 px-4 py-3 bg-night-900/60 border border-dream-700/30 rounded-lg text-white placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none">${series?.incubation_prompt || ''}</textarea>
        <div class="mb-4">
          <label class="text-xs text-gray-400 mb-1 block">Couleur</label>
          <input type="color" name="color" value="${series?.color || '#8b5cf6'}" class="w-12 h-8 rounded cursor-pointer bg-transparent">
        </div>
        <button type="submit" class="w-full py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-lg font-semibold">
          <i class="fas fa-save mr-2"></i>Enregistrer
        </button>
      </form>
    </div>
  `);
};

window.saveSeries = async function(e, id) {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = { name: form.get('name'), description: form.get('description'), color: form.get('color'), incubationPrompt: form.get('incubationPrompt') };
  
  try {
    if (id) { await api(`/series/${id}`, { method: 'PUT', body: JSON.stringify(body) }); }
    else { await api('/series', { method: 'POST', body: JSON.stringify(body) }); }
    closeModal();
    renderSeries();
  } catch (err) { alert(err.message); }
};

window.addDreamToSeries = async function(seriesId) {
  const data = await api('/dreams?limit=100');
  showModal(`
    <div class="p-6">
      <h2 class="text-lg font-display font-bold text-dream-100 mb-4">Ajouter un rêve à la série</h2>
      <div class="space-y-2 max-h-96 overflow-y-auto">
        ${data.dreams.map(d => `
          <div class="flex items-center gap-3 p-3 rounded-lg bg-night-900/40 hover:bg-night-900/60 cursor-pointer transition-all" onclick="addToSeries(${seriesId}, ${d.id}, this)">
            <p class="text-sm font-medium text-dream-200 flex-1">${escapeHtml(d.title)}</p>
            <p class="text-xs text-gray-500">${d.dream_date}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `);
};

window.addToSeries = async function(seriesId, dreamId, el) {
  try {
    await api(`/series/${seriesId}/dreams`, { method: 'POST', body: JSON.stringify({ dreamId }) });
    el.style.opacity = '0.5';
    el.innerHTML += '<span class="text-xs text-emerald-400 ml-2">✓</span>';
  } catch (err) { alert(err.message); }
};

window.removeFromSeries = async function(seriesId, dreamId) {
  try {
    await api(`/series/${seriesId}/dreams/${dreamId}`, { method: 'DELETE' });
    openSeriesDetail(seriesId);
  } catch (err) { alert(err.message); }
};

// ========== INCUBATION MODE ==========
window.startIncubation = async function(seriesId) {
  let series, lastDream;
  try {
    const data = await api(`/series/${seriesId}`);
    series = data;
    if (data.dreams?.length) {
      lastDream = data.dreams[data.dreams.length - 1];
    }
  } catch (err) { alert(err.message); return; }
  
  showModal(`
    <div class="incubation-bg p-6 rounded-xl">
      <div class="text-center mb-6">
        <div class="text-5xl mb-3 animate-float">🌙</div>
        <h2 class="text-2xl font-display font-bold text-dream-100">Mode Incubation</h2>
        <p class="text-sm text-gray-400 mt-1">Préparez votre esprit pour la nuit</p>
      </div>
      
      <div class="glass rounded-xl p-4 mb-4">
        <h3 class="text-sm font-semibold text-dream-300 mb-2"><i class="fas fa-layer-group mr-1"></i>Série: ${escapeHtml(series.name)}</h3>
        ${series.description ? `<p class="text-xs text-gray-400 mb-3">${escapeHtml(series.description)}</p>` : ''}
        
        ${lastDream ? `
          <div class="p-3 rounded-lg bg-night-900/40 mb-3">
            <p class="text-xs font-semibold text-dream-200 mb-1">📖 Dernier épisode: ${escapeHtml(lastDream.title)}</p>
            <p class="text-xs text-gray-400 line-clamp-4">${escapeHtml(lastDream.content)}</p>
          </div>
        ` : ''}
      </div>
      
      <div class="glass rounded-xl p-4 mb-4">
        <h3 class="text-sm font-semibold text-dream-300 mb-2"><i class="fas fa-moon mr-1"></i>Votre intention pour cette nuit</h3>
        <textarea id="incubation-intent" rows="3" placeholder="Formulez votre intention... Ex: 'Ce soir, je retourne dans la forêt lumineuse et j'explore le sentier que j'avais aperçu...'"
          class="w-full px-3 py-2 bg-night-900/60 border border-dream-700/30 rounded-lg text-white text-sm placeholder-gray-500 focus:border-dream-400 focus:outline-none resize-none">${series.incubation_prompt || ''}</textarea>
      </div>
      
      <div class="glass rounded-xl p-4 mb-6">
        <h3 class="text-sm font-semibold text-amber-300 mb-2"><i class="fas fa-lightbulb mr-1"></i>Technique d'incubation</h3>
        <ol class="text-xs text-gray-300 space-y-2">
          <li>1. <strong>Relisez</strong> le dernier épisode de la série ci-dessus</li>
          <li>2. <strong>Visualisez</strong> la scène finale en fermant les yeux</li>
          <li>3. <strong>Répétez</strong> mentalement votre intention comme un mantra</li>
          <li>4. <strong>Endormez-vous</strong> en gardant cette image à l'esprit</li>
        </ol>
        <p class="text-[10px] text-gray-500 mt-2 italic">Basé sur les travaux de Deirdre Barrett (Harvard) sur l'incubation des rêves — efficacité démontrée chez ~50% des sujets.</p>
      </div>
      
      <button onclick="saveIncubation(${seriesId})" class="w-full py-3 bg-gradient-to-r from-dream-500 to-dream-700 text-white rounded-xl font-semibold text-lg">
        🌙 Enregistrer et bonne nuit
      </button>
    </div>
  `, '500px');
};

window.saveIncubation = async function(seriesId) {
  const intent = document.getElementById('incubation-intent').value;
  if (!intent.trim()) { alert('Formulez une intention pour ce soir'); return; }
  try {
    await api('/incubation', { method: 'POST', body: JSON.stringify({ seriesId, intentText: intent, targetDate: new Date().toISOString().split('T')[0] }) });
    closeModal();
    // Show gentle reminder
    showToast('🌙 Intention enregistrée. Relisez-la avant de vous endormir. Bonne nuit !');
  } catch (err) { alert(err.message); }
};

// ========== STATS VIEW ==========
async function renderStats() {
  const main = document.getElementById('main-content');
  try {
    const [stats, heatmap] = await Promise.all([api('/stats'), api('/stats/heatmap')]);
    state.stats = stats;
    
    main.innerHTML = `
      <div class="animate-slideUp">
        <h2 class="text-lg font-display font-semibold text-dream-200 mb-6"><i class="fas fa-chart-line mr-2"></i>Statistiques & Progression</h2>
        
        <!-- Overview Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div class="glass rounded-xl p-4 text-center">
            <div class="text-3xl font-display font-bold text-dream-300">${stats.overview.totalDreams}</div>
            <div class="text-xs text-gray-400 mt-1">Rêves totaux</div>
          </div>
          <div class="glass rounded-xl p-4 text-center">
            <div class="text-3xl font-display font-bold text-emerald-400">${stats.overview.lucidDreams}</div>
            <div class="text-xs text-gray-400 mt-1">Rêves lucides</div>
          </div>
          <div class="glass rounded-xl p-4 text-center">
            <div class="text-3xl font-display font-bold text-amber-400">${stats.overview.streak}</div>
            <div class="text-xs text-gray-400 mt-1">Jours de suite 🔥</div>
          </div>
          <div class="glass rounded-xl p-4 text-center">
            <div class="text-3xl font-display font-bold text-pink-400">${stats.overview.lucidRate}%</div>
            <div class="text-xs text-gray-400 mt-1">Taux de lucidité</div>
          </div>
        </div>
        
        <!-- Charts -->
        <div class="grid md:grid-cols-2 gap-4 mb-6">
          <div class="glass rounded-xl p-4">
            <h3 class="text-sm font-semibold text-dream-200 mb-3">Rêves par semaine</h3>
            <canvas id="weekly-chart" height="200"></canvas>
          </div>
          <div class="glass rounded-xl p-4">
            <h3 class="text-sm font-semibold text-dream-200 mb-3">Émotions dominantes</h3>
            <canvas id="emotions-chart" height="200"></canvas>
          </div>
        </div>
        
        <div class="grid md:grid-cols-2 gap-4 mb-6">
          <div class="glass rounded-xl p-4">
            <h3 class="text-sm font-semibold text-dream-200 mb-3">Types de rêves</h3>
            <canvas id="types-chart" height="200"></canvas>
          </div>
          <div class="glass rounded-xl p-4">
            <h3 class="text-sm font-semibold text-dream-200 mb-3">Tags populaires</h3>
            <div class="flex flex-wrap gap-2 mt-2">
              ${stats.topTags.map(t => `
                <span class="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1" style="background:${t.color}20; color:${t.color}; border: 1px solid ${t.color}40">
                  ${escapeHtml(t.name)} <span class="opacity-60">(${t.count})</span>
                </span>
              `).join('') || '<span class="text-gray-500 text-sm">Aucun tag encore</span>'}
            </div>
          </div>
        </div>
        
        <!-- Heatmap -->
        <div class="glass rounded-xl p-4">
          <h3 class="text-sm font-semibold text-dream-200 mb-3">Calendrier de rappel</h3>
          <div id="heatmap-container" class="overflow-x-auto"></div>
        </div>
      </div>`;
    
    // Render charts
    renderWeeklyChart(stats.weeklyData);
    renderEmotionsChart(stats.emotionStats);
    renderTypesChart(stats.typeStats);
    renderHeatmap(heatmap.heatmap);
    
  } catch (err) {
    main.innerHTML = `<div class="text-center py-12 text-red-400">${err.message}</div>`;
  }
}

function renderWeeklyChart(data) {
  const ctx = document.getElementById('weekly-chart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.week),
      datasets: [
        { label: 'Total', data: data.map(d => d.total), backgroundColor: 'rgba(99, 102, 241, 0.6)', borderRadius: 4 },
        { label: 'Lucides', data: data.map(d => d.lucid), backgroundColor: 'rgba(52, 211, 153, 0.6)', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9ca3af', font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: 'rgba(99,102,241,0.05)' } },
        y: { ticks: { color: '#6b7280', stepSize: 1 }, grid: { color: 'rgba(99,102,241,0.05)' } }
      }
    }
  });
}

function renderEmotionsChart(data) {
  const ctx = document.getElementById('emotions-chart');
  if (!ctx || !data.length) return;
  const emotionEmojis = { joy: '😊', fear: '😨', anxiety: '😰', wonder: '🤩', sadness: '😢', anger: '😡', confusion: '😵', peace: '😌', excitement: '🤯', love: '💗', nostalgia: '🥺' };
  const colors = ['#818cf8', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee', '#f472b6', '#4ade80', '#e879f9', '#38bdf8'];
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => (emotionEmojis[d.emotion] || '') + ' ' + d.emotion),
      datasets: [{ data: data.map(d => d.count), backgroundColor: colors.slice(0, data.length), borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 10 }, padding: 8 } } }
    }
  });
}

function renderTypesChart(data) {
  const ctx = document.getElementById('types-chart');
  if (!ctx || !data.length) return;
  const typeColors = { normal: '#818cf8', lucid: '#34d399', nightmare: '#f87171', recurring: '#fbbf24', hypnagogic: '#22d3ee', false_awakening: '#f472b6' };
  const typeLabels = { normal: 'Normal', lucid: 'Lucide', nightmare: 'Cauchemar', recurring: 'Récurrent', hypnagogic: 'Hypnagogique', false_awakening: 'Faux éveil' };
  
  new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: data.map(d => typeLabels[d.dream_type] || d.dream_type),
      datasets: [{ data: data.map(d => d.count), backgroundColor: data.map(d => (typeColors[d.dream_type] || '#818cf8') + '80'), borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 10 } } } },
      scales: { r: { ticks: { display: false }, grid: { color: 'rgba(99,102,241,0.1)' } } }
    }
  });
}

function renderHeatmap(data) {
  const container = document.getElementById('heatmap-container');
  if (!container) return;
  
  const cellSize = 14;
  const gap = 2;
  const weeks = 52;
  const width = weeks * (cellSize + gap) + 50;
  const height = 7 * (cellSize + gap) + 20;
  
  const dataMap = {};
  data.forEach(d => { dataMap[d.dream_date] = d; });
  
  const svg = d3.select('#heatmap-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const today = new Date();
  const dayLabels = ['', 'Lun', '', 'Mer', '', 'Ven', ''];
  
  // Day labels
  svg.selectAll('.day-label')
    .data(dayLabels)
    .enter().append('text')
    .attr('x', 0)
    .attr('y', (d, i) => i * (cellSize + gap) + cellSize + 10)
    .text(d => d)
    .attr('fill', '#6b7280')
    .attr('font-size', '9px');
  
  // Cells
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - ((weeks - 1 - w) * 7 + (6 - d)));
      const dateStr = date.toISOString().split('T')[0];
      const entry = dataMap[dateStr];
      
      let color = 'rgba(139, 92, 246, 0.05)';
      if (entry) {
        if (entry.lucid_count > 0) color = `rgba(52, 211, 153, ${Math.min(0.3 + entry.count * 0.2, 1)})`;
        else color = `rgba(99, 102, 241, ${Math.min(0.2 + entry.count * 0.2, 0.9)})`;
      }
      
      svg.append('rect')
        .attr('class', 'heatmap-cell')
        .attr('x', w * (cellSize + gap) + 30)
        .attr('y', d * (cellSize + gap) + 10)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', color)
        .attr('rx', 2)
        .append('title')
        .text(`${dateStr}: ${entry ? entry.count + ' rêve(s)' : 'aucun rêve'}`);
    }
  }
}

// ========== LUCIDITY VIEW ==========
async function renderLucidity() {
  const main = document.getElementById('main-content');
  let rcStats = { total: 0, today: 0, byType: [], weekly: [] };
  try { rcStats = await api('/reality-checks/stats'); } catch {}
  
  main.innerHTML = `
    <div class="animate-slideUp">
      <h2 class="text-lg font-display font-semibold text-dream-200 mb-6"><i class="fas fa-eye mr-2"></i>Aide à la Lucidité</h2>
      
      <!-- Reality Check Quick Action -->
      <div class="glass rounded-xl p-6 mb-6 text-center">
        <h3 class="text-xl font-display font-bold text-dream-100 mb-2">Contrôle de Réalité</h3>
        <p class="text-sm text-gray-400 mb-4">Regardez vos mains. Comptez vos doigts. Est-ce que quelque chose est étrange ?</p>
        <div class="flex gap-3 justify-center flex-wrap mb-4">
          <button onclick="doRealityCheck('hands')" class="px-4 py-3 glass rounded-xl text-sm hover:border-dream-400/40 transition-all">✋ Mains</button>
          <button onclick="doRealityCheck('text')" class="px-4 py-3 glass rounded-xl text-sm hover:border-dream-400/40 transition-all">📖 Texte</button>
          <button onclick="doRealityCheck('time')" class="px-4 py-3 glass rounded-xl text-sm hover:border-dream-400/40 transition-all">⏰ Heure</button>
          <button onclick="doRealityCheck('nose')" class="px-4 py-3 glass rounded-xl text-sm hover:border-dream-400/40 transition-all">👃 Nez pincé</button>
          <button onclick="doRealityCheck('gravity')" class="px-4 py-3 glass rounded-xl text-sm hover:border-dream-400/40 transition-all">🪶 Gravité</button>
          <button onclick="doRealityCheck('light_switch')" class="px-4 py-3 glass rounded-xl text-sm hover:border-dream-400/40 transition-all">💡 Interrupteur</button>
        </div>
        <div class="flex items-center justify-center gap-6 text-sm">
          <span class="text-dream-300"><strong>${rcStats.today}</strong> aujourd'hui</span>
          <span class="text-gray-400"><strong>${rcStats.total}</strong> au total</span>
        </div>
      </div>
      
      <!-- Techniques -->
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div class="glass rounded-xl p-5">
          <div class="text-2xl mb-2">🧠</div>
          <h4 class="font-semibold text-dream-200 mb-2">MILD — Induction Mnémonique</h4>
          <p class="text-xs text-gray-400 mb-3">Technique de Stephen LaBerge. Avant de dormir, répétez : "La prochaine fois que je rêve, je me rendrai compte que je rêve."</p>
          <ol class="text-xs text-gray-300 space-y-1">
            <li>1. Au coucher, mémorisez votre dernier rêve</li>
            <li>2. Répétez votre intention de devenir lucide</li>
            <li>3. Visualisez-vous devenant lucide dans le rêve</li>
            <li>4. Endormez-vous en maintenant cette intention</li>
          </ol>
          <p class="text-[10px] text-gray-500 mt-2 italic">LaBerge (1985), "Lucid Dreaming" — taux de succès : ~20% pour les débutants motivés.</p>
        </div>
        
        <div class="glass rounded-xl p-5">
          <div class="text-2xl mb-2">⏰</div>
          <h4 class="font-semibold text-dream-200 mb-2">WBTB — Réveil Programmé</h4>
          <p class="text-xs text-gray-400 mb-3">Se réveiller après 5-6h de sommeil, rester éveillé 20-60 min, puis se rendormir avec l'intention de rêver lucidement.</p>
          <ol class="text-xs text-gray-300 space-y-1">
            <li>1. Programmez un réveil après 5h de sommeil</li>
            <li>2. Restez éveillé 20-60 min (lisez sur les rêves lucides)</li>
            <li>3. Utilisez la technique MILD au recoucher</li>
            <li>4. Le sommeil paradoxal intense facilite la lucidité</li>
          </ol>
          <p class="text-[10px] text-gray-500 mt-2 italic">Stumbrys et al. (2012) — considérée comme la technique la plus efficace en combinaison avec MILD.</p>
        </div>
        
        <div class="glass rounded-xl p-5">
          <div class="text-2xl mb-2">✋</div>
          <h4 class="font-semibold text-dream-200 mb-2">Reality Testing</h4>
          <p class="text-xs text-gray-400 mb-3">Effectuer régulièrement des tests de réalité pendant la journée crée un réflexe qui se reproduit dans les rêves.</p>
          <ol class="text-xs text-gray-300 space-y-1">
            <li>1. Questionnez sincèrement la réalité 10-15x/jour</li>
            <li>2. Regardez vos mains, comptez vos doigts</li>
            <li>3. Essayez de pousser un doigt à travers votre paume</li>
            <li>4. Lisez un texte, détournez le regard, relisez</li>
          </ol>
          <p class="text-[10px] text-gray-500 mt-2 italic">Tholey (1983) — le questioning sincère est crucial, pas juste le geste mécanique.</p>
        </div>
        
        <div class="glass rounded-xl p-5">
          <div class="text-2xl mb-2">📝</div>
          <h4 class="font-semibold text-dream-200 mb-2">Journal de Rêves</h4>
          <p class="text-xs text-gray-400 mb-3">La base de tout. Noter ses rêves au réveil améliore drastiquement le rappel onirique en quelques semaines.</p>
          <ul class="text-xs text-gray-300 space-y-1">
            <li>• Écrivez immédiatement au réveil (dans les 5 min)</li>
            <li>• Notez même les fragments les plus courts</li>
            <li>• Utilisez le présent pour plus de vivacité</li>
            <li>• Identifiez vos « signes de rêve » récurrents</li>
          </ul>
          <p class="text-[10px] text-gray-500 mt-2 italic">Schredl (2002) — le rappel de rêves augmente significativement avec la pratique régulière du journal.</p>
        </div>
        
        <div class="glass rounded-xl p-5">
          <div class="text-2xl mb-2">🧘</div>
          <h4 class="font-semibold text-dream-200 mb-2">SSILD — Senses Initiated</h4>
          <p class="text-xs text-gray-400 mb-3">Technique moderne basée sur la rotation de l'attention entre les sens au moment de s'endormir.</p>
          <ol class="text-xs text-gray-300 space-y-1">
            <li>1. Après un WBTB, allongez-vous confortablement</li>
            <li>2. Concentrez-vous sur la vision (yeux fermés) ~20s</li>
            <li>3. Puis sur l'ouïe (sons ambiants) ~20s</li>
            <li>4. Puis sur les sensations corporelles ~20s</li>
            <li>5. Répétez 4-5 cycles puis dormez</li>
          </ol>
          <p class="text-[10px] text-gray-500 mt-2 italic">Développée par CosmicIron — rapportée efficace par la communauté, étude formelle encore limitée.</p>
        </div>
        
        <div class="glass rounded-xl p-5">
          <div class="text-2xl mb-2">🌙</div>
          <h4 class="font-semibold text-dream-200 mb-2">Incubation de Rêves</h4>
          <p class="text-xs text-gray-400 mb-3">Technique de suggestion pré-sommeil pour influencer le contenu des rêves.</p>
          <ol class="text-xs text-gray-300 space-y-1">
            <li>1. Formulez une intention claire et positive</li>
            <li>2. Visualisez la scène souhaitée</li>
            <li>3. Répétez l'intention en boucle au coucher</li>
            <li>4. Gardez l'image à l'esprit en s'endormant</li>
          </ol>
          <p class="text-[10px] text-gray-500 mt-2 italic">Barrett (1993) — ~50% des participants ont rêvé du sujet choisi.</p>
        </div>
      </div>
      
      <!-- Science Section -->
      <div class="glass rounded-xl p-6">
        <h3 class="text-sm font-display font-semibold text-dream-200 mb-4"><i class="fas fa-flask mr-2"></i>Bases Scientifiques</h3>
        <div class="space-y-3 text-xs text-gray-300">
          <div class="p-3 rounded-lg bg-night-900/40">
            <p class="font-semibold text-dream-200 mb-1">📊 Rappel onirique & journal</p>
            <p>Schredl & Erlacher (2004) ont montré que la tenue régulière d'un journal de rêves augmente significativement la fréquence de rappel onirique. L'effet est mesurable dès 2-3 semaines de pratique quotidienne.</p>
          </div>
          <div class="p-3 rounded-lg bg-night-900/40">
            <p class="font-semibold text-dream-200 mb-1">✨ Induction de rêves lucides</p>
            <p>Une méta-analyse de Stumbrys et al. (2012) a identifié que la combinaison MILD + WBTB + Reality Testing est l'approche la plus efficace. La technique MILD seule montre un taux de ~20% de succès chez les débutants motivés.</p>
          </div>
          <div class="p-3 rounded-lg bg-night-900/40">
            <p class="font-semibold text-dream-200 mb-1">🌙 Incubation onirique</p>
            <p>Deirdre Barrett (Harvard, 1993) a démontré que ~50% des participants ayant utilisé la technique d'incubation ont rêvé du sujet choisi. L'efficacité augmente avec la pratique et la motivation.</p>
          </div>
          <div class="p-3 rounded-lg bg-night-900/40">
            <p class="font-semibold text-dream-200 mb-1">⚠️ Note de transparence</p>
            <p>La recherche sur les rêves lucides reste un domaine actif. Si les techniques MILD et WBTB ont une base empirique solide, d'autres approches (comme SSILD) sont principalement soutenues par des rapports communautaires. Cette plateforme distingue les méthodes scientifiquement validées des pratiques exploratoires.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.doRealityCheck = async function(type) {
  try {
    await api('/reality-checks', { method: 'POST', body: JSON.stringify({ checkType: type, wasDreaming: false }) });
    showToast('✋ Reality check enregistré ! Êtes-vous sûr de ne pas rêver ?');
    // Refresh the view to update count
    renderLucidity();
  } catch (err) { console.error(err); }
};

// ========== MODAL & TOAST ==========
function showModal(content, maxWidth) {
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal-overlay animate-fadeIn" onclick="if(event.target===this) closeModal()">
      <div class="modal-content animate-slideUp" style="${maxWidth ? 'max-width:' + maxWidth : ''}">
        ${content}
      </div>
    </div>
  `;
}

window.closeModal = function() {
  const container = document.getElementById('modal-container');
  container.innerHTML = '';
};

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 glass px-6 py-3 rounded-xl text-sm text-dream-200 animate-slideUp';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ========== UTILITIES ==========
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== INIT ==========
checkAuth();

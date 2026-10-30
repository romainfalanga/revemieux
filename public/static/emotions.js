// Loaded before app.js; application globals are accessed only from invoked functions.
(() => {
  'use strict';
  let catalog = [];
  let catalogError = '';
  let feedback = '';
  let managing = false;
  let adding = '';
  let editing = null;
  let renameDraft = '';
  let pending = false;
  let revision = 0;
  const busy = () => Boolean(pending || window._editorState?.saving);
  const token = () => typeof state !== 'undefined' ? state.token : null;
  const guardedForms = new WeakSet();
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const buttonClass = 'px-2 py-1 rounded-lg text-xs border border-dream-700/30 text-dream-200 hover:bg-dream-600/20 disabled:opacity-40';
  const inputClass = 'min-w-0 flex-1 px-2 py-1.5 rounded-lg bg-night-900/50 border border-dream-700/30 text-xs text-gray-200';

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function button(text, handler, title) {
    const element = node('button', buttonClass, text);
    element.type = 'button';
    element.disabled = busy();
    if (title) element.title = title;
    element.addEventListener('click', () => { if (!busy()) handler(); });
    return element;
  }
  function label(key) {
    return owns(EMOTION_LABELS, key) ? `${EMOTION_EMOJIS[key]} ${EMOTION_LABELS[key]}` : `💭 ${key}`;
  }
  function setEmotion(emotions, key, intensity) {
    Object.defineProperty(emotions, key, { value: intensity, writable: true, enumerable: true, configurable: true });
  }
  function selected() {
    const editor = window._editorState;
    if (!editor) return null;
    if (!editor.emotions) editor.emotions = Object.create(null);
    return editor.emotions;
  }
  function choose(key) {
    if (busy()) return;
    const emotions = selected();
    if (!emotions) return;
    if (!owns(emotions, key)) setEmotion(emotions, key, 3);
    feedback = '';
    render();
  }
  function normalized(name) { return name.trim().toLocaleLowerCase('fr'); }
  function duplicate(name, excludedId) {
    const candidate = normalized(name);
    return Object.entries(EMOTION_LABELS).some(([key, value]) => normalized(key) === candidate || normalized(value) === candidate)
      || catalog.some(item => item.id !== excludedId && normalized(item.name) === candidate);
  }
  async function mutate(work) {
    if (busy()) return;
    const editor = window._editorState;
    const currentRevision = revision;
    const currentToken = token();
    const operation = {};
    pending = operation;
    const isCurrent = () => revision === currentRevision && token() === currentToken && pending === operation;
    if (editor) editor.emotionCatalogBusy = true;
    feedback = '';
    render();
    try { await work(editor, isCurrent); }
    catch (error) {
      if (isCurrent()) feedback = error.message || 'Impossible de modifier les émotions. Réessayez.';
    } finally {
      if (pending === operation) {
        pending = false;
        if (editor) editor.emotionCatalogBusy = false;
        if (revision === currentRevision && token() === currentToken) render();
      }
    }
  }
  function create() {
    const name = adding.trim();
    if (!name) { feedback = 'Entrez un nom d’émotion.'; render(); return; }
    if (name.length > 60) { feedback = 'Le nom doit contenir au maximum 60 caractères.'; render(); return; }
    if (duplicate(name)) { feedback = 'Cette émotion existe déjà dans le catalogue.'; render(); return; }
    mutate(async (editor, isCurrent) => {
      const item = await api('/emotions', { method: 'POST', body: JSON.stringify({ name }) });
      if (!isCurrent()) return;
      if (!item || typeof item.name !== 'string' || item.id == null) throw new Error('Réponse invalide. Rechargez le catalogue avant de réessayer.');
      catalog = [...catalog.filter(entry => entry.id !== item.id), item];
      if (isCurrent() && editor === window._editorState) {
        if (!owns(editor.emotions, item.name)) setEmotion(editor.emotions, item.name, 3);
        adding = '';
      }
    });
  }
  function rename(item) {
    const name = renameDraft.trim();
    if (!name) { feedback = 'Entrez un nom d’émotion.'; render(); return; }
    if (name === item.name) { editing = null; render(); return; }
    if (name.length > 60) { feedback = 'Le nom doit contenir au maximum 60 caractères.'; render(); return; }
    if (duplicate(name, item.id)) { feedback = 'Cette émotion existe déjà dans le catalogue.'; render(); return; }
    mutate(async (editor, isCurrent) => {
      const result = await api(`/emotions/${encodeURIComponent(item.id)}`, { method: 'PUT', body: JSON.stringify({ name }) });
      if (!isCurrent()) return;
      const updatedName = result && typeof result.name === 'string' ? result.name : name;
      catalog = catalog.map(entry => entry.id === item.id ? { ...entry, name: updatedName } : entry);
      if (typeof state !== 'undefined' && Array.isArray(state.filters?.emotions)) {
        state.filters.emotions = [...new Set(state.filters.emotions.map(key => key === item.name ? updatedName : key))];
      }
      if (isCurrent() && editor === window._editorState) {
        if (owns(editor.emotions, item.name)) {
          const intensity = editor.emotions[item.name];
          delete editor.emotions[item.name];
          setEmotion(editor.emotions, updatedName, intensity);
        }
        editing = null;
      }
    });
  }
  function remove(item) {
    if (!window.confirm(`Supprimer définitivement l’émotion « ${item.name} » ? Elle sera retirée de tous les rêves de votre compte. Cette action est irréversible.`)) return;
    mutate(async (editor, isCurrent) => {
      await api(`/emotions/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      if (!isCurrent()) return;
      catalog = catalog.filter(entry => entry.id !== item.id);
      if (typeof state !== 'undefined' && Array.isArray(state.filters?.emotions)) {
        state.filters.emotions = state.filters.emotions.filter(key => key !== item.name);
      }
      if (isCurrent() && editor === window._editorState) {
        delete editor.emotions[item.name];
        if (editing === item.id) editing = null;
      }
    });
  }
  function render() {
    const root = document.getElementById('emotion-editor');
    const emotions = selected();
    if (!root || !emotions) return;
    root.replaceChildren();
    root.setAttribute('aria-busy', String(busy()));
    const form = root.closest('form');
    if (form && !guardedForms.has(form)) {
      guardedForms.add(form);
      form.addEventListener('submit', event => {
        if (!busy()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        feedback = 'Veuillez attendre la fin de la modification des émotions avant d’enregistrer le rêve.';
        render();
      }, true);
    }
    root.append(node('h3', 'text-sm font-medium text-dream-100 mb-2', 'Émotions du rêve'));
    const chosen = node('div', 'space-y-1.5 mb-2');
    if (!Object.keys(emotions).length) chosen.append(node('p', 'text-xs text-gray-500 italic', 'Aucune émotion sélectionnée'));
    Object.entries(emotions).forEach(([key, intensity]) => {
      const row = node('div', 'flex flex-wrap items-center gap-2 p-2 rounded-lg bg-dream-600/10 border border-dream-700/20');
      row.append(node('span', 'text-xs text-dream-200 break-words min-w-0 flex-1', label(key)));
      const range = node('input', 'w-24 accent-dream-400');
      range.type = 'range'; range.min = '1'; range.max = '5'; range.step = '1'; range.value = String(intensity);
      range.disabled = busy();
      range.setAttribute('aria-label', `Intensité de ${label(key)}`);
      const value = node('span', 'text-xs text-dream-300', `${intensity}/5`);
      range.addEventListener('input', () => {
        if (busy()) return;
        setEmotion(emotions, key, Number(range.value));
        value.textContent = `${range.value}/5`;
      });
      row.append(range, value, button('×', () => { delete emotions[key]; render(); }, `Retirer ${label(key)} de ce rêve`));
      chosen.append(row);
    });
    root.append(chosen);
    const header = node('div', 'flex items-center justify-between mb-1');
    header.append(node('span', 'text-sm text-gray-300', 'Émotions disponibles'), button(managing ? 'Terminé' : 'Gérer', () => { managing = !managing; editing = null; feedback = ''; render(); }));
    root.append(header);
    const choices = node('div', 'p-2 rounded-lg bg-night-900/30 border border-dream-700/10 space-y-2 mb-2');
    const defaults = node('div', 'flex flex-wrap gap-1');
    Object.keys(EMOTION_LABELS).forEach(key => {
      const pick = button(label(key), () => choose(key));
      pick.disabled = busy() || owns(emotions, key);
      pick.setAttribute('aria-pressed', String(owns(emotions, key)));
      defaults.append(pick);
    });
    choices.append(defaults, node('p', 'text-xs text-gray-500', 'Mes émotions personnelles'));
    if (!catalog.length) choices.append(node('p', 'text-xs text-gray-500 italic', 'Aucune émotion personnelle disponible.'));
    catalog.forEach(item => {
      const row = node('div', 'flex flex-wrap items-center gap-1');
      if (managing && editing === item.id) {
        const input = node('input', inputClass);
        input.value = renameDraft; input.disabled = busy(); input.maxLength = 60;
        input.setAttribute('aria-label', 'Nouveau nom de l’émotion');
        input.addEventListener('input', () => { renameDraft = input.value; });
        input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); if (!busy()) rename(item); } });
        row.append(input, button('Enregistrer', () => rename(item)), button('Annuler', () => { editing = null; render(); }));
      } else {
        const pick = button(`💭 ${item.name}`, () => choose(item.name));
        pick.classList.add('break-words', 'min-w-0');
        pick.disabled = busy() || owns(emotions, item.name);
        pick.setAttribute('aria-pressed', String(owns(emotions, item.name)));
        row.append(pick);
        if (managing) row.append(button('Renommer', () => { editing = item.id; renameDraft = item.name; feedback = ''; render(); }), button('Supprimer', () => remove(item)));
      }
      choices.append(row);
    });
    root.append(choices);
    if (managing) root.append(node('p', 'text-xs text-gray-400 mb-2', 'Renommer une émotion met aussi à jour les rêves associés. Les émotions par défaut ne peuvent pas être modifiées.'));
    const addRow = node('div', 'flex items-center gap-1');
    const input = node('input', inputClass);
    input.type = 'text'; input.maxLength = 60; input.placeholder = 'Ajouter une émotion personnelle…'; input.value = adding; input.disabled = busy();
    input.setAttribute('aria-label', 'Nom de la nouvelle émotion personnelle');
    input.addEventListener('input', () => { adding = input.value; });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); if (!busy()) create(); } });
    addRow.append(input, button('Ajouter', create));
    root.append(addRow);
    if (catalogError) {
      const errorRow = node('div', 'text-xs text-amber-300 mt-2');
      errorRow.setAttribute('role', 'alert');
      errorRow.append(node('span', '', catalogError), button('Réessayer', async () => { const request = load(); render(); await request; render(); }));
      root.append(errorRow);
    }
    if (feedback || busy()) {
      const status = node('p', 'text-xs text-amber-300 mt-2', feedback || (window._editorState?.saving ? 'Enregistrement du rêve en cours…' : 'Modification en cours…'));
      status.setAttribute('role', feedback ? 'alert' : 'status');
      root.append(status);
    }
  }
  async function load() {
    const currentRevision = revision;
    const currentToken = token();
    const operation = {};
    pending = operation;
    const isCurrent = () => currentRevision === revision && currentToken === token() && pending === operation;
    try {
      const result = await api('/emotions');
      if (!isCurrent()) return;
      if (!Array.isArray(result.emotions)) throw new Error('Catalogue indisponible');
      catalog = result.emotions.filter(item => item && typeof item.name === 'string' && item.id != null);
      catalogError = '';
    } catch (error) {
      if (!isCurrent()) return;
      catalog = [];
      catalogError = 'Impossible de charger vos émotions personnelles. Les émotions de ce rêve sont conservées. ';
    } finally {
      if (pending === operation) pending = false;
    }
  }
  window.loadEmotionCatalog = load;
  window.renderEmotionEditor = render;
  window.resetEmotionEditor = () => {
    revision++;
    pending = false;
    catalog = []; catalogError = '';
    if (window._editorState) window._editorState.emotionCatalogBusy = false;
    managing = false; adding = ''; editing = null; renameDraft = ''; feedback = '';
  };
})();

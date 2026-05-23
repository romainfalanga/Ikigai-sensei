/**
 * Ikigai Sensei - Frontend Application
 * Gère le chat, le diagramme interactif, et la mémoire
 */

(function () {
  'use strict';

  // ===== STATE =====
  const state = {
    sessionId: localStorage.getItem('ikigai_session_id') || generateId(),
    elements: [],
    currentPhase: 'amorcage',
    phaseProgress: 0,
    isLoading: false,
  };

  // Save session ID
  localStorage.setItem('ikigai_session_id', state.sessionId);

  // ===== DOM ELEMENTS =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const chatMessages = $('#chat-messages');
  const chatInput = $('#chat-input');
  const btnSend = $('#btn-send');
  const btnReset = $('#btn-reset');
  const phaseBadge = $('#phase-badge');
  const progressBar = $('#progress-bar');
  const progressText = $('#progress-text');
  const elementCount = $('#element-count');
  const elementsLayer = $('#elements-layer');
  const centerLabel = $('#center-label');
  const quickBtns = $$('.quick-btn');

  const memPanels = {
    passion: $('#mem-passion'),
    mission: $('#mem-mission'),
    vocation: $('#mem-vocation'),
    profession: $('#mem-profession'),
  };

  // ===== INIT =====
  async function init() {
    try {
      const res = await axios.get(`/api/session/${state.sessionId}`);
      if (res.data.success) {
        const data = res.data.data;
        state.elements = data.elements || [];
        state.currentPhase = data.state?.current_phase || 'amorcage';
        state.phaseProgress = calculateProgress(data.elements || []);
        updateUI();
      }
    } catch (err) {
      console.error('Init error:', err);
    }
  }

  // ===== CHAT =====
  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message || state.isLoading) return;

    state.isLoading = true;
    chatInput.value = '';
    chatInput.style.height = 'auto';
    btnSend.disabled = true;
    autoResize();

    // Add user message to chat
    addChatMessage('user', message);

    // Show typing indicator
    const typingEl = addTypingIndicator();

    try {
      const res = await axios.post('/api/chat', {
        session_id: state.sessionId,
        message: message,
      });

      // Remove typing indicator
      typingEl.remove();

      if (res.data.success) {
        const data = res.data.data;

        // Add AI response
        addChatMessage('assistant', data.message.content);

        // Update elements
        if (data.detected_elements && data.detected_elements.length > 0) {
          state.elements = [...state.elements, ...data.detected_elements];
        }

        // Update phase & progress
        state.currentPhase = data.current_phase;
        state.phaseProgress = data.phase_progress;
        updateUI();

        // If web search was used, add subtle indicator
        if (data.web_search_used) {
          addSystemNote('🔍 Recherche web utilisée pour enrichir la réponse');
        }
      } else {
        addChatMessage('assistant', "Désolé, j'ai rencontré une erreur. Peux-tu réessayer ? 🙏");
      }
    } catch (err) {
      typingEl.remove();
      console.error('Chat error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Erreur inconnue';
      addChatMessage('assistant', `Une erreur est survenue : ${errorMsg}\n\nVérifie que la clé API OpenRouter est bien configurée.`);
    } finally {
      state.isLoading = false;
      btnSend.disabled = false;
      chatInput.focus();
    }
  }

  function addChatMessage(role, content) {
    const div = document.createElement('div');
    div.className = `flex gap-3 ${role === 'user' ? 'flex-row-reverse chat-bubble-user' : 'chat-bubble-ai'}`;

    if (role === 'assistant') {
      div.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm flex-shrink-0">🎋</div>
        <div class="bg-gray-800/80 rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%]">
          <div class="text-sm text-gray-200 message-content">${formatMessage(content)}</div>
        </div>`;
    } else {
      div.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm flex-shrink-0">🧑</div>
        <div class="bg-purple-500/20 rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] border border-purple-500/20">
          <div class="text-sm text-gray-200">${escapeHtml(content)}</div>
        </div>`;
    }

    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function addSystemNote(text) {
    const div = document.createElement('div');
    div.className = 'flex justify-center';
    div.innerHTML = `<span class="text-xs text-gray-600 bg-gray-800/50 px-3 py-1 rounded-full">${text}</span>`;
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'flex gap-3 chat-bubble-ai';
    div.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm flex-shrink-0">🎋</div>
      <div class="bg-gray-800/80 rounded-2xl rounded-tl-none px-4 py-3">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>`;
    chatMessages.appendChild(div);
    scrollToBottom();
    return div;
  }

  function formatMessage(text) {
    // Escape HTML
    let formatted = escapeHtml(text);

    // Bold
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    // Emoji sizing
    formatted = formatted.replace(/[\u{1F300}-\u{1F9FF}]/gu, '<span class="text-lg">$&</span>');

    return formatted;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ===== UI UPDATES =====
  function updateUI() {
    // Phase badge
    const phaseLabels = {
      amorcage: '🌱 Amorçage',
      exploration_passion: '❤️ Passion',
      exploration_mission: '🌍 Mission',
      exploration_vocation: '💰 Vocation',
      exploration_profession: '🎯 Talents',
      classification: '🔍 Classification',
      challenge: '⚡ Challenge',
      synthese: '✨ Synthèse',
      complete: '✅ Terminé',
    };

    const phaseEmojis = {
      amorcage: '🌱',
      exploration_passion: '❤️',
      exploration_mission: '🌍',
      exploration_vocation: '💰',
      exploration_profession: '🎯',
      classification: '🔍',
      challenge: '⚡',
      synthese: '✨',
      complete: '✅',
    };

    const emoji = phaseEmojis[state.currentPhase] || '🌱';
    const label = phaseLabels[state.currentPhase] || 'Exploration';
    phaseBadge.textContent = `${emoji} ${label}`;

    // Phase-specific styling
    phaseBadge.className = 'text-xs px-3 py-1 rounded-full border transition-all duration-500';
    if (state.currentPhase.includes('passion')) {
      phaseBadge.classList.add('text-red-400', 'bg-red-500/10', 'border-red-500/30');
    } else if (state.currentPhase.includes('mission')) {
      phaseBadge.classList.add('text-green-400', 'bg-green-500/10', 'border-green-500/30');
    } else if (state.currentPhase.includes('vocation')) {
      phaseBadge.classList.add('text-yellow-400', 'bg-yellow-500/10', 'border-yellow-500/30');
    } else if (state.currentPhase.includes('profession')) {
      phaseBadge.classList.add('text-blue-400', 'bg-blue-500/10', 'border-blue-500/30');
    } else if (state.currentPhase === 'complete' || state.currentPhase === 'synthese') {
      phaseBadge.classList.add('text-purple-400', 'bg-purple-500/10', 'border-purple-500/30');
    } else {
      phaseBadge.classList.add('text-gray-400', 'bg-gray-800', 'border-gray-700');
    }

    // Progress bar
    progressBar.style.width = state.phaseProgress + '%';
    progressText.textContent = state.phaseProgress + '%';

    // Element count
    elementCount.textContent = state.elements.length + ' élément' + (state.elements.length !== 1 ? 's' : '');

    // Memory panel
    updateMemoryPanel();

    // Ikigai diagram
    updateDiagram();
  }

  function updateMemoryPanel() {
    // Clear all
    for (const cat of ['passion', 'mission', 'vocation', 'profession']) {
      memPanels[cat].innerHTML = '';
    }

    // Group elements
    for (const el of state.elements) {
      const li = document.createElement('li');
      li.className = 'memory-item';
      li.innerHTML = `
        <span class="flex-1">${escapeHtml(el.content)}</span>
        <button class="delete-btn" data-id="${el.id}" title="Supprimer">
          <i class="fas fa-times text-[10px]"></i>
        </button>`;
      li.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteElement(el.id);
      });
      if (memPanels[el.category]) {
        memPanels[el.category].appendChild(li);
      }
    }
  }

  function updateDiagram() {
    // Clear existing dots
    elementsLayer.innerHTML = '';

    // Group elements by category
    const groups = { passion: [], mission: [], vocation: [], profession: [] };
    for (const el of state.elements) {
      if (groups[el.category]) {
        groups[el.category].push(el);
      }
    }

    // Circle centers (matching SVG coordinates)
    const centers = {
      passion: { cx: 140, cy: 140 },
      mission: { cx: 260, cy: 140 },
      vocation: { cx: 140, cy: 260 },
      profession: { cx: 260, cy: 260 },
    };

    const colors = {
      passion: '#E74C3C',
      mission: '#2ECC71',
      vocation: '#F39C12',
      profession: '#3498DB',
    };

    // Place dots in their respective circles
    for (const [cat, els] of Object.entries(groups)) {
      const center = centers[cat];
      const color = colors[cat];
      const radius = 85; // Inner radius for dots

      for (let i = 0; i < els.length; i++) {
        const angle = (i / Math.max(els.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const r = radius * (0.5 + Math.random() * 0.3);
        const x = center.cx + Math.cos(angle) * r;
        const y = center.cy + Math.sin(angle) * r;

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y);
        dot.setAttribute('r', '6');
        dot.setAttribute('fill', color);
        dot.setAttribute('opacity', '0.8');
        dot.setAttribute('class', 'ikigai-dot');
        dot.style.filter = 'url(#glow)';

        // Tooltip
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = els[i].content;
        dot.appendChild(title);

        elementsLayer.appendChild(dot);
      }
    }

    // Update center label glow
    if (state.elements.length >= 8) {
      centerLabel.setAttribute('class', 'font-jp ikigai-center-glow');
      centerLabel.setAttribute('fill', 'rgba(255,255,255,0.6)');
    } else if (state.elements.length >= 4) {
      centerLabel.setAttribute('fill', 'rgba(255,255,255,0.4)');
      centerLabel.setAttribute('class', 'font-jp');
    } else {
      centerLabel.setAttribute('fill', 'rgba(255,255,255,0.2)');
      centerLabel.setAttribute('class', 'font-jp');
    }
  }

  // ===== ELEMENT MANAGEMENT =====
  async function deleteElement(id) {
    try {
      await axios.delete(`/api/elements/${id}`);
      state.elements = state.elements.filter(e => e.id !== id);
      updateUI();
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  // ===== SESSION RESET =====
  async function resetSession() {
    if (!confirm('Es-tu sûr de vouloir réinitialiser ta session ? Tous les éléments seront perdus.')) return;

    try {
      await axios.post('/api/session/reset', { session_id: state.sessionId });
      state.elements = [];
      state.currentPhase = 'amorcage';
      state.phaseProgress = 0;
      updateUI();

      // Clear chat except first message
      while (chatMessages.children.length > 1) {
        chatMessages.lastChild.remove();
      }

      addSystemNote('🔄 Session réinitialisée. Repartons de zéro !');
    } catch (err) {
      console.error('Reset error:', err);
    }
  }

  // ===== HELPERS =====
  function generateId() {
    return 'ikigai_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  function calculateProgress(elements) {
    const counts = {};
    for (const el of elements) {
      counts[el.category] = (counts[el.category] || 0) + 1;
    }
    const totalCats = Object.keys(counts).length;
    const totalEls = elements.length;
    const catProgress = Math.min(totalCats / 4, 1) * 40;
    const elProgress = Math.min(totalEls / 12, 1) * 60;
    return Math.round(Math.min(catProgress + elProgress, 100));
  }

  function autoResize() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  }

  // ===== EVENT LISTENERS =====
  btnSend.addEventListener('click', sendMessage);

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  chatInput.addEventListener('input', autoResize);

  btnReset.addEventListener('click', resetSession);

  // Quick reply buttons
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.textContent.trim();
      chatInput.focus();
      autoResize();
    });
  });

  // Init on load
  init();

  console.log('🎋 Ikigai Sensei initialized!');
  console.log('Session ID:', state.sessionId);
})();

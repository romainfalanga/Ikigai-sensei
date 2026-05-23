/**
 * Ikigai Sensei V2.1 - Frontend Application
 * Auth + Chat + Explorateur de mémoire arborescente + Insights + Clusters
 */
(function () {
  'use strict';

  // ===== STATE =====
  const state = {
    user: null,
    sessionId: localStorage.getItem('ikigai_session_id') || generateId(),
    elements: [],
    memoryTree: [],
    memoryRelations: [],
    memoryStats: null,
    currentPhase: 'amorcage',
    phaseProgress: 0,
    isLoading: false,
    isLoggedIn: false,
    selectedNode: null,
  };

  localStorage.setItem('ikigai_session_id', state.sessionId);

  // ===== DOM REFS =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ===== INIT =====
  async function init() {
    await checkAuth();
    if (state.isLoggedIn) {
      showApp();
      await loadMemoryTree();
      await loadSession();
    } else {
      showLogin();
    }
  }

  // ============================================================
  // AUTH
  // ============================================================

  async function checkAuth() {
    try {
      const res = await axios.get('/api/auth/me');
      if (res.data.success) {
        state.user = res.data.data.user;
        state.isLoggedIn = true;
      }
    } catch {
      state.isLoggedIn = false;
    }
  }

  function showLogin() {
    const loginPage = document.getElementById('login-page');
    const appContainer = document.getElementById('app-container');
    if (loginPage) loginPage.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
  }

  function showApp() {
    const loginPage = document.getElementById('login-page');
    const appContainer = document.getElementById('app-container');
    if (loginPage) loginPage.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');
    const nameDisplay = document.getElementById('user-name-display');
    const emailDisplay = document.getElementById('user-email-display');
    if (nameDisplay) nameDisplay.textContent = state.user?.display_name || 'Explorateur';
    if (emailDisplay) emailDisplay.textContent = state.user?.email || '';
  }

  async function login(email, password) {
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      if (res.data.success) {
        state.user = res.data.data.user;
        state.isLoggedIn = true;
        showApp();
        await loadMemoryTree();
        await loadSession();
      } else {
        alert(res.data.error);
      }
    } catch (err) {
      alert('Erreur de connexion: ' + (err.response?.data?.error || err.message));
    }
  }

  async function register(email, password, name) {
    try {
      const res = await axios.post('/api/auth/register', { email, password, display_name: name });
      if (res.data.success) {
        state.user = res.data.data.user;
        state.isLoggedIn = true;
        showApp();
        await loadMemoryTree();
        await loadSession();
      } else {
        alert(res.data.error);
      }
    } catch (err) {
      alert('Erreur d\'inscription: ' + (err.response?.data?.error || err.message));
    }
  }

  async function logout() {
    await axios.post('/api/auth/logout');
    state.user = null;
    state.isLoggedIn = false;
    state.elements = [];
    state.memoryTree = [];
    state.memoryRelations = [];
    showLogin();
  }

  // Auth bindings
  const btnLogin = document.getElementById('btn-login');
  const btnRegister = document.getElementById('btn-register');
  const btnLogout = document.getElementById('btn-logout');
  const showRegister = document.getElementById('show-register');
  const showLoginLink = document.getElementById('show-login');

  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      const email = document.getElementById('login-email')?.value.trim();
      const password = document.getElementById('login-password')?.value;
      if (email && password) login(email, password);
    });
  }
  if (btnRegister) {
    btnRegister.addEventListener('click', () => {
      const email = document.getElementById('reg-email')?.value.trim();
      const password = document.getElementById('reg-password')?.value;
      const name = document.getElementById('reg-name')?.value.trim() || 'Explorateur';
      if (email && password.length >= 6) register(email, password, name);
      else alert('Mot de passe: 6 caractères minimum');
    });
  }
  if (showRegister) {
    showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('login-form')?.classList.add('hidden');
      document.getElementById('register-form')?.classList.remove('hidden');
    });
  }
  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('register-form')?.classList.add('hidden');
      document.getElementById('login-form')?.classList.remove('hidden');
    });
  }
  if (btnLogout) btnLogout.addEventListener('click', logout);

  // ============================================================
  // MEMORY LOADING
  // ============================================================
  async function loadMemoryTree() {
    if (!state.isLoggedIn) return;
    try {
      const category = document.getElementById('filter-category')?.value || '';
      const nodeType = document.getElementById('filter-type')?.value || '';
      const params = {};
      if (category) params.category = category;
      if (nodeType) params.node_type = nodeType;

      const res = await axios.get('/api/memory/tree', { params });
      if (res.data.success) {
        state.memoryTree = res.data.data.tree || [];
        state.memoryRelations = res.data.data.relations || [];
        state.memoryStats = res.data.data.stats || null;
        renderMemoryExplorer();
        updateDiagram();
        updateStatsBar();
        updateMemoryStatsDisplay();
      }
    } catch (err) {
      console.error('Memory load error:', err);
    }
  }

  async function loadSession() {
    try {
      const res = await axios.get(`/api/session/${state.sessionId}`);
      if (res.data.success) {
        const data = res.data.data;
        state.elements = data.elements || [];
        state.currentPhase = data.state?.current_phase || 'amorcage';
        updateUI();
      }
    } catch (err) {
      console.error('Session load error:', err);
    }
  }

  // ============================================================
  // CHAT
  // ============================================================
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send');
  const btnReset = document.getElementById('btn-reset');

  async function sendMessage() {
    const message = chatInput?.value.trim();
    if (!message || state.isLoading || !state.isLoggedIn) return;

    state.isLoading = true;
    chatInput.value = '';
    chatInput.style.height = 'auto';
    if (btnSend) btnSend.disabled = true;

    addChatMessage('user', message);
    const typingEl = addTypingIndicator();

    try {
      const res = await axios.post('/api/chat', {
        session_id: state.sessionId,
        message: message,
      });

      typingEl.remove();

      if (res.data.success) {
        const data = res.data.data;
        addChatMessage('assistant', data.message.content);

        if (data.detected_nodes && data.detected_nodes.length > 0) {
          addSystemNote(`🧠 ${data.detected_nodes.length} nœud(s) ajouté(s) à ta carte mentale`);
        }
        if (data.new_relations && data.new_relations.length > 0) {
          addSystemNote(`🔗 ${data.new_relations.length} connexion(s) créée(s)`);
        }
        if (data.clusters && data.clusters.length > 0) {
          addSystemNote(`🔍 ${data.clusters.length} cluster(s) thématique(s) détecté(s)`);
        }

        state.currentPhase = data.current_phase;
        state.phaseProgress = data.phase_progress;
        updateUI();
        await loadMemoryTree();

        if (data.web_search_used) {
          addSystemNote('🔍 Recherche web utilisée pour enrichir');
        }
      } else {
        addChatMessage('assistant', "Désolé, j'ai rencontré une erreur. Peux-tu réessayer ? 🙏");
      }
    } catch (err) {
      typingEl.remove();
      if (err.response?.status === 401) {
        addChatMessage('assistant', 'Session expirée. Reconnecte-toi.');
        logout();
      } else {
        addChatMessage('assistant', 'Erreur: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      state.isLoading = false;
      if (btnSend) btnSend.disabled = false;
      chatInput?.focus();
    }
  }

  function addChatMessage(role, content) {
    if (!chatMessages) return;
    const div = document.createElement('div');
    div.className = `flex gap-3 ${role === 'user' ? 'flex-row-reverse chat-bubble-user' : 'chat-bubble-ai'}`;
    if (role === 'assistant') {
      div.innerHTML = `<div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm flex-shrink-0 shadow-md">🎋</div><div class="bg-gray-800/80 rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%]"><div class="text-sm text-gray-200">${formatMessage(content)}</div></div>`;
    } else {
      div.innerHTML = `<div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm flex-shrink-0">🧑</div><div class="bg-purple-500/20 rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] border border-purple-500/20"><div class="text-sm text-gray-200">${escapeHtml(content)}</div></div>`;
    }
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addSystemNote(text) {
    if (!chatMessages) return;
    const div = document.createElement('div');
    div.className = 'flex justify-center';
    div.innerHTML = `<span class="text-xs text-gray-600 bg-gray-800/50 px-3 py-1 rounded-full">${text}</span>`;
    chatMessages.appendChild(div);
  }

  function addTypingIndicator() {
    if (!chatMessages) return { remove: () => {} };
    const div = document.createElement('div');
    div.className = 'flex gap-3 chat-bubble-ai';
    div.innerHTML = `<div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm flex-shrink-0">🎋</div><div class="bg-gray-800/80 rounded-2xl rounded-tl-none px-4 py-3"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function formatMessage(text) {
    let formatted = escapeHtml(text);
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================
  // INSIGHTS
  // ============================================================
  async function generateInsight() {
    if (!state.isLoggedIn) return;
    try {
      const insightsContainer = document.getElementById('insights-container');
      const empty = document.getElementById('insights-empty');
      if (insightsContainer) {
        insightsContainer.innerHTML = '<div class="text-center py-6"><div class="typing-indicator inline-flex"><span></span><span></span><span></span></div><p class="text-xs text-gray-500 mt-2">Analyse en cours...</p></div>';
      }

      const res = await axios.post('/api/insight/generate');
      if (!res.data.success) {
        if (insightsContainer) {
          insightsContainer.innerHTML = '<p class="text-sm text-red-400 text-center py-4">Erreur lors de la génération</p>';
        }
        return;
      }

      const data = res.data.data;
      let html = '';

      // Insights
      if (data.insights && data.insights.length > 0) {
        html += `<div class="mb-4"><h3 class="text-sm font-semibold text-yellow-400 mb-2">💡 Révélations</h3>`;
        for (const ins of data.insights) {
          html += `<div class="insight-card bg-yellow-500/5 rounded-xl p-4 border border-yellow-500/10 mb-2">
            <div class="text-sm text-gray-200 leading-relaxed">${escapeHtml(ins.content)}</div>
            <div class="text-xs text-yellow-600 mt-1">Confiance: ${Math.round(ins.confidence * 100)}%</div>
          </div>`;
        }
        html += `</div>`;
      }

      // Clusters
      if (data.clusters && data.clusters.length > 0) {
        html += `<div class="mb-4"><h3 class="text-sm font-semibold text-purple-400 mb-2">🔗 Clusters thématiques</h3>`;
        for (const cl of data.clusters) {
          html += `<div class="bg-purple-500/5 rounded-xl p-4 border border-purple-500/10 mb-2">
            <div class="text-sm font-medium text-purple-300">${escapeHtml(cl.name)}</div>
            <div class="text-xs text-gray-400 mt-1">${escapeHtml(cl.description)}</div>
          </div>`;
        }
        html += `</div>`;
      }

      // Tensions
      if (data.tensions && data.tensions.length > 0) {
        html += `<div class="mb-4"><h3 class="text-sm font-semibold text-orange-400 mb-2">⚡ Tensions créatives</h3>`;
        for (const t of data.tensions) {
          html += `<div class="bg-orange-500/5 rounded-xl p-4 border border-orange-500/10 mb-2">
            <div class="text-sm font-medium text-orange-300">${escapeHtml(t.node_a)} vs ${escapeHtml(t.node_b)}</div>
            <div class="text-xs text-gray-400 mt-1">${escapeHtml(t.description)}</div>
          </div>`;
        }
        html += `</div>`;
      }

      // Steps
      if (data.steps && data.steps.length > 0) {
        html += `<div><h3 class="text-sm font-semibold text-green-400 mb-2">✅ Prochaines étapes</h3>`;
        for (const s of data.steps) {
          html += `<div class="flex items-start gap-2 text-sm text-gray-300 mb-1.5">
            <span class="text-green-400 mt-0.5">→</span>
            <span>${escapeHtml(s.action)}</span>
          </div>`;
        }
        html += `</div>`;
      }

      if (html === '') {
        html = '<p class="text-sm text-gray-500 text-center py-4">Analyse générée. Continue à explorer ta carte.</p>';
      }

      if (insightsContainer) insightsContainer.innerHTML = html;
      if (empty) empty.classList.add('hidden');

      // Rafraîchir l'arbre mémoire
      await loadMemoryTree();

    } catch (err) {
      console.error('Insight error:', err);
      const container = document.getElementById('insights-container');
      if (container) {
        container.innerHTML = '<p class="text-sm text-red-400 text-center py-4">Erreur: ' + (err.response?.data?.error || err.message) + '</p>';
      }
    }
  }

  // ============================================================
  // MEMORY EXPLORER
  // ============================================================
  function renderMemoryExplorer() {
    const container = document.getElementById('memory-tree-container');
    if (!container) return;

    if (state.memoryTree.length === 0) {
      container.innerHTML = `<div class="text-center py-12 text-gray-600">
        <i class="fas fa-brain text-3xl mb-3 block opacity-30"></i>
        <p class="text-sm">Ta carte de conscience est vide</p>
        <p class="text-xs mt-1">Discute avec Ikigai Sensei pour commencer l'exploration !</p>
      </div>`;
      return;
    }

    let html = '';
    for (const node of state.memoryTree) {
      html += renderTreeNode(node, 0);
    }
    container.innerHTML = html;

    // Event listeners
    container.querySelectorAll('.tree-node-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const nodeId = parseInt(header.dataset.nodeId);
        const target = e.target;
        // Ne pas déclencher si on clique sur un bouton
        if (target.closest('button')) return;
        toggleNodeExpand(nodeId, header);
        showNodeDetail(nodeId);
      });
    });

    container.querySelectorAll('.btn-add-child').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const parentId = parseInt(btn.dataset.parentId);
        showAddNodeForm(parentId);
      });
    });

    container.querySelectorAll('.btn-delete-node').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nodeId = parseInt(btn.dataset.nodeId);
        if (confirm('Supprimer ce nœud et ses enfants ?')) {
          await axios.delete(`/api/memory/nodes/${nodeId}`);
          await loadMemoryTree();
        }
      });
    });
  }

  function renderTreeNode(node, depth) {
    const catEmojis = { passion: '❤️', mission: '🌍', vocation: '💰', profession: '🎯' };
    const typeEmojis = {
      concept: '💭', project: '📦', experience: '🌟', skill: '🔧',
      value: '💎', goal: '🎯', fear: '😰', story: '📖', insight: '💡',
    };
    const catEmoji = catEmojis[node.category] || '📌';
    const typeEmoji = typeEmojis[node.node_type] || '💭';
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = node.is_expanded !== 0;

    const ml = Math.min(depth * 16, 80);
    let html = `<div class="tree-node" style="margin-left:${ml}px">`;
    html += `<div class="tree-node-header flex items-center gap-1 py-1.5 px-2 rounded hover:bg-purple-500/15 cursor-pointer transition-all text-xs" data-node-id="${node.id}">`;
    if (hasChildren) {
      html += `<span class="expand-icon w-3 text-center ${isExpanded ? '' : 'rotate-[-90deg]'} transition-transform text-gray-600">▼</span>`;
    } else {
      html += `<span class="w-3"></span>`;
    }
    html += `<span>${typeEmoji}</span>`;
    html += `<span class="font-medium text-gray-300 flex-1 truncate">${escapeHtml(node.title)}</span>`;
    html += `<span class="text-[10px] opacity-60">${catEmoji}</span>`;
    if (node.confidence > 0.7) html += `<span class="text-[10px] text-green-400" title="Haute confiance">●</span>`;
    html += `<button class="btn-add-child text-gray-600 hover:text-purple-400 ml-1 opacity-0 group-hover:opacity-100" data-parent-id="${node.id}" title="Ajouter un enfant"><i class="fas fa-plus text-[10px]"></i></button>`;
    html += `<button class="btn-delete-node text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100" data-node-id="${node.id}" title="Supprimer"><i class="fas fa-times text-[10px]"></i></button>`;
    html += `</div>`;

    if (hasChildren && isExpanded) {
      html += `<div class="tree-children">`;
      for (const child of node.children) {
        html += renderTreeNode(child, depth + 1);
      }
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  function toggleNodeExpand(nodeId, header) {
    const icon = header.querySelector('.expand-icon');
    const children = header.parentElement.querySelector(':scope > .tree-children');
    if (!children) return;
    const isHidden = children.style.display === 'none';
    children.style.display = isHidden ? 'block' : 'none';
    if (icon) {
      icon.style.transform = isHidden ? '' : 'rotate(-90deg)';
    }
    axios.put(`/api/memory/nodes/${nodeId}`, { is_expanded: isHidden ? 1 : 0 }).catch(() => {});
  }

  async function showNodeDetail(nodeId) {
    try {
      const res = await axios.get(`/api/memory/nodes/${nodeId}`);
      if (!res.data.success) return;

      const node = res.data.data.node;
      const relations = res.data.data.relations || [];
      const detailPanel = document.getElementById('node-detail');
      const titleEl = document.getElementById('node-detail-title');
      const descEl = document.getElementById('node-detail-desc');
      const metaEl = document.getElementById('node-detail-meta');
      const relationsList = document.getElementById('node-relations-list');

      if (!detailPanel) return;
      detailPanel.classList.remove('hidden');

      if (titleEl) titleEl.textContent = node.title;
      if (descEl) descEl.textContent = node.description || '';

      // Métadonnées
      if (metaEl) {
        const catEmojis = { passion: '❤️', mission: '🌍', vocation: '💰', profession: '🎯' };
        let meta = `<span class="px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">${catEmojis[node.category] || ''} ${node.category}</span>`;
        meta += `<span class="px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Type: ${node.node_type}</span>`;
        meta += `<span class="px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Confiance: ${Math.round(node.confidence * 100)}%</span>`;
        if (node.depth > 0) meta += `<span class="px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Profondeur: ${node.depth}</span>`;
        metaEl.innerHTML = meta;
      }

      // Relations
      if (relationsList && relations.length > 0) {
        relationsList.innerHTML = relations.map(r => {
          const emojiMap = { nourrit: '🌱', contraste_avec: '⚡', decoule_de: '🔄', renforce: '💪', contredit: '⚠️', inspire: '💡', collabore_avec: '🤝', est_une_sous_partie_de: '🧩' };
          return `<div class="text-xs text-gray-400">${emojiMap[r.relation_type] || '🔗'} ${r.relation_type} (${Math.round(r.strength * 100)}%)</div>`;
        }).join('');
      } else if (relationsList) {
        relationsList.innerHTML = '<span class="text-xs text-gray-600">Aucune connexion</span>';
      }

      state.selectedNode = node;
    } catch (err) {
      console.error('Node detail error:', err);
    }
  }

  async function showAddNodeForm(parentId) {
    const title = prompt('Titre du nouveau nœud :');
    if (!title) return;

    const categories = ['passion', 'mission', 'vocation', 'profession'];
    const category = prompt('Catégorie (passion, mission, vocation, profession) :', 'passion');
    if (!categories.includes(category)) return;

    const types = ['concept', 'skill', 'experience', 'project', 'value', 'goal', 'fear', 'story', 'insight'];
    const nodeType = prompt('Type (concept, skill, experience, project, value, goal, fear, story, insight) :', 'concept');
    if (!types.includes(nodeType)) return;

    try {
      await axios.post('/api/memory/nodes', {
        title, category, parent_id: parentId,
        confidence: 0.5, node_type: nodeType,
      });
      await loadMemoryTree();
    } catch (err) {
      alert('Erreur: ' + (err.response?.data?.error || err.message));
    }
  }

  // ============================================================
  // IKIGAI DIAGRAM
  // ============================================================
  function updateDiagram() {
    const elementsLayer = document.getElementById('elements-layer');
    const relationsLayer = document.getElementById('relations-layer');
    const centerLabel = document.getElementById('center-label');
    const centerSub = document.getElementById('center-sub');

    if (!elementsLayer) return;
    elementsLayer.innerHTML = '';
    if (relationsLayer) relationsLayer.innerHTML = '';

    const allNodes = [];
    flattenForDiagram(state.memoryTree, allNodes);

    const groups = { passion: [], mission: [], vocation: [], profession: [] };
    for (const node of allNodes) {
      if (groups[node.category]) groups[node.category].push(node);
    }

    const centers = {
      passion: { cx: 140, cy: 140 }, mission: { cx: 260, cy: 140 },
      vocation: { cx: 140, cy: 260 }, profession: { cx: 260, cy: 260 },
    };
    const colors = {
      passion: '#E74C3C', mission: '#2ECC71', vocation: '#F39C12', profession: '#3498DB',
    };

    // Dessiner les relations sur le diagramme (lignes entre les cercles)
    if (relationsLayer && state.memoryRelations.length > 0) {
      const nodeMap = new Map();
      for (const n of allNodes) {
        nodeMap.set(n.id, n);
      }

      for (const rel of state.memoryRelations) {
        const srcNode = nodeMap.get(rel.source_node_id);
        const tgtNode = nodeMap.get(rel.target_node_id);
        if (!srcNode || !tgtNode) continue;

        const srcCenter = centers[srcNode.category];
        const tgtCenter = centers[tgtNode.category];
        if (!srcCenter || !tgtCenter) continue;

        // Placer approximativement sur les bords des cercles
        const srcAngle = Math.random() * Math.PI * 2;
        const tgtAngle = Math.random() * Math.PI * 2;
        const x1 = srcCenter.cx + Math.cos(srcAngle) * 105;
        const y1 = srcCenter.cy + Math.sin(srcAngle) * 105;
        const x2 = tgtCenter.cx + Math.cos(tgtAngle) * 105;
        const y2 = tgtCenter.cy + Math.sin(tgtAngle) * 105;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        line.setAttribute('stroke', 'rgba(139, 92, 246, 0.3)');
        line.setAttribute('stroke-width', String(Math.max(0.5, rel.strength * 2)));
        line.setAttribute('stroke-dasharray', '4 2');
        relationsLayer.appendChild(line);
      }
    }

    // Placer les nœuds
    for (const [cat, nodes] of Object.entries(groups)) {
      const center = centers[cat];
      const color = colors[cat];
      for (let i = 0; i < nodes.length; i++) {
        const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const r = 85 * (0.5 + Math.random() * 0.35);
        const x = center.cx + Math.cos(angle) * r;
        const y = center.cy + Math.sin(angle) * r;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', String(x));
        dot.setAttribute('cy', String(y));
        dot.setAttribute('r', String(4 + nodes[i].confidence * 4));
        dot.setAttribute('fill', color);
        dot.setAttribute('opacity', '0.8');
        dot.setAttribute('class', 'ikigai-dot');
        dot.style.filter = 'url(#glow)';

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${nodes[i].title} (${nodes[i].node_type})`;
        dot.appendChild(title);

        g.appendChild(dot);
        elementsLayer.appendChild(g);
      }
    }

    // Center glow
    const totalNodes = allNodes.length;
    if (centerLabel) {
      if (totalNodes >= 10) {
        centerLabel.setAttribute('class', 'font-jp ikigai-center-glow');
        centerLabel.setAttribute('fill', 'rgba(255,255,255,0.7)');
      } else if (totalNodes >= 5) {
        centerLabel.setAttribute('fill', 'rgba(255,255,255,0.4)');
        centerLabel.setAttribute('class', 'font-jp');
      }
    }
  }

  function flattenForDiagram(tree, result) {
    for (const node of tree) {
      result.push(node);
      if (node.children) flattenForDiagram(node.children, result);
    }
  }

  // ============================================================
  // UI UPDATES
  // ============================================================
  function updateUI() {
    const phaseBadge = document.getElementById('phase-badge');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    const labels = {
      amorcage: '🌱 Amorçage', exploration_passion: '❤️ Passion', exploration_mission: '🌍 Mission',
      exploration_vocation: '💰 Vocation', exploration_profession: '🎯 Talents',
      classification: '🔍 Classification', challenge: '⚡ Challenge', synthese: '✨ Synthèse', complete: '✅ Terminé',
    };

    if (phaseBadge) phaseBadge.textContent = labels[state.currentPhase] || '🌱 Exploration';
    if (progressBar) progressBar.style.width = state.phaseProgress + '%';
    if (progressText) progressText.textContent = state.phaseProgress + '%';
  }

  function updateStatsBar() {
    const allNodes = [];
    flattenForDiagram(state.memoryTree, allNodes);
    const counts = { passion: 0, mission: 0, vocation: 0, profession: 0 };
    for (const n of allNodes) {
      if (counts[n.category] !== undefined) counts[n.category]++;
    }

    ['passion', 'mission', 'vocation', 'profession'].forEach(cat => {
      const el = document.getElementById(`stat-${cat}`);
      if (el) el.textContent = counts[cat];
    });
  }

  function updateMemoryStatsDisplay() {
    const el = document.getElementById('memory-stats');
    if (!el) return;
    const allNodes = [];
    flattenForDiagram(state.memoryTree, allNodes);
    el.textContent = `${allNodes.length} nœuds · ${state.memoryRelations.length} connexions · Profondeur max: ${state.memoryStats?.deepest_branch || 0}`;
  }

  // ============================================================
  // TAB SWITCHING
  // ============================================================
  function switchTab(tab) {
    document.getElementById('panel-chat')?.classList.toggle('hidden', tab !== 'chat');
    document.getElementById('panel-memory')?.classList.toggle('hidden', tab !== 'memory');
    document.getElementById('panel-insights')?.classList.toggle('hidden', tab !== 'insights');

    ['tab-chat', 'tab-memory', 'tab-insights'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('tab-active');
        el.classList.add('text-gray-400');
      }
    });

    const activeTab = document.getElementById(`tab-${tab}`);
    if (activeTab) {
      activeTab.classList.add('tab-active');
      activeTab.classList.remove('text-gray-400');
    }

    if (tab === 'memory') loadMemoryTree();
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  if (btnSend) btnSend.addEventListener('click', sendMessage);
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      if (!confirm('Réinitialiser cette session de chat ?')) return;
      await axios.post('/api/session/reset', { session_id: state.sessionId });
      state.elements = [];
      state.currentPhase = 'amorcage';
      state.phaseProgress = 0;
      updateUI();
      if (chatMessages) {
        while (chatMessages.children.length > 1) chatMessages.lastChild.remove();
      }
      addSystemNote('🔄 Session réinitialisée');
    });
  }

  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (chatInput) {
        chatInput.value = btn.textContent.trim();
        chatInput.focus();
      }
    });
  });

  // Tab switching
  document.getElementById('tab-chat')?.addEventListener('click', () => switchTab('chat'));
  document.getElementById('tab-memory')?.addEventListener('click', () => switchTab('memory'));
  document.getElementById('tab-insights')?.addEventListener('click', () => switchTab('insights'));

  // Filtres mémoire
  document.getElementById('filter-category')?.addEventListener('change', loadMemoryTree);
  document.getElementById('filter-type')?.addEventListener('change', loadMemoryTree);

  // Bouton ajouter nœud racine
  document.getElementById('btn-add-root')?.addEventListener('click', () => showAddNodeForm(null));

  // Bouton close detail
  document.getElementById('btn-close-detail')?.addEventListener('click', () => {
    const detail = document.getElementById('node-detail');
    if (detail) detail.classList.add('hidden');
  });

  // Bouton daily insight
  document.getElementById('btn-daily-insight')?.addEventListener('click', () => {
    switchTab('insights');
    generateInsight();
  });

  // Bouton generate insight (dans le panel insights)
  document.getElementById('btn-generate-insight')?.addEventListener('click', generateInsight);

  // Export mémoire
  document.getElementById('btn-export-memory')?.addEventListener('click', async () => {
    try {
      const res = await axios.get('/api/memory/export');
      if (res.data.success) {
        const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ikigai-memory-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('Erreur export: ' + (err.response?.data?.error || err.message));
    }
  });

  // ===== HELPERS =====
  function generateId() {
    return 'ikigai_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  init();
  console.log('🎋 Ikigai Sensei V2.1 initialized!');
})();

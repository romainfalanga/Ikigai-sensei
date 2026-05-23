import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import api from './routes/api';
import type { Bindings } from './types';

const app = new Hono<{ Bindings: Bindings }>();

// Routes API
app.route('/api', api);

// Fichiers statiques (JS, CSS, assets)
app.use('/static/*', serveStatic({ root: './public' }));

// Page principale - SPA Ikigai V2
app.get('/', (c) => {
  return c.html(renderHTML());
});

// Favicon
app.get('/favicon.ico', (c) => c.notFound());

export default app;

// ============================================================
// RENDU HTML COMPLET - V2.0
// ============================================================
function renderHTML(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ikigai Sensei - Découvre ta raison d'être</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <link href="/static/styles.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            passion: '#E74C3C',
            mission: '#2ECC71',
            vocation: '#F39C12',
            profession: '#3498DB',
            ikigai: '#8E44AD',
          },
          animation: {
            'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            'bounce-in': 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            'fade-in': 'fadeIn 0.3s ease-in-out',
            'slide-up': 'slideUp 0.4s ease-out',
            'float': 'float 3s ease-in-out infinite',
            'ripple': 'ripple 0.6s ease-out',
            'shimmer': 'shimmer 2s linear infinite',
          },
          keyframes: {
            bounceIn: {
              '0%': { transform: 'scale(0.3)', opacity: '0' },
              '50%': { transform: 'scale(1.05)' },
              '70%': { transform: 'scale(0.9)' },
              '100%': { transform: 'scale(1)', opacity: '1' },
            },
            fadeIn: {
              '0%': { opacity: '0' },
              '100%': { opacity: '1' },
            },
            slideUp: {
              '0%': { transform: 'translateY(20px)', opacity: '0' },
              '100%': { transform: 'translateY(0)', opacity: '1' },
            },
            float: {
              '0%, 100%': { transform: 'translateY(0px)' },
              '50%': { transform: 'translateY(-10px)' },
            },
            ripple: {
              '0%': { transform: 'scale(0)', opacity: '0.5' },
              '100%': { transform: 'scale(1)', opacity: '0' },
            },
            shimmer: {
              '0%': { backgroundPosition: '-200% 0' },
              '100%': { backgroundPosition: '200% 0' },
            },
          },
        },
      },
    };
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
    }
    .font-jp { font-family: 'Noto Sans JP', sans-serif; }

    /* Shimmer effect pour loading */
    .shimmer-bg {
      background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%);
      background-size: 200% 100%;
      animation: shimmer 2s linear infinite;
    }

    /* Tree node styling */
    .tree-node-header {
      transition: all 0.15s ease;
    }
    .tree-node-header:hover {
      background: rgba(139, 92, 246, 0.15) !important;
    }
    .tree-node-header:active {
      background: rgba(139, 92, 246, 0.25) !important;
    }

    /* Tab active indicator */
    .tab-active {
      color: #fff !important;
      border-bottom: 2px solid #8b5cf6 !important;
    }

    /* Node detail card */
    .node-detail-card {
      background: linear-gradient(135deg, rgba(30,30,50,0.9), rgba(20,20,40,0.95));
      border: 1px solid rgba(139, 92, 246, 0.2);
    }

    /* Login page pattern */
    .login-bg-pattern {
      background-image:
        radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.06) 0%, transparent 50%),
        radial-gradient(circle at 60% 80%, rgba(59, 130, 246, 0.06) 0%, transparent 50%);
    }

    /* Insight card glow */
    .insight-card {
      position: relative;
      overflow: hidden;
    }
    .insight-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(135deg, rgba(139,92,246,0.1), transparent, rgba(236,72,153,0.05));
      pointer-events: none;
    }
  </style>
</head>
<body class="min-h-screen text-gray-100">

  <!-- ============================================================ -->
  <!-- PAGE LOGIN / REGISTER -->
  <!-- ============================================================ -->
  <div id="login-page" class="min-h-screen flex items-center justify-center p-4 login-bg-pattern">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8 animate-fade-in">
        <div class="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-4xl animate-float shadow-lg shadow-purple-500/25">
          🎋
        </div>
        <h1 class="text-3xl font-bold mt-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Ikigai Sensei
        </h1>
        <p class="text-gray-500 mt-1 font-jp">生きがい先生</p>
        <p class="text-gray-400 text-sm mt-3">
          Découvre le point magique où se croisent<br>
          tes passions, talents, et ta raison d'être ✨
        </p>
      </div>

      <!-- Formulaire Login -->
      <div id="login-form" class="bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-gray-800 p-6 shadow-2xl animate-slide-up">
        <h2 class="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <i class="fas fa-sign-in-alt text-purple-400"></i> Connexion
        </h2>
        <div class="space-y-4">
          <div>
            <label class="text-xs text-gray-500 block mb-1">Email</label>
            <input
              type="email" id="login-email" autocomplete="email"
              placeholder="ton@email.com"
              class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            >
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Mot de passe</label>
            <input
              type="password" id="login-password" autocomplete="current-password"
              placeholder="••••••••"
              class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            >
          </div>
          <button
            id="btn-login"
            class="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/20"
          >
            <i class="fas fa-arrow-right mr-1"></i> Se connecter
          </button>
        </div>
        <p class="text-center text-sm text-gray-500 mt-4">
          Pas encore de compte ?
          <a href="#" id="show-register" class="text-purple-400 hover:text-purple-300 transition-colors">Créer un compte</a>
        </p>
      </div>

      <!-- Formulaire Register -->
      <div id="register-form" class="hidden bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-gray-800 p-6 shadow-2xl animate-slide-up">
        <h2 class="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <i class="fas fa-user-plus text-purple-400"></i> Créer un compte
        </h2>
        <div class="space-y-4">
          <div>
            <label class="text-xs text-gray-500 block mb-1">Ton prénom</label>
            <input
              type="text" id="reg-name" autocomplete="given-name"
              placeholder="Explorateur"
              class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            >
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Email</label>
            <input
              type="email" id="reg-email" autocomplete="email"
              placeholder="ton@email.com"
              class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            >
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Mot de passe (6 caractères min)</label>
            <input
              type="password" id="reg-password" autocomplete="new-password"
              placeholder="••••••••"
              class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            >
          </div>
          <button
            id="btn-register"
            class="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/20"
          >
            <i class="fas fa-check mr-1"></i> Créer mon compte
          </button>
        </div>
        <p class="text-center text-sm text-gray-500 mt-4">
          Déjà un compte ?
          <a href="#" id="show-login" class="text-purple-400 hover:text-purple-300 transition-colors">Se connecter</a>
        </p>
      </div>

      <!-- Footer login page -->
      <p class="text-center text-xs text-gray-700 mt-6">
        Ikigai Sensei · Inspiré de la philosophie japonaise · <span class="font-jp">生きがい</span>
      </p>
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- APP PRINCIPALE (cachée tant que pas connecté) -->
  <!-- ============================================================ -->
  <div id="app-container" class="hidden min-h-screen flex flex-col">

    <!-- HEADER -->
    <header class="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 px-4 py-3 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <!-- Logo + Titre -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl animate-float shadow-md shadow-purple-500/20">
            🎋
          </div>
          <div>
            <h1 class="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Ikigai Sensei
            </h1>
            <span class="text-xs text-gray-500 font-jp">生きがい先生</span>
          </div>
        </div>

        <!-- Phase + Progression -->
        <div class="flex items-center gap-3">
          <span id="phase-badge" class="text-xs px-3 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700 whitespace-nowrap">
            🌱 Amorçage
          </span>
          <div id="progress-container" class="hidden sm:flex items-center gap-2">
            <div class="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div id="progress-bar" class="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500" style="width: 0%"></div>
            </div>
            <span id="progress-text" class="text-xs text-gray-500">0%</span>
          </div>
          <button id="btn-reset" class="text-gray-500 hover:text-red-400 transition-colors p-2" title="Réinitialiser la session">
            <i class="fas fa-redo-alt"></i>
          </button>
        </div>
      </div>
    </header>

    <!-- MAIN CONTENT -->
    <main class="flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-6">

      <!-- ===== LEFT PANEL: Ikigai Diagram ===== -->
      <section class="lg:w-5/12 flex items-start justify-center lg:sticky lg:top-20 lg:self-start">
        <div class="relative w-full max-w-md aspect-square" id="ikigai-diagram">
          <svg viewBox="0 0 400 400" class="w-full h-full" id="ikigai-svg">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="glow-strong">
                <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <!-- Circle: Passion (top) -->
            <circle cx="140" cy="140" r="115" fill="rgba(231,76,60,0.12)" stroke="#E74C3C" stroke-width="2" stroke-dasharray="8 4" id="circle-passion" class="transition-all duration-700"/>
            <text x="140" y="100" text-anchor="middle" fill="#E74C3C" font-size="13" font-weight="600" class="font-jp">❤️ Ce que tu aimes</text>

            <!-- Circle: Mission (right) -->
            <circle cx="260" cy="140" r="115" fill="rgba(46,204,113,0.12)" stroke="#2ECC71" stroke-width="2" stroke-dasharray="8 4" id="circle-mission" class="transition-all duration-700"/>
            <text x="260" y="100" text-anchor="middle" fill="#2ECC71" font-size="13" font-weight="600" class="font-jp">🌍 Besoins du monde</text>

            <!-- Circle: Vocation (left) -->
            <circle cx="140" cy="260" r="115" fill="rgba(243,156,18,0.12)" stroke="#F39C12" stroke-width="2" stroke-dasharray="8 4" id="circle-vocation" class="transition-all duration-700"/>
            <text x="140" y="310" text-anchor="middle" fill="#F39C12" font-size="13" font-weight="600" class="font-jp">💰 Payé pour</text>

            <!-- Circle: Profession (bottom) -->
            <circle cx="260" cy="260" r="115" fill="rgba(52,152,219,0.12)" stroke="#3498DB" stroke-width="2" stroke-dasharray="8 4" id="circle-profession" class="transition-all duration-700"/>
            <text x="260" y="310" text-anchor="middle" fill="#3498DB" font-size="13" font-weight="600" class="font-jp">🎯 Tes talents</text>

            <!-- Center label -->
            <text x="200" y="193" text-anchor="middle" fill="rgba(255,255,255,0.25)" font-size="18" font-weight="700" class="font-jp" id="center-label">IKIGAI</text>
            <text x="200" y="210" text-anchor="middle" fill="rgba(255,255,255,0.12)" font-size="9" class="font-jp" id="center-sub">découvre ta raison d'être</text>

            <!-- Relations layer (lignes entre les nœuds) -->
            <g id="relations-layer"></g>
            <!-- Nœuds layer -->
            <g id="elements-layer"></g>
          </svg>
        </div>
      </section>

      <!-- ===== RIGHT PANEL: Tabs ===== -->
      <section class="lg:w-7/12 flex flex-col gap-4">

        <!-- Tab Navigation -->
        <nav class="flex gap-0 bg-gray-900/60 rounded-t-xl border border-gray-800 border-b-0 overflow-hidden">
          <button id="tab-chat" class="tab-active flex-1 py-3 px-4 text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2">
            <i class="fas fa-comments"></i> Chat
          </button>
          <button id="tab-memory" class="flex-1 py-3 px-4 text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2">
            <i class="fas fa-sitemap"></i> Explorateur
          </button>
          <button id="tab-insights" class="flex-1 py-3 px-4 text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2">
            <i class="fas fa-lightbulb"></i> Insights
          </button>
        </nav>

        <!-- ===== TAB: CHAT ===== -->
        <div id="panel-chat" class="flex-1 bg-gray-900/60 backdrop-blur-sm rounded-b-xl border border-gray-800 border-t-0 overflow-hidden flex flex-col min-h-[500px]">

          <!-- Chat Header -->
          <div class="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span class="text-sm text-gray-400">Ikigai Sensei</span>
            <span class="text-xs text-gray-600 ml-2">· En ligne</span>
            <!-- Bouton Daily Insight -->
            <button id="btn-daily-insight" class="ml-auto text-xs px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors" title="Générer un insight à partir de ta mémoire">
              <i class="fas fa-magic mr-1"></i> Insight du jour
            </button>
          </div>

          <!-- Messages Container -->
          <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            <!-- Welcome message -->
            <div class="flex gap-3 animate-fade-in">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm flex-shrink-0 shadow-md">
                🎋
              </div>
              <div class="bg-gray-800/80 rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%]">
                <p class="text-sm text-gray-200">
                  Konnichiwa ! 👋 Je suis <strong>Ikigai Sensei</strong>, ton guide pour cartographier ta raison d'être.
                </p>
                <p class="text-sm text-gray-300 mt-2">
                  Ensemble, on va explorer quatre dimensions de ta vie : <span class="text-red-400">passions</span>, <span class="text-green-400">missions</span>, <span class="text-yellow-400">vocations</span> et <span class="text-blue-400">talents</span>. Chaque découverte enrichira ta <strong>carte de conscience</strong> personnelle.
                </p>
                <p class="text-sm text-gray-300 mt-2">
                  Pour commencer... <strong>raconte-moi un peu qui tu es. Qu'est-ce qui te fait vibrer ?</strong> ✨
                </p>
              </div>
            </div>
          </div>

          <!-- Input Area -->
          <div class="p-4 border-t border-gray-800">
            <div class="flex gap-2">
              <textarea
                id="chat-input"
                rows="1"
                placeholder="Écris ton message..."
                class="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                style="min-height: 44px; max-height: 120px;"
              ></textarea>
              <button
                id="btn-send"
                class="px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-lg shadow-purple-500/20"
              >
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
            <div class="flex gap-2 mt-2 flex-wrap">
              <button class="quick-btn text-xs px-3 py-1 rounded-full bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-white transition-all border border-gray-700">
                🎨 J'aime créer des choses
              </button>
              <button class="quick-btn text-xs px-3 py-1 rounded-full bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-white transition-all border border-gray-700">
                🧠 Je suis bon en analyse
              </button>
              <button class="quick-btn text-xs px-3 py-1 rounded-full bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-white transition-all border border-gray-700">
                🌍 Le monde a besoin de...
              </button>
              <button class="quick-btn text-xs px-3 py-1 rounded-full bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-white transition-all border border-gray-700">
                💰 Comment monétiser ?
              </button>
            </div>
          </div>
        </div>

        <!-- ===== TAB: EXPLORATEUR MÉMOIRE ===== -->
        <div id="panel-memory" class="hidden flex-1 bg-gray-900/60 backdrop-blur-sm rounded-b-xl border border-gray-800 border-t-0 overflow-hidden flex flex-col min-h-[600px]">

          <!-- Barre d'outils -->
          <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-400 flex items-center gap-1">
                <i class="fas fa-sitemap text-purple-400"></i> Carte de Conscience
              </span>
              <span id="memory-stats" class="text-xs text-gray-600">—</span>
            </div>
            <div class="flex items-center gap-2">
              <!-- Filtres -->
              <select id="filter-category" class="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-400 focus:outline-none focus:border-purple-500">
                <option value="">Toutes catégories</option>
                <option value="passion">❤️ Passion</option>
                <option value="mission">🌍 Mission</option>
                <option value="vocation">💰 Vocation</option>
                <option value="profession">🎯 Profession</option>
              </select>
              <select id="filter-type" class="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-400 focus:outline-none focus:border-purple-500">
                <option value="">Tous types</option>
                <option value="concept">💭 Concept</option>
                <option value="skill">🔧 Compétence</option>
                <option value="experience">🌟 Expérience</option>
                <option value="project">📦 Projet</option>
                <option value="value">💎 Valeur</option>
                <option value="goal">🎯 Objectif</option>
                <option value="fear">😰 Peur</option>
                <option value="story">📖 Histoire</option>
                <option value="insight">💡 Insight</option>
              </select>
              <button id="btn-export-memory" class="text-xs px-2 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white border border-gray-700 transition-colors" title="Exporter la mémoire">
                <i class="fas fa-download mr-1"></i> Export
              </button>
              <button id="btn-add-root" class="text-xs px-3 py-1 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/20 transition-colors">
                <i class="fas fa-plus mr-1"></i> Ajouter
              </button>
            </div>
          </div>

          <!-- Arborescence -->
          <div id="memory-tree-container" class="flex-1 overflow-y-auto p-3 space-y-0.5 text-xs font-mono-like">
            <!-- Rempli dynamiquement par app.js -->
            <div class="text-center py-12 text-gray-600">
              <i class="fas fa-brain text-3xl mb-3 block opacity-30"></i>
              <p class="text-sm">Ta carte de conscience est vide</p>
              <p class="text-xs mt-1">Discute avec Ikigai Sensei pour commencer l'exploration !</p>
            </div>
          </div>

          <!-- Détail du nœud sélectionné -->
          <div id="node-detail" class="hidden border-t border-gray-800 p-4 node-detail-card">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 id="node-detail-title" class="font-semibold text-gray-200 mb-1"></h3>
                <p id="node-detail-desc" class="text-sm text-gray-500 mb-2"></p>
                <div id="node-detail-meta" class="flex flex-wrap gap-2 text-xs"></div>
              </div>
              <button id="btn-close-detail" class="text-gray-600 hover:text-gray-400">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <!-- Relations de ce nœud -->
            <div id="node-relations" class="mt-3 pt-3 border-t border-gray-800">
              <span class="text-xs text-gray-600">Connexions :</span>
              <div id="node-relations-list" class="mt-1 space-y-1"></div>
            </div>
          </div>
        </div>

        <!-- ===== TAB: INSIGHTS ===== -->
        <div id="panel-insights" class="hidden flex-1 bg-gray-900/60 backdrop-blur-sm rounded-b-xl border border-gray-800 border-t-0 overflow-hidden flex flex-col min-h-[500px]">

          <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <span class="text-sm text-gray-400 flex items-center gap-2">
              <i class="fas fa-lightbulb text-yellow-400"></i> Insights & Patterns
            </span>
            <button id="btn-generate-insight" class="text-xs px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors">
              <i class="fas fa-magic mr-1"></i> Générer un nouvel insight
            </button>
          </div>

          <!-- Liste des insights -->
          <div id="insights-container" class="flex-1 overflow-y-auto p-4 space-y-4">
            <!-- État vide -->
            <div id="insights-empty" class="text-center py-12">
              <i class="fas fa-lightbulb text-4xl mb-3 block opacity-20 text-yellow-400"></i>
              <p class="text-sm text-gray-500">Aucun insight pour le moment</p>
              <p class="text-xs text-gray-600 mt-1">
                Continue d'explorer avec Ikigai Sensei,<br>
                ou clique sur "Générer" pour obtenir une analyse de ta carte.
              </p>
            </div>

            <!-- Clusters -->
            <div id="insights-clusters" class="space-y-3"></div>

            <!-- Relations croisées -->
            <div id="insights-cross" class="space-y-3"></div>

            <!-- Daily Insight -->
            <div id="insights-daily" class="space-y-3"></div>
          </div>
        </div>

        <!-- ===== STATS BAR (sous les tabs) ===== -->
        <div class="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800 p-3 grid grid-cols-4 gap-2">
          <div class="text-center">
            <div id="stat-passion" class="text-lg font-bold text-red-400">0</div>
            <div class="text-[10px] text-gray-600">❤️ Passions</div>
          </div>
          <div class="text-center">
            <div id="stat-mission" class="text-lg font-bold text-green-400">0</div>
            <div class="text-[10px] text-gray-600">🌍 Missions</div>
          </div>
          <div class="text-center">
            <div id="stat-vocation" class="text-lg font-bold text-yellow-400">0</div>
            <div class="text-[10px] text-gray-600">💰 Vocations</div>
          </div>
          <div class="text-center">
            <div id="stat-profession" class="text-lg font-bold text-blue-400">0</div>
            <div class="text-[10px] text-gray-600">🎯 Talents</div>
          </div>
        </div>

        <!-- ===== SIDEBAR UTILISATEUR ===== -->
        <div class="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800 p-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm shadow-md">
              🧑
            </div>
            <div>
              <div id="user-name-display" class="text-sm font-medium text-gray-300">—</div>
              <div id="user-email-display" class="text-xs text-gray-600">—</div>
            </div>
          </div>
          <button id="btn-logout" class="text-xs px-3 py-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all">
            <i class="fas fa-sign-out-alt mr-1"></i> Déconnexion
          </button>
        </div>

      </section>
    </main>

    <!-- FOOTER -->
    <footer class="text-center py-3 text-xs text-gray-700 border-t border-gray-800/50">
      Ikigai Sensei · Inspiré de la philosophie japonaise · <span class="font-jp">生きがい</span>
    </footer>
  </div>

  <!-- SCRIPTS -->
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="/static/app.js"></script>
</body>
</html>`;
}

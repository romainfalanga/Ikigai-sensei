import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import api from './routes/api';
import type { Bindings } from './types';

const app = new Hono<{ Bindings: Bindings }>();

// Routes API
app.route('/api', api);

// Fichiers statiques (JS, CSS, assets)
app.use('/static/*', serveStatic({ root: './public' }));

// Page principale - SPA Ikigai
app.get('/', (c) => {
  return c.html(renderHTML());
});

// Favicon
app.get('/favicon.ico', (c) => c.notFound());

export default app;

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
  </style>
</head>
<body class="min-h-screen text-gray-100">

  <!-- App Container -->
  <div id="app" class="min-h-screen flex flex-col">
    <!-- Header -->
    <header class="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 px-4 py-3 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl animate-float">
            🎋
          </div>
          <div>
            <h1 class="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Ikigai Sensei
            </h1>
            <span class="text-xs text-gray-500 font-jp">生きがい先生</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span id="phase-badge" class="text-xs px-3 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
            🌱 Amorçage
          </span>
          <div id="progress-container" class="hidden sm:flex items-center gap-2">
            <div class="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div id="progress-bar" class="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500" style="width: 0%"></div>
            </div>
            <span id="progress-text" class="text-xs text-gray-500">0%</span>
          </div>
          <button id="btn-reset" class="text-gray-500 hover:text-red-400 transition-colors p-2" title="Réinitialiser">
            <i class="fas fa-redo-alt"></i>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-6">
      <!-- Ikigai Diagram (Left Panel) -->
      <section class="lg:w-1/2 flex items-start justify-center lg:sticky lg:top-20 lg:self-start">
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
            </defs>

            <!-- Circle: Passion (top) -->
            <circle cx="140" cy="140" r="115" fill="rgba(231,76,60,0.15)" stroke="#E74C3C" stroke-width="2" stroke-dasharray="8 4" id="circle-passion"/>
            <text x="140" y="100" text-anchor="middle" fill="#E74C3C" font-size="14" font-weight="600" class="font-jp">❤️ Ce que tu aimes</text>

            <!-- Circle: Mission (right) -->
            <circle cx="260" cy="140" r="115" fill="rgba(46,204,113,0.15)" stroke="#2ECC71" stroke-width="2" stroke-dasharray="8 4" id="circle-mission"/>
            <text x="260" y="100" text-anchor="middle" fill="#2ECC71" font-size="14" font-weight="600" class="font-jp">🌍 Ce dont le monde a besoin</text>

            <!-- Circle: Vocation (left) -->
            <circle cx="140" cy="260" r="115" fill="rgba(243,156,18,0.15)" stroke="#F39C12" stroke-width="2" stroke-dasharray="8 4" id="circle-vocation"/>
            <text x="140" y="310" text-anchor="middle" fill="#F39C12" font-size="14" font-weight="600" class="font-jp">💰 Payé pour</text>

            <!-- Circle: Profession (bottom) -->
            <circle cx="260" cy="260" r="115" fill="rgba(52,152,219,0.15)" stroke="#3498DB" stroke-width="2" stroke-dasharray="8 4" id="circle-profession"/>
            <text x="260" y="310" text-anchor="middle" fill="#3498DB" font-size="14" font-weight="600" class="font-jp">🎯 Tes talents</text>

            <!-- Center label -->
            <text x="200" y="195" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="20" font-weight="700" class="font-jp" id="center-label">IKIGAI</text>

            <!-- Elements will be placed here dynamically -->
            <g id="elements-layer"></g>
          </svg>
        </div>
      </section>

      <!-- Chat + Memory Panel (Right) -->
      <section class="lg:w-1/2 flex flex-col gap-4">
        <!-- Chat Area -->
        <div class="flex-1 bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-gray-800 overflow-hidden flex flex-col min-h-[500px]">
          <div class="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span class="text-sm text-gray-400">Ikigai Sensei</span>
          </div>

          <!-- Messages -->
          <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            <!-- Welcome message -->
            <div class="flex gap-3 animate-fade-in">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm flex-shrink-0">
                🎋
              </div>
              <div class="bg-gray-800/80 rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%]">
                <p class="text-sm text-gray-200">
                  Konnichiwa ! 👋 Je suis <strong>Ikigai Sensei</strong>, ton guide pour découvrir ta raison d'être.
                </p>
                <p class="text-sm text-gray-300 mt-2">
                  Ensemble, on va explorer quatre dimensions de ta vie pour trouver ce point magique où se croisent tes passions, tes talents, ce dont le monde a besoin, et ce qui a de la valeur.
                </p>
                <p class="text-sm text-gray-300 mt-2">
                  Pour commencer... <strong>raconte-moi un peu qui tu es. Qu'est-ce qui te fait vibrer dans la vie ?</strong> ✨
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
                class="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
            <div class="flex gap-2 mt-2 flex-wrap">
              <button class="quick-btn text-xs px-3 py-1 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700">
                J'aime créer des choses
              </button>
              <button class="quick-btn text-xs px-3 py-1 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700">
                Je suis bon en analyse
              </button>
              <button class="quick-btn text-xs px-3 py-1 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700">
                Le monde a besoin de...
              </button>
            </div>
          </div>
        </div>

        <!-- Memory Panel -->
        <div class="bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-gray-800 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <span class="text-sm text-gray-400">
              <i class="fas fa-brain mr-1"></i> Mémoire de l'Ikigai
            </span>
            <span id="element-count" class="text-xs text-gray-600">0 élément</span>
          </div>
          <div id="memory-panel" class="p-3 max-h-64 overflow-y-auto">
            <div class="grid grid-cols-2 gap-2">
              <!-- Passion -->
              <div class="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                <div class="text-xs text-red-400 font-semibold mb-1">❤️ Passion</div>
                <ul id="mem-passion" class="text-xs text-gray-400 space-y-1"></ul>
              </div>
              <!-- Mission -->
              <div class="bg-green-500/10 rounded-lg p-2 border border-green-500/20">
                <div class="text-xs text-green-400 font-semibold mb-1">🌍 Mission</div>
                <ul id="mem-mission" class="text-xs text-gray-400 space-y-1"></ul>
              </div>
              <!-- Vocation -->
              <div class="bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/20">
                <div class="text-xs text-yellow-400 font-semibold mb-1">💰 Vocation</div>
                <ul id="mem-vocation" class="text-xs text-gray-400 space-y-1"></ul>
              </div>
              <!-- Profession -->
              <div class="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
                <div class="text-xs text-blue-400 font-semibold mb-1">🎯 Profession</div>
                <ul id="mem-profession" class="text-xs text-gray-400 space-y-1"></ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="text-center py-3 text-xs text-gray-600 border-t border-gray-800">
      Ikigai Sensei · Inspiré de la philosophie japonaise · <span class="font-jp">生きがい</span>
    </footer>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="/static/app.js"></script>
</body>
</html>`;
}

import './styles.css';

const front = document.getElementById('front-menu');
const host = document.getElementById('game');
const status = document.getElementById('front-status');
const logo = document.getElementById('front-logo');
let enginePromise, entering;

function fallbackLogo() {
  if (!logo.src.endsWith('.png')) logo.src = new URL('assets/brand/ulbris-logo.png', document.baseURI).href;
}
logo.addEventListener('error', fallbackLogo);
if (logo.complete && !logo.naturalWidth) fallbackLogo();

async function loadGame() {
  if (!enginePromise) enginePromise = import('./main.js').then(async module => {
    const game = module.default;
    const started = performance.now();
    while (!game.scene.isActive('MenuScene')) {
      if (performance.now() - started > 25000) throw new Error('Game startup timed out');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    if (!front.hidden && !entering) game.loop.sleep();
    return game;
  });
  return enginePromise;
}

function showScreen(screen) {
  front.dataset.screen = screen;
  document.getElementById('front-home').hidden = screen !== 'home';
  document.getElementById('front-lobby').hidden = screen !== 'lobby';
  document.getElementById('front-tagline').textContent = screen === 'home'
    ? 'Cada espaço, uma possibilidade.' : 'Prepare sua próxima jornada.';
  front.querySelector(screen === 'home' ? '[data-action="start"]' : '[data-action="play"]').focus({preventScroll:true});
}

export function enterGame(key = 'CharacterSelectScene') {
  if (entering) return entering;
  status.textContent = 'Preparando o jogo...';
  for (const button of front.querySelectorAll('[data-action="play"], [data-action="items"]')) button.disabled = true;
  entering = (async () => {
    try {
      const game = await loadGame();
      game.loop.wake();
      for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key);
      game.scene.start(key);
      front.hidden = true; host.removeAttribute('aria-hidden');
      status.textContent = '';
      return game;
    } catch (error) {
      status.textContent = 'Não foi possível abrir o jogo. Confira sua conexão e tente novamente.';
      document.getElementById('front-retry').hidden = false;
      throw error;
    } finally {
      entering = null;
      for (const button of front.querySelectorAll('button')) button.disabled = false;
    }
  })();
  return entering;
}

front.querySelector('[data-action="start"]').addEventListener('click', () => showScreen('lobby'));
front.querySelector('[data-action="back"]').addEventListener('click', () => showScreen('home'));
front.querySelector('[data-action="play"]').addEventListener('click', () => { void enterGame().catch(() => {}); });
front.querySelector('[data-action="items"]').addEventListener('click', () => { void enterGame('ItemCatalogScene').catch(() => {}); });
document.getElementById('front-retry').addEventListener('click', () => location.reload());

// The launcher is also the single entry point used by browser smoke checks.
window.ulbris = { menuReady: true, enterGame };
performance.mark('ulbris-menu-ready');
requestAnimationFrame(() => requestAnimationFrame(() => {
  const warm = () => { if (!navigator.connection?.saveData) void loadGame().catch(() => {}); };
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, {timeout:1200});
  else setTimeout(warm, 300);
}));

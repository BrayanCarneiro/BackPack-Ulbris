import { account } from '../services/account.js';
import './account.css';

let panel;

function createPanel() {
  const root = document.createElement('aside');
  root.className = 'account-widget';
  root.hidden = true;
  root.setAttribute('aria-label', 'Conta do jogador');
  const avatarUrl = new URL('assets/characters/arthur/portrait.webp', new URL(import.meta.env.BASE_URL, location.href));
  root.style.setProperty('--account-avatar', `url("${avatarUrl.href}")`);
  root.innerHTML = `<button class="account-badge" type="button" aria-haspopup="dialog">
    <span class="account-avatar" aria-hidden="true"></span>
    <span class="account-badge-copy"><strong></strong><span></span></span>
    <span class="account-badge-chevron" aria-hidden="true">›</span>
  </button>`;
  const dialog = document.createElement('dialog');
  dialog.className = 'account-dialog';
  dialog.style.setProperty('--account-avatar', `url("${avatarUrl.href}")`);
  dialog.setAttribute('aria-labelledby', 'account-title');
  document.body.append(root, dialog);
  let source = null, inputWasEnabled = true, busy = false, mode = 'login', lastUsername = '';
  const badge = root.querySelector('button');

  function updateBadge() {
    const { user } = account.state;
    root.querySelector('strong').textContent = user?.username ?? 'Viajante';
    root.querySelector('.account-badge-copy > span').textContent = user ? 'Meu perfil' : 'Entrar / Criar conta';
    badge.setAttribute('aria-label', user ? `Abrir perfil de ${user.username}` : 'Entrar ou criar conta');
  }
  const unsubscribe = account.subscribe(updateBadge);
  updateBadge();

  function status(message = '') {
    const element = dialog.querySelector('.account-status');
    if (element) element.textContent = message;
  }

  function setBusy(value) {
    busy = value;
    dialog.setAttribute('aria-busy', String(value));
    for (const button of dialog.querySelectorAll('button')) button.disabled = value;
    for (const input of dialog.querySelectorAll('input')) input.readOnly = value;
  }

  function restoreInput() {
    if (source?.input) source.input.enabled = inputWasEnabled;
  }
  function close() {
    if (!busy && dialog.open) { restoreInput(); dialog.close(); }
  }
  function restartMenu() {
    const scene = source;
    close();
    if (scene?.sys.isActive()) scene.scene.restart();
  }

  function render() {
    const { user, available } = account.state;
    const registration = mode === 'register';
    dialog.innerHTML = `<button type="button" class="account-close" aria-label="Fechar">×</button>
      <header class="account-heading"><span class="account-avatar account-avatar-large" aria-hidden="true"></span>
      <span class="account-eyebrow">ULBRIS · AVENTUREIROS</span>
      <h1 id="account-title"></h1><p class="account-subtitle"></p></header>
      <div class="account-content"></div><p class="account-status" role="alert" aria-live="polite"></p>`;
    dialog.querySelector('.account-close').addEventListener('click', close);
    dialog.querySelector('h1').textContent = user ? user.username : registration ? 'Crie sua conta' : 'Bem-vindo de volta';
    dialog.querySelector('.account-subtitle').textContent = user ? 'Cavaleiro · Arthur' : 'Sua próxima jornada começa aqui.';
    const content = dialog.querySelector('.account-content');
    if (!available) {
      content.innerHTML = `<p class="account-note">As contas estão indisponíveis neste endereço. Você pode continuar jogando como visitante.</p>
        <button class="account-primary account-retry" type="button">Tentar novamente</button>`;
      content.querySelector('button').addEventListener('click', async () => {
        setBusy(true); status('Conectando…');
        const previousOwner = account.state.user?.id;
        try {
          await account.refresh(); setBusy(false);
          if (previousOwner !== account.state.user?.id) restartMenu();
          else render();
        }
        catch (error) { setBusy(false); status(error.message); }
      });
      return;
    }
    if (user) {
      content.innerHTML = `<dl class="account-facts"><div><dt>Usuário</dt><dd class="account-username"></dd></div>
        <div><dt>Membro desde</dt><dd class="account-created"></dd></div></dl>
        <button class="account-primary account-play" type="button">Continuar jogando</button>
        <button class="account-secondary account-logout" type="button">Sair da conta</button>`;
      content.querySelector('.account-username').textContent = user.username;
      content.querySelector('.account-created').textContent = new Date(user.createdAt)
        .toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      content.querySelector('.account-play').addEventListener('click', close);
      content.querySelector('.account-logout').addEventListener('click', async () => {
        setBusy(true); status('Saindo…');
        try { await account.logout(); setBusy(false); restartMenu(); }
        catch (error) { setBusy(false); status(error.message); }
      });
      return;
    }
    content.innerHTML = `<div class="account-tabs" role="group" aria-label="Acesso à conta">
      <button type="button" data-mode="login">Entrar</button><button type="button" data-mode="register">Criar conta</button></div>
      <form class="account-form">
        <label for="account-username">Usuário</label>
        <input id="account-username" name="username" autocomplete="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}"
          aria-describedby="account-username-hint" placeholder="Seu nome de aventureiro" required autocapitalize="none" spellcheck="false">
        <small id="account-username-hint">3 a 24 letras, números ou _</small>
        <label for="account-password">Senha</label>
        <input id="account-password" name="password" type="password" minlength="8" maxlength="128" required>
        ${registration ? `<label for="account-confirm">Confirmar senha</label>
          <input id="account-confirm" name="confirmation" type="password" autocomplete="new-password" minlength="8" maxlength="128" required>
          <p class="account-note">Guarde sua senha: a recuperação de acesso ainda não está disponível.</p>` : ''}
        <button class="account-primary" type="submit"></button>
      </form>`;
    content.querySelector('#account-username').value = lastUsername;
    const password = content.querySelector('#account-password');
    password.autocomplete = registration ? 'new-password' : 'current-password';
    password.placeholder = 'Pelo menos 8 caracteres';
    content.querySelector('[type="submit"]').textContent = registration ? 'Criar minha conta' : 'Entrar na conta';
    for (const button of content.querySelectorAll('[data-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
      button.addEventListener('click', () => {
        lastUsername = content.querySelector('#account-username').value;
        mode = button.dataset.mode; render();
      });
    }
    content.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const username = content.querySelector('#account-username').value.trim();
      const value = password.value;
      if (registration && value !== content.querySelector('#account-confirm').value) {
        status('As senhas precisam ser iguais.'); return;
      }
      lastUsername = username;
      setBusy(true); status(registration ? 'Criando sua conta…' : 'Entrando…');
      try {
        await account[registration ? 'register' : 'login'](username, value);
        setBusy(false); restartMenu();
      } catch (error) {
        setBusy(false); status(error.message);
        password.value = '';
        if (registration) content.querySelector('#account-confirm').value = '';
        password.focus();
      }
    });
  }

  badge.addEventListener('click', async () => {
    if (!source || dialog.open) return;
    inputWasEnabled = source.input.enabled;
    source.input.enabled = false;
    mode = 'login'; lastUsername = '';
    render(); dialog.showModal();
    setBusy(true); status('Conectando…');
    const previousOwner = account.state.user?.id;
    let refreshError = '';
    try { await account.refresh(); }
    catch (error) { refreshError = error.message; }
    setBusy(false);
    if (!dialog.open) return;
    if (previousOwner !== account.state.user?.id) { restartMenu(); return; }
    render();
    if (refreshError) status(refreshError);
    dialog.querySelector('input')?.focus();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    restoreInput();
    dialog.replaceChildren();
  });
  return {
    show(scene) {
      source = scene; root.hidden = false; updateBadge();
      const hide = () => {
        if (source !== scene) return;
        root.hidden = true;
        if (dialog.open) { restoreInput(); dialog.close(); }
        source = null;
        scene.events.off('shutdown', hide);
        scene.events.off('destroy', hide);
      };
      scene.events.once('shutdown', hide);
      scene.events.once('destroy', hide);
    },
    destroy() { unsubscribe(); if (dialog.open) dialog.close(); root.remove(); dialog.remove(); panel = null; },
  };
}

export function showAccountPanel(scene) {
  panel ??= createPanel();
  panel.show(scene);
}

if (import.meta.hot) import.meta.hot.dispose(() => panel?.destroy());

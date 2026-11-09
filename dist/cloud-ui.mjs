import {CloudProgress,CLOUD_BACKUP_KEY,progressSummary} from './cloud-save.mjs';
import {loadCloudClient} from './cloud-client.mjs';
import {encodeProgress} from './save-transfer.mjs';

export function setupCloudAccount({storage, getSave, applySave, atCamp, beforeOpen, loadClient = loadCloudClient}) {
  const el = id => document.getElementById(id);
  let client, listenerClient, bootPromise, verifyCode, mode = 'password', working = false, cooldown = 0, interval, activeUid;
  const offline = document.documentElement.dataset.offline === 'true' || globalThis.location?.protocol === 'file:';
  const sync = new CloudProgress({storage, getSave, applySave, atCamp, onState: paint});
  el('accountPanel').hidden = true;
  function message(text) {el('accountMessage').textContent = text;}
  function errorMessage(error) {
    const text = error?.message || '暂时无法连接云端，请稍后重试。本机进度仍保留。';
    return /already.*(exist|register)|user.*not.*found|account.*not.*exist/i.test(text) ? '暂未完成登录，请检查信息，或使用验证码登录。' : text;
  }
  function paint(state = sync) {
    const signedIn = !!state.user;
    el('accountGuest').hidden = signedIn || offline;
    el('accountMember').hidden = !signedIn;
    el('accountIdentity').textContent = state.user?.email || state.user?.username || '已登录账号';
    el('accountSyncStatus').textContent = state.message;
    el('accountChoice').hidden = state.phase !== 'choice';
    el('cloudLocalSummary').textContent = progressSummary(getSave());
    el('cloudRemoteSummary').textContent = progressSummary(state.remote?.progress);
    el('keepCloud').disabled = working || !atCamp() || !state.remote?.progress;
    el('keepLocal').disabled = working || !atCamp();
    el('keepLocal').textContent = state.remote?.progress ? '保留本机修行与余烬' : '将本机进度保存到账号';
    el('cloudRefresh').disabled = working || state.phase === 'syncing';
    el('accountSignOut').disabled = working;
    const labels = {guest:'账号与云存档 ↗',syncing:'云存档 · 同步中',synced:'云存档 · 已同步',pending:'云存档 · 待同步',choice:'云存档 · 选择进度',waiting:'云存档 · 回旅营更新',error:'云存档 · 待重试'};
    for (const id of ['accountHome','accountPause']) el(id).textContent = offline ? '云存档 · 在线版可用' : labels[state.phase] || '账号与云存档 ↗';
    refreshBackup();
  }
  function refreshBackup() {
    try {
      const backup = JSON.parse(storage?.getItem(CLOUD_BACKUP_KEY) || '[]')?.[0];
      el('cloudBackupDetails').hidden = !backup;
      if (backup) el('cloudBackupCode').value = encodeProgress(backup.progress);
    } catch {el('cloudBackupDetails').hidden = true;}
  }
  function formState() {
    el('accountPasswordLabel').hidden = mode === 'otp';
    el('accountPassword').required = mode !== 'otp';
    el('accountPassword').autocomplete = mode === 'register' || mode === 'reset' ? 'new-password' : 'current-password';
    el('accountPassword').minLength = mode === 'register' || mode === 'reset' ? 8 : 1;
    el('accountCodeLabel').hidden = !verifyCode;
    el('accountCode').required = !!verifyCode;
    el('accountEmail').readOnly = !!verifyCode;
    el('accountPassword').readOnly = !!verifyCode;
    el('accountSubmit').disabled = working || (!verifyCode && mode !== 'password' && Date.now() < cooldown);
    el('accountSubmit').textContent = working ? '请稍候…' : verifyCode ? (mode === 'reset' ? '确认并设置新密码' : '验证并继续') : mode === 'password' ? '登录账号' : '发送邮箱验证码';
    el('accountBack').hidden = !verifyCode;
    el('accountResend').hidden = !verifyCode;
    el('accountResend').disabled = working || Date.now() < cooldown;
    el('accountResend').textContent = Date.now() < cooldown ? Math.ceil((cooldown - Date.now()) / 1000) + ' 秒后可重发' : '重新发送验证码';
    for (const value of ['password','otp','register','reset']) {
      el('auth' + value).setAttribute('aria-pressed', value === mode);
      el('auth' + value).disabled = working;
    }
  }
  function selectMode(value) {
    if (working) return;
    mode = value; verifyCode = null; el('accountCode').value = ''; el('accountPassword').value = '';
    message(value === 'register' ? '验证邮箱后创建账号，已有本机进度会保留。密码至少 8 位，含字母和数字。' :
      value === 'reset' ? '验证邮箱后设置新密码。请在下方填写新密码，再发送验证码。' : '登录后可在不同设备和游戏网址同步永久进度。');
    formState();
  }
  async function sessionChanged(session) {
    const user = session?.user;
    if (!user?.id || user.is_anonymous) {
      activeUid = null; sync.disconnect(); paint(); return;
    }
    if (activeUid === user.id) return;
    activeUid = user.id; el('accountPassword').value = ''; el('accountCode').value = '';
    verifyCode = null; formState();
    await sync.connect(user, client.backend(user.id));
  }
  async function boot() {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      if (offline) throw new Error('离线版保留本机存档和迁移码。请打开在线游戏网址使用账号云存档。');
      client = await loadClient();
      // Never await an SDK auth method from inside its auth-state callback.
      if (listenerClient !== client) {
        client.auth.onAuthStateChange((_event, session) => {queueMicrotask(() => {void sessionChanged(session);});});
        listenerClient = client;
      }
      await sessionChanged(await client.session());
      return client;
    })();
    try {return await bootPromise;} catch (error) {bootPromise = null; throw error;}
  }
  async function work(action) {
    if (working) return;
    working = true; formState(); paint();
    try {await action();} catch (error) {message(errorMessage(error));}
    finally {working = false; formState(); paint();}
  }
  async function sendCode() {
    if (Date.now() < cooldown) throw new Error('请稍候 ' + Math.ceil((cooldown - Date.now()) / 1000) + ' 秒，再发送验证码。');
    const sdk = await boot();
    const email = el('accountEmail').value.trim(), password = el('accountPassword').value;
    if ((mode === 'register' || mode === 'reset') && (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))) throw new Error('请使用至少 8 位、含字母和数字的密码。');
    verifyCode = await sdk.send(mode, email, password);
    cooldown = Date.now() + 60000;
    clearInterval(interval); interval = setInterval(() => {formState(); if (Date.now() >= cooldown) clearInterval(interval);}, 1000);
    message('若邮箱可接收验证邮件，验证码会发送到该地址。请检查收件箱和垃圾邮件。');
    formState(); el('accountCode').focus();
  }
  el('accountForm').addEventListener('submit', event => {
    event.preventDefault();
    void work(async () => {
      const sdk = await boot();
      if (verifyCode) {
        const data = await verifyCode(el('accountCode').value.trim());
        if (!data?.session && !await sdk.session()) throw new Error('验证尚未完成，请重新登录。');
        await sessionChanged(data?.session || await sdk.session());
        message('已登录，本机进度仍保留。');
      } else if (mode === 'password') {
        const data = await sdk.password(el('accountEmail').value.trim(), el('accountPassword').value);
        await sessionChanged(data.session); message('已登录，本机进度仍保留。');
      } else await sendCode();
    });
  });
  for (const value of ['password','otp','register','reset']) el('auth' + value).onclick = () => selectMode(value);
  el('accountBack').onclick = () => selectMode(mode);
  el('accountResend').onclick = () => {if (Date.now() >= cooldown) void work(sendCode);};
  el('keepLocal').onclick = () => {void work(() => sync.choose('local'));};
  el('keepCloud').onclick = () => {void work(() => sync.choose('cloud'));};
  el('cloudRefresh').onclick = () => {void work(() => sync.refresh());};
  el('accountSignOut').onclick = () => {void work(async () => {
    const pending = sync.busy;
    activeUid = null; sync.disconnect();
    if (pending) await pending;
    try {await client.signOut();}
    catch (error) {await sessionChanged(await client.session()); throw error;}
    message('已退出。本机进度仍保留，其他人使用时可登录自己的账号。');
  });};
  function close(focus = true) {
    el('accountPanel').hidden = true;
    if (focus) el(atCamp() ? 'accountHome' : 'accountPause').focus();
  }
  function open() {
    beforeOpen(); el('accountPanel').hidden = false; paint(); formState();
    message(offline ? '离线版保留本机存档和迁移码。请打开在线游戏网址使用账号云存档。' : '本机进度会保留；只有登录后才会连接云端。');
    el('accountClose').focus();
    if (!offline) void work(boot);
  }
  el('accountHome').onclick = open; el('accountPause').onclick = open;
  el('accountClose').onclick = () => close();
  el('accountPanel').addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const nodes = [...el('accountPanel').querySelectorAll('button:not(:disabled),input,textarea,summary')].filter(node => node.getClientRects().length);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
  });
  window.addEventListener('online', () => {if (sync.user) void sync.refresh(); else if (sync.meta?.userId && !offline) void work(boot);});
  let lastCheck = 0;
  function checkAtCamp() {
    if (sync.user && atCamp() && !sync.busy && sync.phase !== 'choice' && (sync.phase === 'waiting' || Date.now() - lastCheck > 10000)) {
      lastCheck = Date.now(); void sync.refresh();
    }
  }
  window.addEventListener('focus', checkAtCamp);
  // No request for new guests; returning members recover their SDK session.
  if (sync.meta?.userId && !offline) void work(boot);
  paint(); formState();
  return {
    changed: () => sync.changed(), close,
    dispose: () => {clearInterval(interval); sync.disconnect();},
    camp: () => {checkAtCamp(); paint();},
    key(event) {
      if (el('accountPanel').hidden) return false;
      if (event.key === 'Escape') {event.preventDefault(); close();}
      return true;
    },
  };
}

import {validSave} from './core.mjs';

export const CLOUD_META_KEY = 'hillside-archers-cloud-v1';
export const CLOUD_BACKUP_KEY = 'hillside-archers-cloud-backups-v1';
export const saveText = progress => JSON.stringify(validSave(progress));

// Records can be combined. Currency and purchased levels must travel together.
export function reconcileCloudProgress(local, remote, choice) {
  const a = validSave(local), b = validSave(remote);
  const result = {...(choice === 'local' ? a : b), unlocked: a.unlocked || b.unlocked};
  for (const key of ['targetBest', 'checkpoint', 'best']) result[key] = Math.max(a[key], b[key]);
  return validSave(result);
}

export function cloudRecord(row) {
  if (!row) return {revision: 0, progress: null};
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1 || row.progress?.version !== 2 ||
      typeof row.progress.unlocked !== 'boolean' ||
      ['targetBest','checkpoint','best','embers','bow','life'].some(k => !Number.isSafeInteger(row.progress[k]))) {
    throw new Error('云端存档格式无法识别，已保留本机进度。');
  }
  return {...row, revision, progress: validSave(row.progress)};
}

export function progressSummary(progress) {
  if (!progress) return '尚无云存档';
  const p = validSave(progress);
  return (p.unlocked ? '全部模式已解锁' : '主线第 ' + p.checkpoint + ' 章') +
    ' · 远征 ' + p.best + ' 层 · 射靶 ' + p.targetBest + ' 分\n余烬 ' + p.embers +
    ' · 练弓 ' + p.bow + ' 级 · 强身 ' + p.life + ' 级';
}

export class CloudProgress {
  constructor({storage, getSave, applySave, atCamp, onState = () => {}, requestId = () => globalThis.crypto.randomUUID()}) {
    this.storage = storage; this.getSave = getSave; this.applySave = applySave;
    this.atCamp = atCamp; this.onState = onState; this.requestId = requestId;
    this.meta = this.readMeta(); this.epoch = 0; this.user = null; this.remote = null;
    this.ready = false; this.busy = null; this.timer = null; this.applying = false;
    this.phase = 'guest'; this.message = '本机游玩 · 登录后可同步永久进度';
  }
  readMeta() {
    try {return JSON.parse(this.storage?.getItem(CLOUD_META_KEY) || 'null');} catch {return null;}
  }
  storeMeta(meta) {
    // Fail closed rather than upload without a durable revision / retry record.
    if (!this.storage) throw new Error('浏览器无法保存同步记录，请先导出迁移码备份。');
    this.storage.setItem(CLOUD_META_KEY, JSON.stringify(meta)); this.meta = meta;
  }
  state(phase, message) {
    this.phase = phase; this.message = message;
    this.onState({phase, message, user: this.user, remote: this.remote, local: validSave(this.getSave())});
  }
  disconnect() {
    this.epoch++; this.user = null; this.backend = null; this.ready = false;
    this.busy = null; this.remote = null; clearTimeout(this.timer);
    this.state('guest', '已退出账号，本机进度仍保留。');
  }
  async connect(user, backend) {
    this.disconnect(); this.user = user; this.backend = backend;
    return this.refresh();
  }
  async refresh() {
    if (!this.user || this.busy) return this.busy;
    const epoch = this.epoch;
    this.state('syncing', '正在检查云端进度…');
    const task = (async () => {
      try {
        const remote = cloudRecord(await this.backend.read());
        if (epoch !== this.epoch) return;
        this.remote = remote;
        const meta = this.meta, sameAccount = meta?.userId === this.user.id;
        if (sameAccount && meta.pending) {
          this.ready = true;
          return; // Resume the exact request below, including its idempotency key.
        }
        if (sameAccount && remote.revision === meta.revision) {
          this.ready = true;
          if (saveText(this.getSave()) === saveText(remote.progress)) this.state('synced', '永久进度已同步');
          return;
        }
        if (sameAccount && saveText(this.getSave()) === saveText(meta.baseline) && remote.progress) {
          if (!this.atCamp()) {this.ready = false; this.state('waiting', '云端有新进度，回到旅营后更新。'); return;}
          this.accept(remote, remote.progress);
          return;
        }
        this.ready = false;
        this.state('choice', remote.progress ? '发现两份进度，请选择要保留的修行与余烬。纪录和解锁会合并。' : '此账号还没有云存档。确认后，将当前本机进度保存到账号。');
      } catch (error) {
        if (epoch === this.epoch) this.state('error', error.message || '暂时无法连接云端，本机进度仍保留。');
      }
    })();
    this.busy = task;
    await task;
    if (this.busy === task) this.busy = null;
    if (epoch === this.epoch && this.ready && this.phase !== 'error') return this.flush();
  }
  backup(progress) {
    if (!this.storage) throw new Error('浏览器无法备份本机进度，请先导出迁移码。');
    const backups = JSON.parse(this.storage.getItem(CLOUD_BACKUP_KEY) || '[]');
    const list = Array.isArray(backups) ? backups : [];
    list.unshift({userId: this.user.id, at: new Date().toISOString(), progress: validSave(progress)});
    this.storage.setItem(CLOUD_BACKUP_KEY, JSON.stringify(list.slice(0, 4)));
  }
  accept(remote, progress) {
    const before = this.getSave();
    if (saveText(before) !== saveText(progress)) this.backup(before);
    this.storeMeta({userId: this.user.id, revision: remote.revision, baseline: remote.progress, pending: null});
    this.ready = true;
    this.applying = true;
    try {if (saveText(before) !== saveText(progress)) this.applySave(validSave(progress));}
    finally {this.applying = false;}
    this.state('synced', '永久进度已同步');
  }
  async choose(choice) {
    if (this.phase !== 'choice' || !this.user || !this.remote || this.busy) return;
    if (!this.atCamp()) {this.state('choice', '请先回到旅营，再选择进度。'); return;}
    try {
      if (choice === 'cloud' && !this.remote.progress) return;
      const result = this.remote.progress ? reconcileCloudProgress(this.getSave(), this.remote.progress, choice) : validSave(this.getSave());
      this.accept(this.remote, result);
      return this.flush();
    } catch (error) {this.ready = false; this.state('error', error.message);}
  }
  changed() {
    if (!this.user || !this.ready || this.applying) return;
    clearTimeout(this.timer);
    if (!this.busy) this.state('pending', '本机已保存，准备同步…');
    this.timer = setTimeout(() => {void this.flush();}, 2000);
  }
  async flush() {
    if (!this.user || !this.ready || this.busy) return this.busy;
    const epoch = this.epoch;
    if (this.meta?.revision > 0 && !this.meta.pending && saveText(this.getSave()) === saveText(this.meta.baseline)) {
      this.state('synced', '永久进度已同步'); return;
    }
    this.state('syncing', '正在同步永久进度…');
    const task = (async () => {
      try {
        let pending = this.meta?.pending;
        if (!pending) {
          pending = {revision: this.meta.revision, progress: validSave(this.getSave()), requestId: this.requestId()};
          this.storeMeta({...this.meta, pending});
        }
        const result = await this.backend.write(pending.revision, pending.progress, pending.requestId);
        if (epoch !== this.epoch) return;
        if (result.status === 'conflict') {
          this.remote = result.revision ? cloudRecord(result) : {revision: 0, progress: null};
          this.storeMeta({...this.meta, pending: null}); this.ready = false;
          this.state('choice', '另一设备刚更新了进度。已停止上传，请回旅营选择要保留的修行与余烬。'); return;
        }
        if (result.status !== 'saved') throw new Error('未收到云端保存确认，本机进度仍保留。');
        const remote = cloudRecord(result);
        this.remote = remote;
        this.storeMeta({userId: this.user.id, revision: remote.revision, baseline: remote.progress, pending: null});
        this.state('synced', '永久进度已同步');
      } catch (error) {if (epoch === this.epoch) this.state('error', error.message || '同步失败，本机进度仍保留；联网后可重试。');}
    })();
    this.busy = task;
    await task;
    if (this.busy === task) this.busy = null;
    // Progress earned while a request was in flight belongs in a new revision.
    if (epoch === this.epoch && this.ready && this.phase === 'synced' && saveText(this.getSave()) !== saveText(this.meta.baseline)) return this.flush();
  }
}

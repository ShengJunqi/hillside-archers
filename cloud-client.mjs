// Online-only SDK is loaded once, on demand. The standalone offline game never
// loads it; a blocked cloud service cannot prevent the Canvas game from starting.
let cloudClientPromise;
export async function loadCloudClient() {
  if (cloudClientPromise) return cloudClientPromise;
  cloudClientPromise = (async () => {
    const response = await fetch('cloud-config.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('本站尚未配置云存档，请继续本机游玩或使用迁移码。');
    const config = await response.json();
    if (!config.enabled || !config.env || !config.accessKey) throw new Error('本站尚未配置云存档，请继续本机游玩或使用迁移码。');
    const {default: cloudbase} = await import('./vendor/cloudbase-3.11.0.mjs');
    const app = cloudbase.init({env: config.env, region: config.region, accessKey: config.accessKey, auth: {detectSessionInUrl: true}});
    return cloudClient(app);
  })();
  try {return await cloudClientPromise;} catch (error) {cloudClientPromise = null; throw error;}
}

export function cloudClient(app) {
  const auth = app.auth, db = app.rdb();
  const result = async promise => {const response = await promise; if (response.error) throw new Error(response.error.message); return response.data;};
  async function session() {
    const data = await result(auth.getSession());
    const value = data?.session;
    return value?.user?.id && !value.user.is_anonymous ? value : null;
  }
  async function requireUser(uid) {
    if ((await session())?.user.id !== uid) throw new Error('登录状态已变化，请重新登录；本机进度仍保留。');
  }
  return {
    auth, session,
    async password(identifier, password) {
      const account = identifier.trim();
      const credentials = account.includes('@') ? {email: account, password} : {username: account, password};
      const data = await result(auth.signInWithPassword(credentials));
      if (!data?.session) throw new Error('尚未获得登录会话，请重试。');
      return data;
    },
    async register(email, password, username) {
      // CloudBase requires verified email/phone for self-registration. The
      // chosen username is bound when the returned verification step completes.
      const data = await result(auth.signUp({email, password, username}));
      if (typeof data?.verifyOtp !== 'function') throw new Error('暂时无法验证邮件，请稍后重试。');
      return async code => result(data.verifyOtp({token: code}));
    },
    signOut: () => result(auth.signOut()),
    backend(uid) {
      return {
        async read() {
          await requireUser(uid);
          const rows = await result(db.from('archer_saves').select('revision,progress,updated_at').eq('owner_id', uid).limit(1));
          return rows?.[0] || null;
        },
        async write(revision, progress, requestId) {
          await requireUser(uid);
          return result(db.rpc('archer_save_for_account', {expected_owner: uid, expected_revision: revision, new_progress: progress, request_id: requestId}));
        },
      };
    },
  };
}

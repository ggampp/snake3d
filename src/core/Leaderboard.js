/**
 * Leaderboard with a pluggable async backend. Today it stores scores in
 * localStorage; to go online later, implement a provider with the same
 * { getTop, submit } shape (e.g. Supabase) and pass it to the constructor —
 * the rest of the game code does not change.
 *
 * Example Supabase provider (drop in when you have a project):
 *
 *   const supa = createSupabaseProvider(URL, ANON_KEY);
 *   const board = new Leaderboard(supa);
 *
 * See createSupabaseProvider() below for the exact table/columns expected.
 */
export class LocalProvider {
  constructor(key = 'snake3d.scores', max = 25) {
    this.key = key;
    this.max = max;
  }

  async getTop(limit = 10) {
    const list = this._read();
    return list.slice(0, limit);
  }

  async submit(name, score) {
    const list = this._read();
    list.push({ name: String(name || 'Anon').slice(0, 14), score: Math.round(score), at: Date.now() });
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, this.max);
    localStorage.setItem(this.key, JSON.stringify(trimmed));
    return trimmed.slice(0, 10);
  }

  _read() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '[]');
    } catch {
      return [];
    }
  }
}

/**
 * Reference implementation for an online backend. Not wired up by default.
 * Expects a Supabase table:
 *   create table scores (id bigint generated always as identity primary key,
 *     name text, score int, at timestamptz default now());
 * with row-level security policies allowing anon insert + select.
 */
export function createSupabaseProvider(url, anonKey) {
  const base = `${url.replace(/\/$/, '')}/rest/v1/scores`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  };
  return {
    async getTop(limit = 10) {
      const res = await fetch(`${base}?select=name,score,at&order=score.desc&limit=${limit}`, { headers });
      if (!res.ok) throw new Error(`leaderboard get ${res.status}`);
      return res.json();
    },
    async submit(name, score) {
      await fetch(base, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ name: String(name || 'Anon').slice(0, 14), score: Math.round(score) }),
      });
      return this.getTop(10);
    },
  };
}

export class Leaderboard {
  constructor(provider = new LocalProvider()) {
    this.provider = provider;
    this.online = !(provider instanceof LocalProvider);
  }

  async getTop(limit = 10) {
    try {
      return await this.provider.getTop(limit);
    } catch (e) {
      console.warn('leaderboard getTop failed:', e);
      return [];
    }
  }

  async submit(name, score) {
    try {
      return await this.provider.submit(name, score);
    } catch (e) {
      console.warn('leaderboard submit failed:', e);
      return [];
    }
  }
}

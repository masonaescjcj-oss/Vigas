/**
 * Leaderboard math: Bradley–Terry ratings from pairwise Arena votes, bootstrap confidence
 * intervals and the price/quality Pareto frontier.
 */

export type BattleOutcome = 'a' | 'b' | 'tie';

export interface Battle {
  a: string;
  b: string;
  outcome: BattleOutcome;
}

export interface Rating {
  model: string;
  rating: number;
  battles: number;
  /** (wins + ties/2) / battles × 100. */
  winRate: number;
}

export interface BradleyTerryOptions {
  /** Rating given to a model of average strength. Default 1400. */
  anchor?: number;
  /** Pseudo-games against an average opponent; keeps ratings finite for unbeaten models. */
  prior?: number;
  maxIterations?: number;
  tolerance?: number;
}

/** Deterministic PRNG (mulberry32) so bootstraps are reproducible. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fits Bradley–Terry strengths with the MM algorithm (Hunter, 2004). Ties count as half a win
 * for each side. Ratings use the Elo scale: +400 points means 10:1 odds of winning.
 */
export function bradleyTerry(battles: Battle[], opts: BradleyTerryOptions = {}): Rating[] {
  const anchor = opts.anchor ?? 1400;
  const prior = opts.prior ?? 1;
  const maxIterations = opts.maxIterations ?? 500;
  const tolerance = opts.tolerance ?? 1e-7;

  const names = [...new Set(battles.flatMap((x) => [x.a, x.b]))].sort();
  const idx = new Map(names.map((n, i) => [n, i]));
  const n = names.length;
  if (n === 0) return [];

  const wins = new Float64Array(n);
  const games = new Float64Array(n);
  const pair = new Map<number, number>(); // i*n+j (i<j) → games between i and j

  for (const x of battles) {
    if (x.a === x.b) continue;
    const i = idx.get(x.a)!;
    const j = idx.get(x.b)!;
    games[i]! += 1;
    games[j]! += 1;
    if (x.outcome === 'a') wins[i]! += 1;
    else if (x.outcome === 'b') wins[j]! += 1;
    else {
      wins[i]! += 0.5;
      wins[j]! += 0.5;
    }
    const k = i < j ? i * n + j : j * n + i;
    pair.set(k, (pair.get(k) ?? 0) + 1);
  }

  let p = new Float64Array(n).fill(1);
  for (let iter = 0; iter < maxIterations; iter++) {
    const denom = new Float64Array(n);
    for (const [k, count] of pair) {
      const i = Math.floor(k / n);
      const j = k % n;
      const s = count / (p[i]! + p[j]!);
      denom[i]! += s;
      denom[j]! += s;
    }
    const next = new Float64Array(n);
    let logSum = 0;
    for (let i = 0; i < n; i++) {
      // Prior: `prior` wins and `prior` losses against a fixed opponent of strength 1.
      const w = wins[i]! + prior;
      const d = denom[i]! + (2 * prior) / (p[i]! + 1);
      next[i] = w / d;
      logSum += Math.log(next[i]!);
    }
    const g = Math.exp(logSum / n);
    let maxChange = 0;
    for (let i = 0; i < n; i++) {
      next[i] = next[i]! / g;
      maxChange = Math.max(maxChange, Math.abs(next[i]! - p[i]!) / p[i]!);
    }
    p = next;
    if (maxChange < tolerance) break;
  }

  return names
    .map((model, i) => ({
      model,
      rating: anchor + 400 * Math.log10(p[i]!),
      battles: games[i]!,
      winRate: games[i]! > 0 ? (wins[i]! / games[i]!) * 100 : 0,
    }))
    .sort((x, y) => y.rating - x.rating);
}

export interface RatedWithInterval extends Rating {
  /** Half-width of the 95% bootstrap interval, in rating points. */
  ci: number;
}

/** Bradley–Terry ratings with 95% confidence half-widths from `rounds` bootstrap resamples. */
export function bradleyTerryWithIntervals(
  battles: Battle[],
  opts: BradleyTerryOptions & { rounds?: number; seed?: number } = {},
): RatedWithInterval[] {
  const base = bradleyTerry(battles, opts);
  const rounds = opts.rounds ?? 100;
  const rand = seededRandom(opts.seed ?? 42);
  const samples = new Map<string, number[]>(base.map((r) => [r.model, []]));
  for (let r = 0; r < rounds && battles.length > 0; r++) {
    const resample: Battle[] = [];
    for (let k = 0; k < battles.length; k++) resample.push(battles[Math.floor(rand() * battles.length)]!);
    for (const x of bradleyTerry(resample, { ...opts, maxIterations: 200 })) samples.get(x.model)?.push(x.rating);
  }
  return base.map((r) => {
    const s = (samples.get(r.model) ?? []).sort((x, y) => x - y);
    if (s.length < 2) return { ...r, ci: 0 };
    const lo = s[Math.floor(0.025 * (s.length - 1))]!;
    const hi = s[Math.ceil(0.975 * (s.length - 1))]!;
    return { ...r, ci: Math.max(0, (hi - lo) / 2) };
  });
}

export interface ParetoPoint {
  id: string;
  /** Lower is better, e.g. dollars per task. */
  cost: number;
  /** Higher is better, e.g. rating. */
  score: number;
}

/** Points no other point beats on both cost and score, ordered from cheapest to best. */
export function paretoFrontier<T extends ParetoPoint>(points: T[]): T[] {
  const sorted = [...points].sort((a, b) => a.cost - b.cost || b.score - a.score);
  const out: T[] = [];
  let best = -Infinity;
  for (const p of sorted) {
    if (p.score > best) {
      out.push(p);
      best = p.score;
    }
  }
  return out;
}

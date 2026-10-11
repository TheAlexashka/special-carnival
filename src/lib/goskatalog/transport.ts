import { request as undiciRequest, ProxyAgent } from "undici";

/**
 * Транспортный слой для Госкаталога.
 *
 * Факты, проверенные вживую:
 *  - goskatalog.ru закрыт для «чужих» IP: прямой запрос из песочницы, а также
 *    через allorigins и r.jina.ai — везде таймаут/обрыв;
 *  - российские IP пропускаются: 5 из 60 бесплатных российских прокси отдали
 *    живой JSON /muzfo-rest/rest/museums;
 *  - бесплатные прокси «одноразовые»: живут одну-две минуты, часть отвечает
 *    ECONNRESET, часть отклоняет CONNECT, часть виснет до 30 с.
 *
 * Отсюда архитектура:
 *  - свежий список российских прокси подтягивается в рантайме с открытого
 *    API geonode (сам geonode у нас доступен напрямую);
 *  - попытки идут ВОЛНОЙ параллельно (прямой запрос + до 6 прокси), побеждает
 *    первый допустимый ответ — так бюджет не сгорает на последовательных 30-секундных
 *    зависаниях, которые undici не отменяет по signal на фазе CONNECT;
 *  - на каждый запрос стоит жёсткий дедлайн через Promise.race;
 *  - успешный прокси помечается и идёт вперёд при следующих запросах,
 *    дважды «протухший» уходит в кулдаун;
 *  - если ни один путь не прошёл — вызывается ошибка, которую UI превращает
 *    в честное уведомление и рабочую ссылку на goskatalog.ru.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Два независимых открытых источника российских прокси — больше шансов на живые адреса. */
const PROXY_SOURCES = [
  // только прокси с поддержкой CONNECT/SSL — через них и tunnel'ится HTTPS до goskatalog
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=7000&country=RU&ssl=yes&anonymity=all",
  "https://proxylist.geonode.com/api/proxy-list?limit=200&page=1&sort_by=lastChecked&sort_type=desc&country=RU&protocols=http%2Chttps",
  "https://proxylist.geonode.com/api/proxy-list?limit=200&page=2&sort_by=lastChecked&sort_type=desc&country=RU&protocols=http%2Chttps",
];

const LIST_TTL_MS = 4 * 60_000;
const PROXY_FAIL_COOLDOWN_MS = 90_000;
/** Волна небольшая: меньше открытых сокетов = меньше нагрузка на процесс и на каталог. */
const WAVE_SIZE = 8;
const MAX_WAVES = 2;
const MAX_TOTAL_ATTEMPTS = 16;
/** Бюджет держим заметно меньше таймаутов внешнего прокси предпросмотра. */
const DEFAULT_BUDGET_MS = 16_000;
const ATTEMPT_TIMEOUT_MS = 6_000;
const WAVE_DEADLINE_MS = 7_000;
const WARMER_INTERVAL_MS = 180_000;
const WARMER_PROBE_COUNT = 4;
/** Сколько «подтверждённо живых» адресов достаточно, чтобы прогрев отдыхал. */
const WARMER_SKIP_IF_VERIFIED = 3;
const VERIFIED_TTL_MS = 10 * 60_000;

interface ProxyEntry {
  addr: string;
  fails: number;
  cooldownUntil: number;
  lastOkAt: number;
}

interface PoolState {
  proxies: Map<string, ProxyEntry>;
  listFetchedAt: number;
  refreshInflight: Promise<void> | null;
}

const globalRef = globalThis as typeof globalThis & { __gkPool?: PoolState };
const pool: PoolState = globalRef.__gkPool ?? {
  proxies: new Map(),
  listFetchedAt: 0,
  refreshInflight: null,
};
if (!globalRef.__gkPool) globalRef.__gkPool = pool;

export interface GkFetchResult {
  ok: boolean;
  status: number;
  body: Buffer;
  contentType: string;
  via: "direct" | "proxy";
}

function commonHeaders(): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json, text/plain, */*",
    Referer: "https://goskatalog.ru/portal/",
  };
}

async function refreshProxyList(force = false): Promise<void> {
  if (!force && pool.proxies.size > 0 && Date.now() - pool.listFetchedAt < LIST_TTL_MS) return;
  if (pool.refreshInflight) return pool.refreshInflight;

  pool.refreshInflight = (async () => {
    let addedTotal = 0;
    for (const source of PROXY_SOURCES) {
      try {
        const res = await fetch(source, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/plain" },
          signal: AbortSignal.timeout(7000),
        });
        if (!res.ok) continue;
        const text = await res.text();

        let addrs: string[] = [];
        if (source.includes("geonode")) {
          const data = JSON.parse(text) as { data?: Array<{ ip?: string; port?: number }> };
          addrs = (data.data || [])
            .filter((item) => Boolean(item?.ip) && Boolean(item?.port))
            .map((item) => `${item.ip}:${item.port}`);
        } else {
          // proxyscrape отдаёт список строкой "ip:port"
          addrs = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => /^\d{1,3}(\.\d{1,3}){3}:\d{2,5}$/.test(line));
        }

        for (const addr of addrs) {
          if (!pool.proxies.has(addr)) {
            pool.proxies.set(addr, { addr, fails: 0, cooldownUntil: 0, lastOkAt: 0 });
            addedTotal += 1;
          }
        }
      } catch {
        // источник недоступен — берём данные из другого
      }
    }
    if (addedTotal > 0) pool.listFetchedAt = Date.now();
  })();

  return pool.refreshInflight;
}

function candidateProxies(limit: number): ProxyEntry[] {
  const now = Date.now();
  return [...pool.proxies.values()]
    .filter((p) => p.cooldownUntil <= now)
    .sort((a, b) => {
      if (a.lastOkAt !== b.lastOkAt) return b.lastOkAt - a.lastOkAt;
      return a.fails - b.fails;
    })
    .slice(0, limit);
}

function markFailure(entry: ProxyEntry) {
  entry.fails += 1;
  if (entry.fails >= 2) {
    entry.cooldownUntil = Date.now() + PROXY_FAIL_COOLDOWN_MS;
    entry.fails = 0;
  }
}

function markSuccess(entry: ProxyEntry) {
  entry.fails = 0;
  entry.cooldownUntil = 0;
  entry.lastOkAt = Date.now();
}

function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: дедлайн ${ms}мс`)), ms);
    (timer as unknown as { unref?: () => void }).unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function attemptDirect(url: string, timeoutMs: number): Promise<GkFetchResult> {
  const res = await fetch(url, {
    headers: commonHeaders(),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = Buffer.from(await res.arrayBuffer());
  return {
    ok: res.ok,
    status: res.status,
    body,
    contentType: res.headers.get("content-type") || "",
    via: "direct",
  };
}

async function attemptProxy(entry: ProxyEntry, url: string, timeoutMs: number): Promise<GkFetchResult> {
  const dispatcher = new ProxyAgent(`http://${entry.addr}`);
  try {
    const res = await undiciRequest(url, {
      dispatcher,
      method: "GET",
      headers: commonHeaders(),
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });
    const body = Buffer.from(await res.body.arrayBuffer());
    return {
      ok: res.statusCode >= 200 && res.statusCode < 400,
      status: res.statusCode,
      body,
      contentType: String(res.headers["content-type"] || ""),
      via: "proxy",
    };
  } finally {
    dispatcher.close().catch(() => undefined);
  }
}

interface WaveJob {
  label: string;
  run: () => Promise<GkFetchResult>;
}

/** Волна попыток: все параллельно, побеждает первый допустимый ответ. */
async function runWave(
  jobs: WaveJob[],
  perAttemptMs: number,
  accept: (status: number) => boolean,
  errors: string[]
): Promise<GkFetchResult | null> {
  let winner: GkFetchResult | null = null;

  await Promise.all(
    jobs.map(async (job) => {
      try {
        const result = await withDeadline(job.run(), perAttemptMs, job.label);
        if (winner) return;
        if (accept(result.status)) {
          winner = result;
        } else {
          errors.push(`${job.label}: HTTP ${result.status}`);
        }
      } catch (err: unknown) {
        errors.push(`${job.label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  return winner;
}

export async function gkFetch(
  url: string,
  options: {
    budgetMs?: number;
    acceptStatus?: (status: number) => boolean;
    /** Пропустить прямой запрос (бесполезен, если хостинг точно не в РФ). */
    skipDirect?: boolean;
  } = {}
): Promise<GkFetchResult> {
  const deadline = Date.now() + (options.budgetMs ?? DEFAULT_BUDGET_MS);
  const remaining = () => Math.max(1500, deadline - Date.now());
  const accept = options.acceptStatus ?? ((s: number) => s >= 200 && s < 300);
  const errors: string[] = [];

  await refreshProxyList();
  ensureWarmer();

  const tried = new Set<string>();
  let totalAttempts = 0;

  for (let waveIndex = 0; waveIndex < MAX_WAVES; waveIndex += 1) {
    if (Date.now() >= deadline || totalAttempts >= MAX_TOTAL_ATTEMPTS) break;

    if (waveIndex > 0) await refreshProxyList(true);

    const batch = candidateProxies(WAVE_SIZE * 3)
      .filter((entry) => !tried.has(entry.addr))
      .slice(0, WAVE_SIZE);
    if (!batch.length) break;
    batch.forEach((entry) => tried.add(entry.addr));
    totalAttempts += batch.length + (waveIndex === 0 ? 1 : 0);

    const jobs: WaveJob[] = [
      ...(waveIndex === 0 && !options.skipDirect
        ? [{ label: "direct", run: () => attemptDirect(url, 4000) }]
        : []),
      ...batch.map((entry) => ({
        label: `proxy ${entry.addr}`,
        run: async () => {
          try {
            const result = await attemptProxy(entry, url, Math.min(ATTEMPT_TIMEOUT_MS, remaining()));
            if (accept(result.status)) markSuccess(entry);
            else markFailure(entry);
            return result;
          } catch (err) {
            markFailure(entry);
            throw err;
          }
        },
      })),
    ];

    const result = await runWave(jobs, Math.min(WAVE_DEADLINE_MS, remaining()), accept, errors);
    if (result) return result;
  }

  throw new Error(errors.join(" | ") || "все пути к Госкаталогу недоступны");
}

/** Диагностика для UI: сколько кандидатов сейчас в пуле. */
export function proxyPoolStats(): { total: number; healthy: number; verified: number } {
  const now = Date.now();
  const all = [...pool.proxies.values()];
  return {
    total: all.length,
    healthy: all.filter((p) => p.cooldownUntil <= now).length,
    verified: all.filter((p) => p.cooldownUntil <= now && now - p.lastOkAt < VERIFIED_TTL_MS && p.lastOkAt > 0)
      .length,
  };
}

/**
 * Есть ли подтверждённо живой путь до Госкаталога.
 * Используется, чтобы не заставлять пользователя ждать 20+ секунд там,
 * где можно мгновенно отдать запасной вариант.
 */
export function hasVerifiedRoute(): boolean {
  return proxyPoolStats().verified > 0;
}

const PROBE_URL = "https://goskatalog.ru/muzfo-rest/rest/museums?limit=1";

/**
 * Фоновый «прогрев»: пока пользователи не ищут, пул тихо проверяет по 5 адресов
 * каждые ~100 секунд, чтобы к моменту настоящего запроса уже были подтверждённо
 * живые российские прокси (сортировка кладёт успешные в начало списка).
 */
async function warmOnce(): Promise<void> {
  // Если живые адреса уже есть — не нагружаем ни каталог, ни бесплатные прокси.
  if (proxyPoolStats().verified >= WARMER_SKIP_IF_VERIFIED) return;
  const candidates = candidateProxies(WARMER_PROBE_COUNT);
  if (!candidates.length) return;
  await Promise.all(
    candidates.map(async (entry) => {
      try {
        const result = await withDeadline(attemptProxy(entry, PROBE_URL, 7000), 9000, `warm ${entry.addr}`);
        if (result.status === 200) markSuccess(entry);
        else markFailure(entry);
      } catch {
        markFailure(entry);
      }
    })
  );
}

function ensureWarmer(): void {
  const globalWarm = globalThis as typeof globalThis & { __gkWarmer?: boolean };
  if (globalWarm.__gkWarmer) return;
  globalWarm.__gkWarmer = true;

  const tick = () => {
    void (async () => {
      try {
        await refreshProxyList();
        await warmOnce();
      } catch {
        // прогрев best-effort
      }
    })();
  };

  const timer = setInterval(tick, WARMER_INTERVAL_MS);
  (timer as unknown as { unref?: () => void }).unref?.();
  // первый прогрев сразу после старта
  const initial = setTimeout(tick, 3000);
  (initial as unknown as { unref?: () => void }).unref?.();
}

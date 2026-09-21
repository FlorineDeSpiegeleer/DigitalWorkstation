/**
 * Kleine beschermlaag rond de publieke ntfy.sh-demo service.
 *
 * Doel:
 * - dubbele berichten vermijden;
 * - statusberichten begrenzen zodat snelle schermwissels geen burst aan
 *   POST-verzoeken veroorzaken;
 * - bij HTTP 429 tijdelijk stoppen met opnieuw posten in plaats van de
 *   rate limit nog verder te belasten.
 *
 * Dit blijft een prototype-oplossing. Voor productie is een eigen,
 * beveiligde backend aangewezen.
 */

type PostOptions = {
  /** Unieke sleutel voor throttling/deduplicatie binnen deze browser. */
  key?: string;
  /** Minimumtijd tussen twee effectieve POSTs voor dezelfde sleutel. */
  minIntervalMs?: number;
  /** Identieke payloads binnen deze periode worden genegeerd. */
  dedupeMs?: number;
};

type PendingPost = {
  topic: string;
  payload: unknown;
  options: PostOptions;
};

const lastSentAt = new Map<string, number>();
const lastFingerprint = new Map<string, { value: string; at: number }>();
const cooldownUntil = new Map<string, number>();
let globalCooldownUntil = 0;
const pendingPosts = new Map<string, PendingPost>();
const pendingTimers = new Map<string, number>();

const fingerprintPayload = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return JSON.stringify(payload);
  }

  // Timestamps verschillen bij elk bericht en mogen deduplicatie niet
  // onmogelijk maken. Alle inhoudelijke velden blijven wel deel van de key.
  const copy = { ...(payload as Record<string, unknown>) };
  delete copy.timestamp;
  return JSON.stringify(copy);
};

const parseRetryAfterMs = (response: Response): number => {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }

  // Veilige fallback voor de publieke demo-service.
  return 15000;
};

const sendNow = async (
  topic: string,
  payload: unknown,
  options: PostOptions
): Promise<boolean> => {
  const key = options.key ?? topic;
  const now = Date.now();

  if (globalCooldownUntil > now || (cooldownUntil.get(key) ?? 0) > now) {
    return false;
  }

  try {
    const response = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      const waitMs = parseRetryAfterMs(response);
      const until = Date.now() + waitMs;
      cooldownUntil.set(key, until);
      globalCooldownUntil = Math.max(globalCooldownUntil, until);
      console.warn(
        `[ntfy] Rate limit bereikt voor ${topic}. Nieuwe posts voor deze bron worden tijdelijk gepauzeerd.`
      );
      return false;
    }

    if (!response.ok) {
      console.warn(`[ntfy] POST naar ${topic} mislukt met status ${response.status}.`);
      return false;
    }

    const sentAt = Date.now();
    lastSentAt.set(key, sentAt);
    lastFingerprint.set(key, {
      value: fingerprintPayload(payload),
      at: sentAt,
    });
    return true;
  } catch {
    // Netwerkfouten mogen de lokale workflow niet blokkeren.
    return false;
  }
};

export const postNtfyJson = async (
  topic: string,
  payload: unknown,
  options: PostOptions = {}
): Promise<boolean> => {
  const key = options.key ?? topic;
  const now = Date.now();
  const fingerprint = fingerprintPayload(payload);
  const previous = lastFingerprint.get(key);
  const dedupeMs = options.dedupeMs ?? 2500;

  if (
    previous &&
    previous.value === fingerprint &&
    now - previous.at < dedupeMs
  ) {
    return true;
  }

  const minIntervalMs = options.minIntervalMs ?? 0;
  const elapsed = now - (lastSentAt.get(key) ?? 0);

  if (minIntervalMs > 0 && elapsed < minIntervalMs) {
    // Bewaar alleen de LAATSTE status. Zo sturen snelle schermwissels geen
    // reeks verouderde statussen meer na elkaar door.
    pendingPosts.set(key, { topic, payload, options });

    if (!pendingTimers.has(key)) {
      const delay = Math.max(0, minIntervalMs - elapsed);
      const timer = window.setTimeout(async () => {
        pendingTimers.delete(key);
        const pending = pendingPosts.get(key);
        pendingPosts.delete(key);
        if (pending) {
          await sendNow(pending.topic, pending.payload, pending.options);
        }
      }, delay);
      pendingTimers.set(key, timer);
    }

    return true;
  }

  // Een nieuwe onmiddellijke status maakt een eventueel oudere, geplande
  // status overbodig.
  const timer = pendingTimers.get(key);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    pendingTimers.delete(key);
    pendingPosts.delete(key);
  }

  return sendNow(topic, payload, options);
};

/** Maximum selected passage admitted by the client, measured as UTF-8 bytes. */
export const MAX_SELECTION_BYTES = 16 * 1024;
/**
 * Sentinel `atSeq` asking the Host for the newest committed parent context
 * instead of a completed-turn boundary.
 *
 * It is a wire-compatible non-negative safe integer, so the existing strict
 * Typert codec (`atSeq: z.number().int().nonnegative()`) accepts it without a
 * protocol change. The Host special-cases this exact value before matching it
 * against real event sequence numbers (real sequences never reach it).
 */
export const LATEST_AT_SEQ = Number.MAX_SAFE_INTEGER;

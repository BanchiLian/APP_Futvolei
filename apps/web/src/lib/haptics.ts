/** A short buzz to confirm an action, where the device supports it (not iOS Safari). */
export function tapFeedback(durationMs = 10): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(durationMs);
  }
}

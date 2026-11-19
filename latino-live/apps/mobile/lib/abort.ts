/**
 * A timeout signal that works on every phone. Older Android runtimes do not
 * have AbortSignal.timeout, and calling it blindly would stop the app.
 */
export function timeoutSignal(ms: number): AbortSignal | undefined {
  const signal = (AbortSignal as unknown as { timeout?: (value: number) => AbortSignal }).timeout;
  if (typeof signal === 'function') {
    try {
      return signal(ms);
    } catch {
      // Fall through to a plain controller below.
    }
  }
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  } catch {
    return undefined;
  }
}

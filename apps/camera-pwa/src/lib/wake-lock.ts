export async function requestScreenWakeLock(): Promise<WakeLockSentinel | null> {
  if (!navigator.wakeLock) {
    return null;
  }

  return navigator.wakeLock.request('screen');
}

export function normalizeCycleSyncSettings(value) {
  return {
    cloudSyncConsent: value?.cloudSyncConsent === true,
  };
}

export function canSyncCycleLogs(signedIn, settings) {
  return Boolean(signedIn && normalizeCycleSyncSettings(settings).cloudSyncConsent);
}

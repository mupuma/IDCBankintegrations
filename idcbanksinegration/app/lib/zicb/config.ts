export function h2hEnabled() { return process.env.ZICB_H2H_ENABLED === 'true'; }

export function sourceProfile(sourceBank: string) {
  // No default region or debit account: these mappings must be agreed with ZICB.
  const profiles = JSON.parse(process.env.ZICB_H2H_SOURCE_PROFILES || '{}');
  const profile = profiles[sourceBank.toUpperCase()];
  if (!profile || typeof profile.regionCode !== 'string' || !profile.regionCode.trim() || !profile.profileId || !profile.currency) {
    throw new Error('ZICB H2H source account profile, region code and currency must be configured');
  }
  if (!Number.isInteger(profile.amountScale) || profile.amountScale < 0 || profile.amountScale > 6) throw new Error('Configure the bank-approved amountScale for the source profile');
  return profile as { profileId: string; regionCode: string; currency: string; amountScale: number; cashbookAccount?: string; channels?: string[] };
}

export function reconcileDelay() {
  // This is an operational default, not a claim that the PDF establishes a rate limit.
  const value = Number(process.env.ZICB_H2H_RECONCILE_MS || 7200000);
  return Number.isFinite(value) && value >= 60000 ? value : 7200000;
}

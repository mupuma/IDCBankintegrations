export function h2hEnabled() { return process.env.ZICB_H2H_ENABLED === 'true'; }

function defaultSourceProfile() {
  const profileId = process.env.ZICB_H2H_PROFILE_ID?.trim();
  const regionCode = process.env.ZICB_H2H_REGION_CODE?.trim();
  const currency = process.env.ZICB_H2H_CURRENCY?.trim();
  const amountScaleRaw = process.env.ZICB_H2H_AMOUNT_SCALE;
  if (!profileId && !regionCode && !currency && amountScaleRaw === undefined) return null;

  return {
    profileId,
    regionCode,
    currency,
    amountScale: Number(amountScaleRaw ?? 2),
    cashbookAccount: process.env.ZICB_H2H_CASHBOOK_ACCOUNT?.trim() || undefined,
    channels: (process.env.ZICB_H2H_CHANNELS || 'RTGS,DDACC,INTERNAL')
      .split(',')
      .map((channel) => channel.trim().toUpperCase())
      .filter(Boolean),
  };
}

export function sourceProfile(sourceBank: string) {
  // No default region or debit account: these mappings must be agreed with ZICB.
  const profiles = JSON.parse(process.env.ZICB_H2H_SOURCE_PROFILES || '{}');
  const sourceBankKey = sourceBank.toUpperCase();
  const profile = profiles[sourceBankKey] || profiles.DEFAULT || defaultSourceProfile();
  if (!profile || typeof profile.regionCode !== 'string' || !profile.regionCode.trim() || !profile.profileId || !profile.currency) {
    throw new Error(`ZICB H2H source profile is missing for source account "${sourceBankKey}". Configure ZICB_H2H_SOURCE_PROFILES or the single-bank ZICB_H2H_PROFILE_ID, ZICB_H2H_REGION_CODE and ZICB_H2H_CURRENCY settings.`);
  }
  if (!Number.isInteger(profile.amountScale) || profile.amountScale < 0 || profile.amountScale > 6) throw new Error('Configure the bank-approved amountScale for the source profile');
  return profile as { profileId: string; regionCode: string; currency: string; amountScale: number; cashbookAccount?: string; channels?: string[] };
}

export function reconcileDelay() {
  // This is an operational default, not a claim that the PDF establishes a rate limit.
  const value = Number(process.env.ZICB_H2H_RECONCILE_MS || 7200000);
  return Number.isFinite(value) && value >= 60000 ? value : 7200000;
}

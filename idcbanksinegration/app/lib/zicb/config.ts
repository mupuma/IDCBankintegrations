export function sourceProfile(sourceBank: string) {
  // No default region or debit account: these mappings must be agreed with ZICB.
  let profiles;
  try {
    profiles = JSON.parse(process.env.ZICB_H2H_SOURCE_PROFILES || '{}');
  } catch {
    // Never echo configuration contents or raw parser excerpts into responses/logs.
    throw new Error('Invalid JSON in portal ZICB_H2H_SOURCE_PROFILES. Use a JSON object with double-quoted property names, a colon after each name and no trailing commas. Correct the portal environment setting and restart the portal.');
  }
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    throw new Error('Portal ZICB_H2H_SOURCE_PROFILES must be a JSON object keyed by source account code. Correct the portal environment setting and restart the portal.');
  }
  const profile = profiles[sourceBank.toUpperCase()];
  if (!profile || typeof profile.regionCode !== 'string' || !profile.regionCode.trim() || !profile.profileId || !profile.currency) {
    throw new Error(`ZICB H2H is not configured for source account ${sourceBank.toUpperCase()}. Configure its bank-approved profile ID, region code and currency in ZICB_H2H_SOURCE_PROFILES.`);
  }
  if (!Number.isInteger(profile.amountScale) || profile.amountScale < 0 || profile.amountScale > 6) throw new Error('Configure the bank-approved amountScale for the source profile');
  return profile as { profileId: string; regionCode: string; currency: string; amountScale: number; cashbookAccount?: string; channels?: string[] };
}

export function reconcileDelay() {
  // This is an operational default, not a claim that the PDF establishes a rate limit.
  const value = Number(process.env.ZICB_H2H_RECONCILE_MS || 60000);
  return Number.isFinite(value) && value >= 60000 ? value : 60000;
}

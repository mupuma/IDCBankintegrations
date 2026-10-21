// Optional for domestic beneficiaries; required by the payment validator when
// SWIFT is selected. Keep codes as strings to preserve leading zeroes.
export function validateVendorSwiftDetails(body: Record<string, unknown>): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ['Vendor details must be an object'];
  return (['tpin', 'purposeCode', 'sectorCode'] as const).flatMap(field => {
    const value = body[field];
    if (value === undefined || value === null) return [];
    const limit = field === 'tpin' ? 20 : 8;
    if (typeof value !== 'string' || value.trim().length > limit) return [`${field} must be text containing at most ${limit} characters`];
    return [];
  });
}

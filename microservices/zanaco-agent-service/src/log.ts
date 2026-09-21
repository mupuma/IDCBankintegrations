function maskValue(value: unknown) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (!text) return undefined;
  if (text.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
}

function cleanDetails(details: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (/account|acc/i.test(key)) {
      output[key] = maskValue(value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

export function logEvent(event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    app: 'zanaco-agent',
    event,
    ...cleanDetails(details),
  }));
}

export function logError(event: string, details: Record<string, unknown> = {}) {
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    app: 'zanaco-agent',
    level: 'error',
    event,
    ...cleanDetails(details),
  }));
}

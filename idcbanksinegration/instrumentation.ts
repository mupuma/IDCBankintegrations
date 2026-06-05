export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  // Skip during `next build` — DB may not be available in CI/build environments
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }

  const { connectDatabase } = await import('./app/lib/db');
  await connectDatabase();
}

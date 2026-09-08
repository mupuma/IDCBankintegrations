export async function register() {
  // Skip during `next build` — DB may not be available in CI/build environments
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }

  // Keep the import itself inside a positive runtime guard so the Edge
  // compilation can eliminate Node-only database dependencies.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { connectDatabase } = await import('./app/lib/db');
    await connectDatabase();
  }
}

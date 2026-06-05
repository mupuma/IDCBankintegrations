const APP_API_URL = process.env.APP_API_URL?.replace(/\/$/, '');

export async function notifyAppOfQueueResult(queueId: string, result: any) {
  if (!APP_API_URL) return;
  try {
    await fetch(`${APP_API_URL}/api/v1/posted_payments/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId, result }),
    });
  } catch (err) {
    console.warn('Failed to notify app of queue result', err);
  }
}

export default { notifyAppOfQueueResult };

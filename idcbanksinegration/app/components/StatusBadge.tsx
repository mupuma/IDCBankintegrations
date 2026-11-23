type Tone = 'green' | 'red' | 'amber' | 'blue' | 'orange' | 'slate';

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  paid: { label: 'Paid', tone: 'green' },
  success: { label: 'Success', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  rejected: { label: 'Rejected', tone: 'red' },
  unknown: { label: 'Unknown', tone: 'amber' },
  submitting: { label: 'Submitting', tone: 'amber' },
  accepted: { label: 'Accepted', tone: 'blue' },
  queued: { label: 'Queued', tone: 'blue' },
  pulled: { label: 'Pulled', tone: 'blue' },
  processing: { label: 'Processing', tone: 'blue' },
  needs_review: { label: 'Needs review', tone: 'orange' },
  partially_completed: { label: 'Partially completed', tone: 'amber' },
};

const TONE_CLASSES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  red: 'bg-rose-50 text-rose-800 ring-rose-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  blue: 'bg-blue-50 text-blue-800 ring-blue-200',
  orange: 'bg-orange-50 text-orange-800 ring-orange-300',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function statusLabel(status: string | null | undefined): string {
  const key = String(status ?? '').trim();
  if (!key) return 'Unknown';
  const known = STATUS_META[key.toLowerCase()];
  if (known) return known.label;
  const spaced = key.replace(/[_-]+/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function statusTone(status: string | null | undefined): Tone {
  return STATUS_META[String(status ?? '').trim().toLowerCase()]?.tone ?? 'slate';
}

export default function StatusBadge({ status, className = '' }: { status: string | null | undefined; className?: string }) {
  return (
    <span
      title={String(status ?? '')}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASSES[statusTone(status)]} ${className}`}
    >
      {statusLabel(status)}
    </span>
  );
}

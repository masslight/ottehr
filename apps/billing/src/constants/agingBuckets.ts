// Shared AR aging buckets with severity colors used across queue views.
export interface AgingBucketDef {
  label: string;
  minDays: number;
  maxDays: number | null;
  color: string;
}

export const AGING_BUCKET_DEFS: AgingBucketDef[] = [
  { label: '0–30', minDays: 0, maxDays: 30, color: '#2e7d32' },
  { label: '30–60', minDays: 30, maxDays: 60, color: '#0288d1' },
  { label: '60–90', minDays: 60, maxDays: 90, color: '#ed6c02' },
  { label: '90–120', minDays: 90, maxDays: 120, color: '#d32f2f' },
  { label: '120–150', minDays: 120, maxDays: 150, color: '#8e24aa' },
  { label: '150+', minDays: 150, maxDays: null, color: '#5d4037' },
];

// Demo "today" matching the generated fake data.
const AS_OF = new Date(2026, 7, 23);

export function agingBucketForDate(mmddyyyy: string): AgingBucketDef {
  const [month, day, year] = mmddyyyy.split('/').map(Number);
  const days = Math.floor((AS_OF.getTime() - new Date(year, month - 1, day).getTime()) / 86_400_000);
  return AGING_BUCKET_DEFS.find((bucket) => bucket.maxDays === null || days < bucket.maxDays) ?? AGING_BUCKET_DEFS[AGING_BUCKET_DEFS.length - 1];
}

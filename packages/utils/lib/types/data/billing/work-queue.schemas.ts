import { z } from 'zod';
import { ClaimsListFiltersSchema, ClaimsListLayoutSchema } from './claims-list-view.schemas';

// A work queue is a saved, shareable view of the claims list (see ./claims-list-view.schemas.ts):
// the filters that pick its claims, the grid layout to show them in, and the biller who owns it.
// Working a claim (e.g. moving its status on) takes it out of the queue's filters, so the queue
// drains as the work gets done.

export const WORK_QUEUE_NAME_MAX_LENGTH = 100;
// Kept short so the description fits on one line of the work queues list on most screens.
export const WORK_QUEUE_DESCRIPTION_MAX_LENGTH = 200;

const nonEmptyString = z.string().trim().min(1);

// The owner is a billing user, identified by their Practitioner profile.
export const WorkQueueOwnerSchema = z.object({
  practitionerId: nonEmptyString,
  name: z.string(),
});

export const WorkQueueSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString.max(WORK_QUEUE_NAME_MAX_LENGTH),
  description: z.string().trim().max(WORK_QUEUE_DESCRIPTION_MAX_LENGTH).optional(),
  owner: WorkQueueOwnerSchema.optional(),
  filters: ClaimsListFiltersSchema,
  layout: ClaimsListLayoutSchema,
});

// Zambda inputs name the queue `queueId`: the SDK's zambda call takes `id` for the zambda itself.
export const GetBillingWorkQueueInputSchema = z.object({ queueId: nonEmptyString });

// Creates a queue when `queueId` is missing, otherwise replaces the queue with that id.
export const SaveBillingWorkQueueInputSchema = WorkQueueSchema.omit({ id: true }).extend({
  queueId: nonEmptyString.optional(),
  // null clears the owner.
  owner: WorkQueueOwnerSchema.nullable().optional(),
  filters: ClaimsListFiltersSchema.default({}),
  layout: ClaimsListLayoutSchema.default({}),
});

export type WorkQueueOwner = z.output<typeof WorkQueueOwnerSchema>;
export type WorkQueue = z.output<typeof WorkQueueSchema>;
export type GetBillingWorkQueueInput = z.output<typeof GetBillingWorkQueueInputSchema>;
export type SaveBillingWorkQueueInput = z.output<typeof SaveBillingWorkQueueInputSchema>;

export interface WorkQueueSummary extends WorkQueue {
  // How many claims the queue's filters currently match, and their total billed amount. Null when
  // they couldn't be worked out (e.g. a filter names a payer that no longer exists).
  claimCount: number | null;
  charged: number | null;
  // True when the queue matched more claims than could be counted, so both figures are lower bounds.
  incomplete: boolean;
}

export interface GetBillingWorkQueuesResponse {
  queues: WorkQueueSummary[];
}

export interface BillingWorkQueueResponse {
  queue: WorkQueue;
}

export interface SearchBillingWorkQueueOwnersResponse {
  owners: WorkQueueOwner[];
}

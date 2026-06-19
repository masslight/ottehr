# Scheduled Outreach Task Architecture

## Overview

The scheduled outreach system automates actions (notifications, card charges, collections referrals) triggered by billing and clinical events. Configuration lives in a FHIR PlanDefinition; execution is driven by FHIR Tasks.

## Lifecycle

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Producers  │──────▶│  FHIR Tasks  │──────▶│   Cron Promoter  │──────▶│    Executors     │
│  (event/cron)│       │  (draft)     │       │   (every 15 min) │       │  (subscriptions) │
└──────────────┘       └──────────────┘       └──────────────────┘       └──────────────────┘
```

### Task Status Flow

```
draft  ──(cron: due + windows pass)──▶  requested  ──(executor picks up)──▶  in-progress  ──▶  completed / failed
```

## Components

### 1. Producers (Create Draft Tasks)

Producers read the PlanDefinition, filter actions matching their trigger event, and create one `draft` Task per matching action with `executionPeriod.start` calculated from event time + offset.

| Trigger Event | Producer Type | Trigger Mechanism |
|---|---|---|
| `discharge-time` | Event-driven | Fires when encounter is completed |
| `invoice-issued` | Inline | Called from "Create Invoice" action |
| `invoice-due` | Daily cron | Queries Stripe for past-due invoices |
| `patient-birthday` | Daily cron | Scans upcoming patient birthdays |
| `date-of-visit` | Event-driven | Piggybacks on discharge or standalone |

All producers call a **shared `produceOutreachTasks()` function** that handles:
- Reading the PlanDefinition
- Filtering actions by trigger event
- Checking for existing tasks (idempotency)
- Calculating due datetime (`eventTimestamp + offset`)
- Creating draft Tasks with appropriate references and input data

### 2. Cron Promoter (Draft → Requested)

Runs every 15 minutes. Responsibilities:
- Query: `Task?status=draft&execution-period=le{now}`
- **Check SMS time window** (from PlanDefinition extension): if any medium on the task is SMS and the current time is outside the allowed window, skip promotion
- Future: additional window checks (e.g., no mail on weekends)
- Promote eligible tasks: set `Task.status = requested`

The cron is purely a time-gate and window-checker. It never executes actions.

### 3. Executors (Subscription Zambdas)

One subscription zambda per action type, filtered on `Task.code` + status change to `requested`.

| Executor | Behavior |
|---|---|
| `send-notification` | Dispatches to SMS, email, and/or paper-mail inline based on task input |
| `charge-card` | Charges card on file, then sends success/failure notifications inline (multiple channels) |
| `refer-to-collections` | Placeholder — will call collections agency API |

Executors:
1. Immediately set `Task.status = in-progress`
2. Execute the action (inline, no child tasks)
3. Set `Task.status = completed` or `failed`

## Task Structure (FHIR)

```
Task:
  status: draft | requested | in-progress | completed | failed
  code: { coding: [{ system: outreach-action-type, code: "send-notification" | "charge-card" | "refer-to-collections" }] }
  basedOn: Reference(PlanDefinition)       # link to the outreach config
  for: Reference(Patient)
  focus: Reference(Invoice | Encounter)    # the triggering resource
  executionPeriod.start: dateTime          # when task becomes due
  input:
    - actionId: string                     # ID of the action within PlanDefinition
    - triggerEvent: string                 # e.g. "discharge-time"
    - mediums: string[]                    # ["sms", "email", "paper-mail"]
    - smsTemplate: string                  # base64-encoded template
    - emailTemplate: string                # base64-encoded template
    - chargeCardConfig: { retryAttempts, retryIntervalDays, onSuccess, onFailure }
    - referToCollectionsConfig: { agency, minimumBalance, includePaymentHistory }
```

## SMS Time Window

Stored as an extension on the PlanDefinition:
- `enabled`: boolean
- `window-start`: HH:mm (e.g., "09:00")
- `window-end`: HH:mm (e.g., "21:00")
- `timezone`: string (e.g., "America/New_York")

The **cron promoter** checks this window before promoting any task that includes SMS as a medium. Tasks blocked by the window remain in `draft` and are re-evaluated on the next cron pass.

## Idempotency

Producers check for existing tasks before creating new ones:
- Query: `Task?focus={resource}&code={actionType}&_tag={actionId}&status=draft,requested,in-progress`
- If a matching task exists, skip creation

## Key Design Decisions

1. **Inline execution** — Executors handle all sub-steps (e.g., charge card + send 3 notifications) within a single task. No child tasks for individual channels.
2. **Cron as time-gate only** — Cron never executes actions; it just promotes when timing and windows allow. This keeps scheduling logic centralized.
3. **Subscription per action type** — Each executor is a separate zambda, enabling different code paths and independent deployments.
4. **Reference to PlanDefinition + snapshot in Task.input** — Task stores enough data to execute independently, but also references the PlanDefinition for auditability.
5. **Latency tolerance** — This is a background system; 15-minute cron granularity + subscription propagation delay is acceptable.

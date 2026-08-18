# Easy Chart rebuild — kickoff brief

Paste this (or point at this file) at the start of the new session.

---

You are implementing a feature called **Easy Chart** in this repository, from scratch, on a new branch.
A previous implementation existed and was studied; you do **not** have its code, but you have its
lessons. Three documents matter:

| File | What it is | How to treat it |
|---|---|---|
| *(supplied separately)* | **Product requirements** — what the feature must do for a provider | The specification. This defines "done". |
| `docs/easy-chart-rebuild-plan.md` | **Engineering plan** — architecture, build order, the specific traps that cost the previous attempt real time, and an acceptance checklist | Follow it. Where it states a rule and the failure that motivated it, the failure is evidence, not decoration. |
| `docs/easy-chart-prompts.md` | **The previous implementation's LLM prompts, verbatim** (~80 KB of clinical instruction tuned over many evaluation runs) | A source of *requirements*, not text to paste. Mine it for rules; the section "the rules that are load-bearing" is the minimum to carry forward. |

## Read them in this order

1. The product requirements — what you are building.
2. `docs/easy-chart-rebuild-plan.md` — Phase 0 first (one architectural decision everything follows
   from), then the phases in order.
3. `docs/easy-chart-prompts.md` — the load-bearing-rules section before writing your first prompt; the
   full prompt text when you write each capability's prose.

## Before writing code

- Confirm the repo conventions listed at the top of the plan still hold (no barrel imports, zambda
  layout, vitest projects). Verify, don't assume — the plan was written against an earlier commit.
- Phase 1 (the action registry) blocks everything else. Do not start on prompts or UI first.
- Phase 7 (the evaluation harness) is listed late in the document but should be started in the first
  week: every guard in Phase 4 exists because a harness surfaced the failure it prevents.

## Two standing principles from the product owner

1. **Minimise new feature-owned code.** Prefer fixing or extending a shared hook over building a
   parallel one. Phase 5.1 spells out three small shared-hook changes that replace ~460 lines of
   feature code.
2. **Never guess in a medical record.** When a value is ambiguous or implausible, the correct behaviour
   is to ask the provider — not to pick the more likely interpretation, and not to fail silently.

## Definition of done

The acceptance checklist at the end of the plan. All boxes, including the ones about authorisation,
PHI-safe logging, and section parity with the existing progress note — those were retrofits last time,
and retrofitting them means auditing every call site twice.

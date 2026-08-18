# Easy Chart evaluation harness

A **local tool**, deliberately not a deployed endpoint. In the previous implementation the LLM judge
shipped as a normal authenticated zambda, which means anyone holding a project token could spend
model budget scoring arbitrary text. Everything that costs model budget lives here.

## What is in the corpus, and what is not

`cases/` holds **twenty synthetic provider dictations** covering common urgent-care presentations.
They were written by hand rather than taken from real visits, and **there are no gold notes for any
of them.** So they cannot answer "did the planner match what a clinician wrote".

What they can answer, cheaply and on every change, is *"is the output internally correct and
clinically sane"*: are the codes real, is there exactly one primary diagnosis, did the negated
findings stay out, did the units convert, did a stated follow-up produce a disposition, did every
step report an outcome. `expectations.ts` records the per-case facts that are derivable by reading
the narrative — nothing there is a judgement about what a clinician would have charted.

The heavier loop — real (transcript, gold note) pairs — **does not transfer.** That corpus was PHI:
it lived in gitignored directories and was never committed, correctly. Harvesting real cases again
needs access to a live environment and whatever approval that carries, so treat it as a task with a
lead time, not a script you run on day one. **The ignore rules for the corpus directories are
already in place** (`harvested-cases/`, `harvested-results/`, `results/`) — they were added before
the first harvest, not after.

## Running it

```bash
# every case against a local zambda server
npx tsx tools/easy-chart-eval/run.ts --url http://localhost:3000 --token "$TOKEN"

# one case
npx tsx tools/easy-chart-eval/run.ts --case case-07 --token "$TOKEN"

# keep the raw plans for inspection (gitignored output directory)
npx tsx tools/easy-chart-eval/run.ts --token "$TOKEN" --out tools/easy-chart-eval/results
```

Authenticate with a `client_credentials` token for the project's test M2M client: the endpoints
recognise it and skip the role check, because a service client has no user profile and could never
pass one.

The runner exits non-zero when any deterministic check fails, so it can gate a prompt change.

## Where the checks live

The scorer itself is `packages/utils/lib/easy-chart/eval-scorer.ts`, with its own unit tests over
committed fixtures — so the rules run in CI without a model or a live environment, and this runner
only supplies real plans to score. That split is deliberate: the deterministic scorer earns its keep
before the LLM judge does, and it must never be the thing that is skipped because a hardcoded path
did not exist on someone's machine.

## Still to build (Phase 7, in order of value)

1. **A harvester** for real (transcript, gold note) pairs from a live environment, plus a
   deterministic gold-note renderer so the two are comparable. Needs approval; has a lead time.
2. **A transcript-derivability pass** that stamps each harvested gold item with whether it was even
   *hearable*. A gold note contains PMH, intake medication lists and clicked exam findings the
   ambient recording never heard; scoring the planner against those produces a meaningless number
   that never improves. The headline fidelity score must count derivable items only.
3. **The LLM judge** (prompt in `docs/easy-chart-prompts.md`, schema in
   `docs/easy-chart-code-to-carry-over.md` §6), for free text and semantics only. It must also report
   `extra[]` — what the planner charted that the gold note does not contain. Misses alone will not
   show you over-charting.
4. **A replay harness** running captured actions through the real client matchers, with assertions,
   over committed fixtures. This is where exam/ROS mismatches show up. The previous version printed
   to the console, asserted `expect(true).toBe(true)`, and was skipped unless a hardcoded
   `/private/tmp/…` path from one developer's machine existed. Do not repeat that.
5. **A chart-wipe script** for an encounter, so a re-run does not start dirty.

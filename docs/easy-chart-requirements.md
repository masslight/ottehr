# Easy Chart — product requirements

Verbatim from the ticket. This is the specification: it defines what "done" means. The engineering plan
(`docs/easy-chart-rebuild-plan.md`) says *how*; this says *what*. Where the two appear to disagree, this
file wins and the plan should be corrected.

Two additions made after the ticket was written are recorded at the end, in
[Addenda](#addenda-added-after-the-original-ticket).

---

## 1. Purpose

Easy Chart is a streamlined, AI-assisted way to complete a visit note. Instead of navigating the full
chart section by section, the provider works from a single page: the visit note on the left, an AI
charting assistant on the right. The provider can dictate, paste a narrative, use the visit's recorded
conversation, or type short requests — and the assistant translates that into a structured, coded,
billable note. The provider always remains in control: everything the AI writes is marked, reviewable,
and correctable, and the design assumes the AI will sometimes be wrong — so its mistakes must always be
visible and easy to fix.

## 2. Access and Layout

Each visit has an Easy Chart page reachable for that encounter; the standard (full) chart remains
available at any time via an "Open in regular chart" link. Both views work against the same underlying
record — nothing is duplicated.

The page shows the patient's name, date of birth, age, sex, visit reason, and allergies at the top,
along with a required "I verified patient's name and date of birth" confirmation.

The note occupies the main column and reads like a clinical document: Chief Complaint, History of
Present Illness, Mechanism of Injury, Review of Systems, Vitals, Examination, Medical Decision Making,
Diagnoses, E&M and procedure codes, Medications (in-house and prescriptions), Immunizations, Labs,
Radiology, Disposition and follow-up, Patient Instructions, School/Work excuse, Screening
questionnaires, per-section notes, Addendum, and the privacy-policy acknowledgment line — the same
content a reviewer would see at Review & Sign.

## 3. Charting by Conversation

The provider can paste or dictate a full visit narrative; the assistant reads it and charts the visit
end to end.

The provider can also make single requests in plain language ("add diagnosis sinusitis", "remove
medication Motrin", "add weight 80 kg") and the assistant applies just that change.

Before changing the chart, the assistant works from a visible plan: a step-by-step list of everything
it intends to chart (history text, vitals, exam findings, diagnoses, medications, instructions, and so
on). As the plan runs, the current step is always kept in view, each completed step is checked off, and
skipped or failed steps are labeled honestly as such.

The completed plan stays in the conversation history so the provider can always look back at exactly
what was done and why.

While the assistant is thinking, the page stays responsive: the provider can keep typing, queued
messages send when the assistant is free, and a status line with elapsed time makes long waits visible
instead of silent.

Very long pasted narratives collapse in the conversation view with a "show more" control so the thread
stays readable.

If a request contains nothing chartable, the assistant says so rather than guessing.

## 4. Charting from the Visit's Own Words (Transcripts)

When the visit has a transcript — an ambient recording made in the room, or the patient's intake chat —
it appears at the top of the page as a labeled chip showing its source, who recorded it, and when.

If the chart is still empty and an unused transcript exists, a one-click banner offers to generate the
chart from it.

Clicking a transcript chip opens a preview where the provider can read the transcript, generate the
chart from it, insert its text into the message box to edit first, or copy it.

Chart generation from a transcript starts immediately — the preparation happens in advance, so there is
no long wait after the click.

Once a transcript has been used, it is marked with a check so it isn't accidentally applied twice;
deliberately re-using it remains possible.

A microphone button on the Easy Chart page lets the provider record the visit right there; when the
recording finishes processing, its transcript appears on the page automatically, without reloading.

## 5. What the Assistant Can Chart

The assistant can create or update every part of the note, including:

Free-text sections: chief complaint, history of present illness, mechanism of injury, and medical
decision making, written in clinical voice and anchored to what was actually said in the visit.

Vitals, including blood pressure, temperature, weight, and height, with sensible units.

Structured Review of Systems and Examination findings (these are always structured findings, with
correct "reports/denies" and normal/abnormal polarity — never loose text).

Diagnoses with correct ICD-10 codes, including a clearly marked primary diagnosis.

Visit templates: when the practice has a template matching the visit (for example a strep-throat
template), the assistant applies it first and then charts only what the template didn't cover.

E&M level and performed-procedure codes, using the correct new-patient or established-patient code
family based on the patient's actual history with the practice.

Medications given in clinic, prescriptions to send, and immunizations.

Disposition and follow-up (discharge home, follow up with PCP, transfer, and so on) with return
precautions.

Patient instructions.

Prescription requests get special care: if the provider committed to a specific drug it is charted as
that drug; if only a drug class or intent was voiced, the assistant charts the best available option and
leaves a clearly labeled note that the prescription needs completion — a spoken commitment to treat is
never silently dropped.

## 6. Direct Editing — the Provider Never Depends on the AI

Every free-text section of the note is directly editable by typing, exactly like a normal document.

Quick-add chips let the provider enter vitals by hand (with height accepted as centimeters, total
inches, or feet-and-inches).

Every structured item can be deleted, and search-based items (diagnoses, medications, exam findings,
codes) can be clicked to correct — the provider picks the right alternative from a list, refines the
search, or skips.

A medication can be marked "dosage unconfirmed" when the dose wasn't nailed down during the visit.

## 7. Everything the AI Writes Is Marked and Reviewable

Every AI-charted item is visibly flagged for provider review. The provider can confirm, change, or
remove each one individually, or confirm all at once.

Each AI item records where it came from: items taken from the provider's or patient's actual words carry
that snippet; items the AI inferred (rather than heard) are marked as inferred — for example, vitals
estimated from context are flagged as low-confidence.

If the provider hand-edits a section after the AI wrote it, the AI's authorship flag for that section is
cleared — the note reflects who really wrote what.

## 8. The Automatic Second Look (Review Pass)

After the chart is generated, an automatic review reads the finished note against the original narrative
and adds suggestions. While it runs, the page says so ("Reviewing the note and adding suggestions…"),
and its findings are highlighted in the note with the reasoning available on hover. The review checks
that:

A disposition was charted whenever the visit's own words contain discharge or follow-up language; if
missing, it proposes one.

The E&M level and procedure codes match what was documented and performed.

Nothing in the note contradicts the note's own narrative — a diagnosis, medication, or code at odds with
the story is corrected. When a diagnosis is wrong, the review replaces it with the supported one rather
than leaving the note diagnosis-less.

No spoken prescription commitment was dropped.

The note is internally complete (for example, it warns rather than stays silent when results are still
pending).

The review may add, adjust, or replace items — but its changes are highlighted suggestions for the
provider, never silent edits.

## 9. Accuracy Safeguards

Easy Chart assumes AI errors will happen and builds specific defenses against the ones observed in real
use:

Right drug, right form: a medication whose product name implies the wrong site or indication (for
example an "athlete's foot" cream for a vaginal infection) cannot be selected when the visit doesn't
support it.

Findings filed in the right place: an exam finding cannot be filed under the wrong body-system section of
the exam.

Diagnosis coding discipline: codes must match their descriptions exactly; left/right and
first-episode/recurrent qualifiers must match the story; "history of" codes are only used when the visit
actually describes past history; a code implying a specific organism or cause (for example
"gonococcal") is not used unless the visit supports it; the same diagnosis cannot be charted twice, and
there is never more than one primary.

The provider's words govern: when the provider states a diagnosis, the AI charts that diagnosis rather
than escalating to a more severe one; when the provider revises an impression mid-visit ("actually, I
don't think he's constipated"), the later statement wins.

No invented negatives: the AI does not pad the exam or review of systems with findings nobody addressed.

Dose safety: questionable medication strengths are gated or flagged rather than silently accepted.

Formulary awareness: if a requested strength isn't available in the practice's formulary, the provider is
warned.

## 10. Reliability

If the AI fails to respond, produces nothing usable for a substantial narrative, or stalls, the system
automatically retries and then switches to a backup AI — the provider just sees the chart complete,
perhaps a little slower.

A failed or interrupted transcript generation does not mark the transcript as used.

Every step outcome is reported truthfully: applied, skipped (with reason), or failed — never a silent
no-op.

Time and date information shown to users always displays in the viewer's local time zone.

## 12. Guiding Principles (Summary)

The provider is the author; the AI is an assistant. Everything the AI does is visible, attributed, and
reversible.

The visit's own words are the source of truth — for charting, for review, and for measurement.

Mistakes are expected; the product's job is to surface them for a human, never to hide them.

The note produced through Easy Chart is complete: nothing a reviewer needs at sign-off is missing from
the Easy Chart view.

---

## Addenda (added after the original ticket)

### A. Token usage is shown under the chat

A per-session LLM token tally is displayed beneath the message box: input and output tokens per model
provider, how many of the input tokens were served from cache, and the number of calls, with a reset
control. See the plan's Phase 6a for the exact current form and Phase 7.2 for where the numbers come
from.

### B. The conversation keeps context

The assistant must hold the conversation's context the way a normal chat does, rather than treating each
message as an isolated command. A provider should be able to follow up on the previous turn ("make that
ten days instead") and to ask a question about the note and get an answer grounded in the whole session,
not only in the last sentence typed.

This is a requirement of intent, not of mechanism — the plan's Phase 5.2 proposes how to implement it
and states the trade-offs (cost per turn, and the risk of the model re-charting what it already charted).

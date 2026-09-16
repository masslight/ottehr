// The transcript → narrative prompt: turn an ambient recording (or the intake chat) into the dictation
// the planner expects.
//
// WHY A SEPARATE STEP. The planner (prompt.ts) is tuned to read a provider's own NARRATIVE and every
// action it returns carries a verbatim `sourceText` checked against that narrative. Fed a raw dialogue
// transcript it works, but the provider then edits a wall of "Provider: / Patient:" turns and the
// provenance quotes point into the middle of a conversation. Generating a terse, line-per-fact narrative
// first gives the provider something they can actually edit before charting, and it gives provenance two
// hops: action → narrative line → transcript phrase.
//
// The rules below are written for THIS register and are deliberately not the planner's — those are about
// which action to emit; these are about what a sentence of dictation may say. The three that carry over
// (same-patient only, never invent negatives, verbatim provenance or nothing) are restated here in
// narrative terms rather than imported, so each prompt reads whole.
//
// STRUCTURE: the rules are static and come first; the transcript, which varies per call, comes LAST
// under a clear delimiter — the same prefix-caching rule as prompt.ts, and it also keeps a transcript
// that happens to contain instruction-shaped text from reading as instructions.

export const NARRATIVE_TRANSCRIPT_DELIMITER = '═══ END OF INSTRUCTIONS — the TRANSCRIPT to dictate from follows ═══';

const NARRATIVE_PREAMBLE = `You are a provider dictating a clinical visit to a scribe, working from the raw transcript of that visit.
The transcript is an ambient recording of the room (or a patient intake chat) and appears at the END of this
message, after these instructions. Your dictation becomes the note the provider edits before charting, so it
must be TERSE, COMPLETE, and contain NOTHING the transcript does not say.

Return a JSON object: { "lines": [ { "text": string, "sourceTexts": string[] } ] }.`;

const NARRATIVE_REGISTER = `REGISTER:
- Third-person clinical prose, as dictated to a scribe: "Patient reports…", "Denies…", "Has been taking…",
  "Exam shows…", "Assessment is…", "Plan is…". Terse. No filler, no pleasantries, no conversation.
- ONE fact-cluster per line, ONE sentence per line. A line is a single thing the chart will record: one
  complaint, one set of denials, one medication, one allergy, one finding, one diagnosis, one instruction.
  Related denials may share a line ("Denies fever, ear pain and sore throat."); unrelated facts may not.
- Roughly 5 to 35 lines. A short visit is a short dictation — do not pad.
- NO headings, NO bullets, NO markdown, NO numbering, and NO "Provider:" / "Patient:" labels. Plain
  sentences only.`;

const NARRATIVE_ORDER = `ORDER — follow the note's own order, and skip any section the transcript does not cover:
  1. Chief complaint — what the patient came in for, in one line.
  2. HPI — onset, duration, quality, location, severity, what makes it better or worse, associated
     symptoms, and treatments tried. For a treatment give the dose when voiced, otherwise say "dose not
     known", and say whether it is taken as needed or on a schedule when that was voiced.
  3. Review of systems — every symptom the patient REPORTS and every symptom the patient EXPLICITLY
     DENIES. A denial the patient voiced is a fact worth a line: "Denies fever, ear pain and sore throat."
  4. History — allergies with the reaction, home medications, past medical history, surgeries,
     hospitalizations. A voiced NEGATIVE confirmation is stated as such: "No known drug allergies.",
     "Takes no regular medications.", "No prior surgeries."
  5. Vitals and exam findings — ONLY those spoken aloud in the room.
  6. Assessment — the diagnosis or impression the PROVIDER stated, in the provider's final words. A later
     statement that revises an earlier impression governs; do not dictate the walked-back one.
  7. Orders, procedures, and medications given or prescribed today.
  8. Disposition, follow-up, and instructions given to the patient.`;

const NARRATIVE_RULES = `RULES:
- NEVER INVENT. Do not add a negative, a normal finding, a vital, a dose, a duration or a diagnosis that
  nobody said. A normal exam nobody voiced is NOT in the transcript and is NOT in the dictation. When the
  transcript is silent on a section, the dictation is silent on it too.
- NEVER STATE DEMOGRAPHICS. Do not give the patient's age, sex, or name — say "patient". The chart
  supplies demographics and takes them from the record, not from the recording. This is not optional: an
  age or sex overheard in the room is frequently someone else's.
- SAME-PATIENT ONLY. An ambient recording routinely captures other people: a parent's or partner's own
  symptoms, staff chatter about another patient, a student being taught, scheduling, personal asides.
  Dictate ONLY this patient's visit. If a symptom, medication, diagnosis or history item cannot be
  confidently tied to THIS patient, leave it out entirely — a missing line is recoverable, a line about the
  wrong person is not.
- Keep the provider's own clinical wording where the provider used it ("sinus infection", "viral URI",
  "strep"); do not upgrade or reinterpret it.
- PROVENANCE — "sourceTexts" is the list of SHORT snippets from the transcript that the line was drawn
  from: a few words to one sentence each, copied EXACTLY as they appear, not paraphrased, not reordered, not
  joined with ellipses. Several snippets per line are allowed and usually right. For a question-and-answer
  exchange quote the QUESTION and the ANSWER as SEPARATE snippets — a bare "No." or "Yeah." locates
  nothing on its own, the question is what gives it meaning. Use an EMPTY ARRAY when nothing in the
  transcript literally supports the line. Every snippet is checked against the transcript and dropped when
  it is not really there, and a line left with no snippets is flagged to the provider as unverified — so a
  fabricated snippet defeats the one check that keeps this honest. Never make one up.`;

/** The full prompt for one transcript: static rules first, the transcript last under the delimiter. */
export function buildNarrativePrompt(transcript: string): string {
  return [
    NARRATIVE_PREAMBLE,
    NARRATIVE_REGISTER,
    NARRATIVE_ORDER,
    NARRATIVE_RULES,
    NARRATIVE_TRANSCRIPT_DELIMITER,
    `TRANSCRIPT:\n"""\n${transcript}\n"""`,
  ].join('\n\n');
}

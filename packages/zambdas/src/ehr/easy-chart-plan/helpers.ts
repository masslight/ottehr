import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ConversationTurn } from 'utils/lib/easy-chart/api';

/**
 * The authoritative patient line for the prompt. Deliberately minimal: age and sex are what the
 * model needs to code correctly, and everything else (name, address, insurance) is both irrelevant
 * to charting and PHI we have no reason to send.
 */
export function describePatient(patient: Patient): string {
  const parts: string[] = [];
  if (patient.birthDate) {
    const birth = DateTime.fromISO(patient.birthDate);
    if (birth.isValid) {
      const months = Math.floor(DateTime.now().diff(birth, 'months').months);
      parts.push(months < 24 ? `Age: ${months} month(s)` : `Age: ${Math.floor(months / 12)} years`);
    }
  }
  parts.push(`Sex: ${patient.gender ?? 'unknown'}`);
  return parts.join(', ');
}

/**
 * The bounded conversation digest (Phase 5.7b).
 *
 * SUMMARISE ASSISTANT TURNS, QUOTE PROVIDER TURNS. What the provider SAID is evidence and must be
 * verbatim; what the assistant DID is already in the chart state, so one line per action is enough.
 * The window itself is capped in validateRequestParameters — every turn re-sends it, so an uncapped
 * window makes cost grow superlinearly.
 */
export function buildHistoryDigest(history?: ConversationTurn[]): string | undefined {
  if (!history?.length) return undefined;
  const lines = history.map((turn) => {
    if (turn.role === 'provider') return `provider: ${turn.text ?? ''}`;
    const charted = turn.charted?.length ? `charted ${turn.charted.join('; ')}` : undefined;
    const skipped = turn.skipped?.length ? `skipped ${turn.skipped.join('; ')}` : undefined;
    const summary = [charted, skipped].filter(Boolean).join(' · ');
    return `assistant: ${summary || 'nothing was charted'}`;
  });
  return lines.join('\n');
}

/**
 * The reconciliation instruction for the pass that runs right after a template was applied.
 *
 * WHY IT HAS TO BE SPELLED OUT. The call is `incremental`, and that block tells the model to chart only
 * what is NEW — the exact opposite of what is wanted here, which is to look at what is already there and
 * take back the parts the visit does not support. Left to the model's discretion this measured
 * unreliable on the neighbouring surface: the review's disposition check swung 53% → 36% → 35% across
 * runs of one corpus with no code change, which is why that one is force-included too.
 *
 * The template's contributions are not named here and do not need to be — the ALREADY ON THE CHART block
 * above is built from the chart this zambda just read, so it lists them, and it is the only description
 * of them the model can trust.
 *
 * Note-text fields are excluded deliberately. A template's CC/HPI/MDM defaults are boilerplate that the
 * dictated text must supersede, and the FIRST pass already wrote that text from the narrative. Asking for
 * it again buys nothing and costs the one failure mode worth avoiding here: a re-summarised HPI, where a
 * detailed history comes back as "Patient presents with <dx>".
 */
export const TEMPLATE_RECONCILE_INSTRUCTION = `A TEMPLATE WAS JUST APPLIED. Everything it charted is listed in the ALREADY ON THE CHART block above,
mixed in with what was there before. A template fills in generic defaults — normal exam findings, a
default diagnosis, default codes — chosen from its title alone, WITHOUT seeing this visit's narrative.
Your job on this call is to reconcile those defaults against the narrative:

  - remove-exam-finding for every charted NORMAL the narrative contradicts (the template asserts
    "Oropharynx clear" and the provider dictated an injected oropharynx: remove the normal, then add the
    finding the provider actually described);
  - remove-diagnosis for a charted diagnosis this visit's narrative does not support. When the narrative
    supports a different one, emit the removal AND the add-diagnosis that replaces it — never a bare
    removal that leaves the note with no diagnosis;
  - remove-cpt for a charted procedure code the narrative does not say was performed.

Then add anything the narrative states that is still missing. Do NOT re-emit anything the ALREADY ON THE
CHART block lists — it is already done. Do NOT emit edit-note-text on this call: the note's free-text
fields were written from this same narrative on the previous pass and must not be rewritten from a
summary. Remove ONLY on a clear contradiction with what the provider said; when in doubt, leave it.`;

/**
 * Resolve the title the model put on an apply-template to one of the practice's templates.
 *
 * The model is told to use the EXACT listed titles and never to invent one, and mostly does; the
 * tolerance below is for the residue — case, punctuation, a dropped word — not for guessing. Exact
 * normalized match first, then a title that contains the whole query (or vice versa), then the title
 * sharing the most words with the query and its searchTerms, and only when it shares at least half of
 * them. Anything looser would hand the provider a template the model never named.
 */
export function resolveSuggestedTemplate<T extends { id: string; title: string }>(
  templates: readonly T[],
  action: { display?: string; searchTerms?: string[] }
): T | undefined {
  const norm = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  // Spaces dropped too for the exact and containing checks, so "X-Ray" and "xray" are the same title.
  const compact = (text: string): string => norm(text).replace(/ /g, '');
  const query = norm(action.display ?? '');
  if (!query) return undefined;
  const queryCompact = compact(query);

  const exact = templates.find((template) => compact(template.title) === queryCompact);
  if (exact) return exact;

  const containing = templates.filter((template) => {
    const title = compact(template.title);
    return title.includes(queryCompact) || queryCompact.includes(title);
  });
  if (containing.length > 0) return containing.sort((a, b) => a.title.length - b.title.length)[0];

  const queryWords = new Set(
    [query, ...(action.searchTerms ?? []).map(norm)].flatMap((text) => text.split(' ')).filter(Boolean)
  );
  let best: { template: T; score: number } | undefined;
  for (const template of templates) {
    const titleWords = norm(template.title).split(' ').filter(Boolean);
    if (titleWords.length === 0) continue;
    const shared = titleWords.filter((word) => queryWords.has(word)).length;
    const score = shared / Math.max(titleWords.length, 1);
    if (score >= 0.5 && (!best || score > best.score)) best = { template, score };
  }
  return best?.template;
}

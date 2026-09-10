/**
 * show-voiced.ts — read the voiced tags on a harvested case the way a human needs to see them.
 *
 * The tags are stamped onto the gold IN PLACE by tag-voiced.ts (LLM judge, claude-sonnet-5):
 * a per-item `voiced: boolean` meaning "stated or clearly implied in the dictation", plus a
 * `voicedEvidence` quote/paraphrase of at most ten words, plus `nameVoiced` on prescribed meds
 * (the DRUG'S NAME was spoken, not just "an antibiotic") and `dispositionVoiced` on the
 * disposition. They live nowhere else — there is no separate benchmark file to open.
 *
 * Why this script exists: those tags decide the recall denominators for exam, ROS, diagnoses,
 * CPT, meds and disposition (see score-harvested.ts), and for exam and ROS they remove the large
 * majority of gold — so anyone reading the report eventually needs to check the judge's work.
 * Reading the raw case JSON to do that means scrolling past the whole chart; this prints the
 * transcript next to the tagged items and nothing else.
 *
 * Usage:
 *   npx tsx tools/easy-chart-eval/show-voiced.ts case001 case042
 *   npx tsx tools/easy-chart-eval/show-voiced.ts case001 --section exam
 *   npx tsx tools/easy-chart-eval/show-voiced.ts case001 --unvoiced      # only voiced:false
 *   npx tsx tools/easy-chart-eval/show-voiced.ts case001 --voiced        # only voiced:true
 *   npx tsx tools/easy-chart-eval/show-voiced.ts --all --section exam --unvoiced
 *   npx tsx tools/easy-chart-eval/show-voiced.ts case001 --blind         # hide the judge's answer
 *
 * `--blind` is for hand-auditing: it prints the transcript and the items with the tag and the
 * evidence WITHDRAWN, so an auditor decides for themselves before seeing what the judge said.
 * Re-run without the flag to compare. Anchoring on the judge's label is the whole failure mode a
 * hand audit exists to avoid, so this is not a nicety.
 *
 * The case files hold real harvested patient data and are gitignored; this prints to stdout only.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { GoldData } from './gold-types';
import { rosBaseAndPolarity } from './score-harvested';

const CASES_DIR = join(__dirname, 'harvested-cases');

interface HarvestedCase {
  caseId?: string;
  transcript?: string;
  gold: GoldData;
}

/** The additive tag fields, cast where the gold types do not declare them (as the scorer does). */
type Tagged = { voiced?: boolean; voicedEvidence?: string; nameVoiced?: boolean };
const tagOf = (item: unknown): Tagged => item as Tagged;

interface Row {
  label: string;
  detail?: string;
  voiced?: boolean;
  evidence?: string;
  /** Prescribed meds only: the class/commitment was spoken but the drug name was not. */
  intentOnly?: boolean;
  /**
   * Why an item carries no tag. Every untagged item in the corpus is one the scorer drops
   * BEFORE voicing matters — exam rows with `present !== true` (142: 136 are `*-comment` /
   * `*-location` free-text fields whose boolean is meaningless, 6 are findings explicitly
   * recorded false) and lab-order diagnoses (36, scored as context). Naming the reason keeps an
   * auditor from
   * spending attention on items that never entered a denominator; a bare "untagged" would
   * also read as "not voiced", which is the opposite of how the scorer treats an absent tag.
   */
  outOfScope?: string;
}

/** One section of tagged gold, in the order the report's rows are computed. */
function sectionsOf(gold: GoldData): { name: string; rows: Row[] }[] {
  const row = (label: string, item: unknown, detail?: string): Row => {
    const tag = tagOf(item);
    return {
      label,
      detail,
      voiced: tag.voiced,
      evidence: tag.voicedEvidence,
      ...(tag.voiced === true && tag.nameVoiced === false ? { intentOnly: true } : {}),
    };
  };
  const untagged = (base: Row, reason: string): Row =>
    typeof base.voiced === 'boolean' ? base : { ...base, outOfScope: reason };

  const disposition = gold.disposition as (GoldData['disposition'] & { dispositionVoiced?: boolean }) | undefined;

  return [
    {
      name: 'diagnoses',
      rows: (gold.assessment?.diagnoses ?? []).map((d) =>
        untagged(
          row(
            `${d.codeNormalized} — ${d.display}`,
            d,
            [d.primary ? 'primary' : '', d.fromLabOrder ? 'fromLabOrder' : ''].filter(Boolean).join(', ')
          ),
          'added by a lab order — scored as context, in neither denominator'
        )
      ),
    },
    {
      name: 'cpt',
      rows: (gold.billing?.cptCodes ?? []).map((c) => row(`${c.codeNormalized} — ${c.display}`, c)),
    },
    {
      name: 'ros',
      // Polarity is encoded in the FIELD NAME (`…-denies` / `…-reports`), which is why the scorer
      // reads it through rosBaseAndPolarity and reports polarityAgree separately. It is NOT in
      // `present` — every ROS row in the corpus is present:true — so deriving it from that flag
      // would label every denial as a positive finding.
      rows: (gold.reviewOfSystems?.observations ?? []).map((o) =>
        row(o.label ?? o.field, o, rosBaseAndPolarity(o.field).polarity)
      ),
    },
    {
      name: 'exam',
      rows: (gold.exam ?? []).map((e) =>
        untagged(
          row(
            e.label ?? e.field,
            e,
            [e.abnormal ? 'ABNORMAL' : 'normal', e.note ? `note: ${e.note}` : ''].filter(Boolean).join(', ')
          ),
          /-comment$|-location$/.test(e.field)
            ? 'exam free-text field — its content is the note, not a ticked finding; counted as examComments'
            : 'explicitly recorded as not present — dropped before scoring'
        )
      ),
    },
    {
      name: 'medsPrescribed',
      rows: (gold.medications?.prescribed ?? []).map((m) => row(m.name ?? '(unnamed)', m, m.sig)),
    },
    {
      name: 'disposition',
      // Not a list: one tag for the visit's disposition, under its own field name.
      rows: disposition
        ? [
            {
              label: disposition.type ?? '(no type)',
              detail: [disposition.followUpIn != null ? `followUpIn ${disposition.followUpIn}d` : '', disposition.note]
                .filter(Boolean)
                .join(', '),
              voiced: disposition.dispositionVoiced,
            },
          ]
        : [],
    },
  ];
}

function main(): void {
  const args = process.argv.slice(2);
  const flag = (name: string): boolean => args.includes(`--${name}`);
  const valueOf = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const onlySection = valueOf('section');
  const blind = flag('blind');
  const wantVoiced = flag('voiced');
  const wantUnvoiced = flag('unvoiced');
  const showTranscript = !flag('no-transcript');

  const ids = flag('all')
    ? readdirSync(CASES_DIR)
        .filter((f) => /^case\d+\.json$/.test(f))
        .map((f) => f.replace('.json', ''))
        .sort()
    : args.filter((a) => /^case\d+$/.test(a));

  if (ids.length === 0) {
    console.log('usage: show-voiced.ts <caseNNN...> | --all   [--section exam] [--voiced|--unvoiced] [--blind]');
    console.log(`cases live in ${CASES_DIR}`);
    process.exit(1);
  }

  for (const id of ids) {
    const data = JSON.parse(readFileSync(join(CASES_DIR, `${id}.json`), 'utf8')) as HarvestedCase;
    console.log('='.repeat(100));
    console.log(`${id}${blind ? '   [BLIND — judge tags withheld]' : ''}`);
    console.log('='.repeat(100));

    if (showTranscript) {
      console.log('\n--- TRANSCRIPT (the only thing an item may be judged against) ---\n');
      console.log((data.transcript ?? '(none)').trim());
    }

    for (const section of sectionsOf(data.gold)) {
      if (onlySection && section.name !== onlySection) continue;
      const rows = section.rows.filter((r) => {
        if (wantVoiced && r.voiced !== true) return false;
        if (wantUnvoiced && r.voiced !== false) return false;
        return true;
      });
      if (rows.length === 0) continue;

      const tagged = section.rows.filter((r) => typeof r.voiced === 'boolean');
      const voicedCount = tagged.filter((r) => r.voiced).length;
      console.log(
        `\n--- ${section.name.toUpperCase()}  (${rows.length} shown of ${section.rows.length}; ` +
          `tagged ${tagged.length}, voiced ${voicedCount}) ---`
      );
      for (const r of rows) {
        // Untagged is its own state and must not read as "not voiced": the scorer keeps untagged
        // items IN the denominator, the opposite of voiced:false.
        const mark = blind
          ? '[ ? ]'
          : r.voiced === true
          ? '[VOICED  ]'
          : r.voiced === false
          ? '[unvoiced]'
          : '[not tagged]';
        console.log(`  ${mark} ${r.label}${r.detail ? `  (${r.detail})` : ''}`);
        if (r.outOfScope) console.log(`            ^ ${r.outOfScope}`);
        if (!blind && r.intentOnly) console.log(`            ^ intent-voiced: the drug NAME was not spoken`);
        if (!blind && r.evidence) console.log(`            evidence: "${r.evidence}"`);
      }
    }
    console.log();
  }
}

main();

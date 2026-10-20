/**
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *  THE RULE BOOK — WHAT THE CODING ASSISTANT MUST SUGGEST
 *  No programming knowledge is needed to read or change this file.
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *
 *  Every entry below is one visit. It says:
 *    • which procedure the provider picked in the "Procedure type" box,
 *    • what they answered on the form — written with the labels printed on the form itself,
 *    • which billing codes the system must suggest for that visit.
 *
 *  A suggested code is written the way it is billed:
 *    '12001'        — code 12001, one unit
 *    '69210-50'     — code 69210 with modifier 50 (both sides in one line)
 *    '10160 x5'     — code 10160, five units
 *    '13101 + 13102 x2' is written as two separate entries in the list.
 *
 *  When the system must NOT suggest a code, `suggests` is empty and `tells` holds the exact
 *  sentence the provider sees instead.
 *
 *  TO CHECK A RULE: find the visit, read the answers, read the codes. If a line is wrong,
 *  the rule is wrong — feature.test.ts runs every line here and will say so.
 *  TO ADD A RULE: copy a line, change the answers and the codes.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *  WHERE THE RULES COME FROM
 *  These are the public pages the coding logic itself cites. Each section below repeats the
 *  ones that decide its codes, so a rule can be checked without opening any code.
 *
 *  • Medicare NCCI Policy Manual 2026 — the chapter PDFs, effective 1 Jan 2026:
 *    https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-policy-manual
 *  • Which codes may not be billed together (NCCI PTP edits):
 *    https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits
 *  • How many units a day are usually allowed (NCCI MUE table):
 *    https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits-mues
 *  • Code identities and bilateral indicators (Medicare Physician Fee Schedule, RVU26A file):
 *    https://www.cms.gov/files/zip/rvu26a.zip
 *
 *  The exact CPT descriptors and their bands come from the licensed AMA CPT 2026 codebook,
 *  which cannot be linked publicly. Everything above is free to open.
 * ════════════════════════════════════════════════════════════════════════════════════════════
 */

/** One visit: what was picked, what was answered, what must be suggested. */
export interface Visit {
  /** Plain description of the visit, as a clinician would say it. */
  visit: string;
  /** Exactly as it appears in the "Procedure type" box. */
  procedure: string;
  /** Answers keyed by the labels printed on the form. Repeating groups are lists. */
  answers: FormAnswers;
  /** Codes the system must suggest, in order. Empty when it must suggest nothing. */
  suggests: string[];
  /** The sentence shown to the provider when no code is suggested. */
  tells?: string;
}

export type FormAnswers = Record<string, string | number | boolean | Record<string, string | number | boolean>[]>;

// The names below are exactly what the provider sees in the procedure-type dropdown.
export const LACERATION = 'Laceration Repair (Wound Closure)';
export const CERUMEN = 'Impacted Cerumen Removal';
export const DRAINAGE = 'Incision & Drainage of Abscess';
export const FOREIGN_BODY = 'Foreign Body Removal';
export const SPLINT = 'Splinting & Strapping';
export const INJECTION = 'Therapeutic Injections & IV Infusions';
export const EKG = 'Diagnostic EKG';
export const BURN = 'Burn Treatment / Dressing';
export const LESION = 'Wart / Benign Lesion Destruction';
export const CATHETER = 'Urinary Catheterization';
export const NOSEBLEED = 'Nasal Packing (Epistaxis Control)';
export const ELBOW = "Reduction of Nursemaid's Elbow";
export const NAIL = 'Nail Trephination (Subungual Hematoma Drainage)';
export const NEBULIZER = 'Nebulizer Treatment';
export const IV_LINE = 'Intravenous (IV) Catheter Placement';

// ════════════════════════════════════════════════════════════════════════════════════════════
//  1. EAR WAX REMOVAL
// ════════════════════════════════════════════════════════════════════════════════════════════
//  Read the rules:
//    AMA CPT Assistant, January 2016, pp. 1–4 — irrigation vs. instrumentation, and what counts
//    as impacted wax (authorized AAO-HNS republication):
//    https://www.entnet.org/wp-content/uploads/2022/01/CPT-Assistant-69209-Cerumen-Removal_website.pdf
//    Medicare RVU26A, row 69210, bilateral indicator 2 — why Medicare wants one unit and no
//    modifier where other payers want modifier 50: https://www.cms.gov/files/zip/rvu26a.zip
export const EAR_WAX: Visit[] = [
  {
    visit: 'Wax flushed out of one ear with water',
    procedure: CERUMEN,
    answers: { 'Impaction established by': 'inflammation', 'Left ear removal method': 'irrigation' },
    suggests: ['69209-LT'],
  },
  {
    visit: 'Wax flushed out of both ears with water',
    procedure: CERUMEN,
    answers: {
      'Impaction established by': 'inflammation',
      'Left ear removal method': 'irrigation',
      'Right ear removal method': 'irrigation',
    },
    suggests: ['69209-50'],
  },
  {
    visit: 'Wax removed from one ear with instruments under direct vision',
    procedure: CERUMEN,
    answers: { 'Impaction established by': 'hard symptomatic wax', 'Left ear removal method': 'instruments' },
    suggests: ['69210-LT'],
  },
  {
    visit: 'Wax removed from both ears with instruments — two ways to bill it, pick one',
    procedure: CERUMEN,
    answers: {
      'Impaction established by': 'inflammation',
      'Left ear removal method': 'instruments',
      'Right ear removal method': 'instruments',
    },
    // Most payers want one line with modifier 50; Medicare wants a single unit with no modifier.
    suggests: ['69210-50', '69210'],
  },
  {
    visit: 'Both water and instruments used on one ear — instruments decide the code',
    procedure: CERUMEN,
    answers: { 'Impaction established by': 'obstructed examination', 'Left ear removal method': 'both' },
    suggests: ['69210-LT'],
  },
  {
    visit: 'Wax was not impacted, so cleaning it is part of the visit, not a procedure',
    procedure: CERUMEN,
    answers: { 'Impaction established by': 'not impacted', 'Left ear removal method': 'irrigation' },
    suggests: [],
    tells: 'No separate cerumen-removal code for this case.',
  },
];

// ════════════════════════════════════════════════════════════════════════════════════════════
//  2. DRAINING AN ABSCESS OR OTHER COLLECTION
// ════════════════════════════════════════════════════════════════════════════════════════════
//  Read the rules:
//    NCCI Policy Manual 2026, Chapter 3 (skin surgery, CPT 10000–19999):
//    https://www.cms.gov/files/document/03-chapter3-ncci-medicare-policy-manual-2026-final.pdf
//    MAC article A56766 — what a "complicated" drainage has to say in the note:
//    https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=56766
export const DRAINAGE_VISITS: Visit[] = [
  {
    visit: 'One abscess opened with a blade and drained',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'abscess', 'Drainage method': 'incision' },
    suggests: ['10060'],
  },
  {
    visit: 'Two separate abscesses opened and drained',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'abscess', 'Drainage method': 'incision', 'Distinct collections': 2 },
    suggests: ['10061'],
  },
  {
    visit: 'One abscess opened, drained and packed — packing makes it the complicated code',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'abscess', 'Drainage method': 'incision', Packing: true },
    suggests: ['10061'],
  },
  {
    visit: 'A blood collection under the skin opened and drained',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'hematoma/seroma', 'Drainage method': 'incision' },
    suggests: ['10140'],
  },
  {
    visit: 'An abscess drained with a needle instead of a cut',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'abscess', 'Drainage method': 'needle' },
    suggests: ['10160'],
  },
  {
    visit: 'A blood collection drained with a needle — the method decides, not the collection',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'hematoma/seroma', 'Drainage method': 'needle' },
    suggests: ['10160'],
  },
  {
    visit: 'A blister drained with a needle — the puncture-aspiration code names blisters',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'bulla', 'Drainage method': 'needle' },
    suggests: ['10160'],
  },
  {
    visit: 'An infected surgical wound opened with a drain placed',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'postoperative infection', 'Drainage method': 'incision', 'Drain placed': true },
    suggests: ['10180'],
  },
  {
    visit: 'An infected surgical wound opened, but nothing complex was documented',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'postoperative infection', 'Drainage method': 'incision' },
    suggests: [],
    tells:
      "This case needs a coder's judgment — Complex drainage work is not documented for this postoperative wound infection.",
  },
  {
    visit: 'A blister opened with a cut — there is no code for that here',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'bulla', 'Drainage method': 'incision' },
    suggests: [],
    tells: "This case needs a coder's judgment — Incision of this collection type needs a different procedure code.",
  },
];

// ════════════════════════════════════════════════════════════════════════════════════════════
//  3. REMOVING A FOREIGN BODY
// ════════════════════════════════════════════════════════════════════════════════════════════
//  Read the rules:
//    NCCI Policy Manual 2026, Chapter 8 §D.22 — eye removals on the same side are bundled:
//    https://www.cms.gov/files/document/08-chapter8-ncci-medicare-policy-manual-2026-final.pdf
//    Medicare RVU26A — code identities and which codes may carry a left/right modifier:
//    https://www.cms.gov/files/zip/rvu26a.zip
export const FOREIGN_BODY_VISITS: Visit[] = [
  {
    visit: 'A splinter pulled out of the skin without cutting',
    procedure: FOREIGN_BODY,
    answers: { 'Foreign body location': 'skin/subcutaneous', Side: 'left' },
    suggests: [],
    tells: 'Non-incisional skin foreign-body removal has no separate code in this family.',
  },
  {
    visit: 'A splinter cut out of the skin',
    procedure: FOREIGN_BODY,
    answers: { 'Foreign body location': 'skin/subcutaneous', 'Incision required': true, Side: 'left' },
    suggests: ['10120'],
  },
  {
    visit: 'A splinter cut out of an infected wound — infection makes it the complicated code',
    procedure: FOREIGN_BODY,
    answers: {
      'Foreign body location': 'skin/subcutaneous',
      'Incision required': true,
      'Infected wound': true,
      Side: 'left',
    },
    suggests: ['10121'],
  },
  {
    visit: 'A splinter cut out after a delayed presentation with scarring',
    procedure: FOREIGN_BODY,
    answers: {
      'Foreign body location': 'skin/subcutaneous',
      'Incision required': true,
      'Delayed presentation with scarring/dissection': true,
      Side: 'left',
    },
    suggests: ['10121'],
  },
  {
    visit: 'A bead taken out of a child’s nose',
    procedure: FOREIGN_BODY,
    answers: { 'Foreign body location': 'nose' },
    suggests: ['30300'],
  },
  {
    visit: 'Something taken out of the ear canal in the office',
    procedure: FOREIGN_BODY,
    answers: { 'Foreign body location': 'ear', Side: 'right' },
    suggests: ['69200-RT'],
  },
  {
    visit: 'Something taken out of the ear canal under general anaesthetic',
    procedure: FOREIGN_BODY,
    answers: { 'Foreign body location': 'ear', 'General anesthesia': true, Side: 'right' },
    suggests: ['69205-RT'],
  },
  {
    visit: 'A speck removed from the cornea using a slit lamp',
    procedure: FOREIGN_BODY,
    answers: { 'Foreign body location': 'cornea', 'Slit lamp used': true, Side: 'right' },
    suggests: ['65222-RT'],
  },
  {
    visit: 'A speck removed from the cornea without a slit lamp',
    procedure: FOREIGN_BODY,
    answers: { 'Foreign body location': 'cornea', Side: 'right' },
    suggests: ['65220-RT'],
  },
  {
    visit: 'A speck lying loose on the white of the eye',
    procedure: FOREIGN_BODY,
    answers: { 'Foreign body location': 'superficial conjunctiva', Side: 'left' },
    suggests: ['65205-LT'],
  },
  {
    visit: 'A speck embedded in the white of the eye',
    procedure: FOREIGN_BODY,
    answers: { 'Foreign body location': 'embedded conjunctiva', Side: 'left' },
    suggests: ['65210-LT'],
  },
  {
    visit: 'Something buried deeper than the fat under the skin',
    procedure: FOREIGN_BODY,
    answers: { 'Foreign body location': 'deeper tissue', Side: 'left' },
    suggests: [],
    tells: "This case needs a coder's judgment — Removal from deeper tissues uses a different code family.",
  },
];

// ════════════════════════════════════════════════════════════════════════════════════════════
//  4. SPLINTS AND STRAPPING
// ════════════════════════════════════════════════════════════════════════════════════════════
//  Read the rules:
//    NCCI Policy Manual 2026, Chapter 4 §G — a splint applied as a dressing after another
//    procedure is not billed separately:
//    https://www.cms.gov/files/document/04-chapter4-ncci-medicare-policy-manual-2026-final.pdf
//    Noridian article A56112 — prefabricated vs. custom application:
//    https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid=56112
export const SPLINT_VISITS: Visit[] = [
  {
    visit: 'A forearm splint moulded from plaster',
    procedure: SPLINT,
    answers: { Device: 'splint', 'Body region': 'forearm', 'Fabricated from raw materials': true, Side: 'left' },
    suggests: ['29125-LT'],
  },
  {
    visit: 'A long arm splint moulded from plaster',
    procedure: SPLINT,
    answers: { Device: 'splint', 'Body region': 'long arm', 'Fabricated from raw materials': true, Side: 'left' },
    suggests: ['29105-LT'],
  },
  {
    visit: 'A finger splint moulded from raw materials',
    procedure: SPLINT,
    answers: {
      Device: 'splint',
      'Body region': 'finger',
      'Fabricated from raw materials': true,
      Side: 'left',
      'Fingers treated': 1,
    },
    suggests: ['29130-LT'],
  },
  {
    visit: 'A finger splint that allows movement',
    procedure: SPLINT,
    answers: {
      Device: 'splint',
      'Body region': 'finger',
      'Splint mobility': 'dynamic',
      'Fabricated from raw materials': true,
      Side: 'left',
      'Fingers treated': 1,
    },
    suggests: ['29131-LT'],
  },
  {
    visit: 'A forearm splint that allows movement',
    procedure: SPLINT,
    answers: {
      Device: 'splint',
      'Body region': 'forearm',
      'Splint mobility': 'dynamic',
      'Fabricated from raw materials': true,
      Side: 'left',
    },
    suggests: ['29126-LT'],
  },
  {
    visit: 'A long leg splint moulded from plaster',
    procedure: SPLINT,
    answers: { Device: 'splint', 'Body region': 'long leg', 'Fabricated from raw materials': true, Side: 'left' },
    suggests: ['29505-LT'],
  },
  {
    visit: 'A short leg splint moulded from plaster',
    procedure: SPLINT,
    answers: { Device: 'splint', 'Body region': 'short leg', 'Fabricated from raw materials': true, Side: 'left' },
    suggests: ['29515-LT'],
  },
  {
    visit: 'Chest strapping',
    procedure: SPLINT,
    answers: { Device: 'strap', 'Body region': 'thorax' },
    suggests: ['29200'],
  },
  {
    visit: 'Shoulder strapping',
    procedure: SPLINT,
    answers: { Device: 'strap', 'Body region': 'shoulder', Side: 'left' },
    suggests: ['29240-LT'],
  },
  {
    visit: 'Elbow or wrist strapping',
    procedure: SPLINT,
    answers: { Device: 'strap', 'Body region': 'elbow/wrist', Side: 'left' },
    suggests: ['29260-LT'],
  },
  {
    visit: 'Hip strapping',
    procedure: SPLINT,
    answers: { Device: 'strap', 'Body region': 'hip', Side: 'left' },
    suggests: ['29520-LT'],
  },
  {
    visit: 'Knee strapping',
    procedure: SPLINT,
    answers: { Device: 'strap', 'Body region': 'knee', Side: 'left' },
    suggests: ['29530-LT'],
  },
  {
    visit: 'Ankle or foot strapping',
    procedure: SPLINT,
    answers: { Device: 'strap', 'Body region': 'ankle/foot', Side: 'left' },
    suggests: ['29540-LT'],
  },
  {
    visit: 'An Unna boot applied',
    procedure: SPLINT,
    answers: { Device: 'strap', 'Body region': 'Unna boot', Side: 'left' },
    suggests: ['29580-LT'],
  },
  {
    visit: 'An off-the-shelf brace simply handed to the patient',
    procedure: SPLINT,
    answers: { Device: 'prefabricated orthotic', 'Body region': 'forearm', Side: 'left' },
    suggests: [],
    tells: 'Prefabricated-device application has no separate application code.',
  },
  {
    visit: 'The splint was part of setting a fracture, so the fracture code covers it',
    procedure: SPLINT,
    answers: {
      Device: 'splint',
      'Body region': 'forearm',
      'Care context': 'definitive fracture care',
      'Fabricated from raw materials': true,
      Side: 'left',
    },
    suggests: [],
    tells:
      "This case needs a coder's judgment — Use the definitive fracture-treatment code; initial splint application is included.",
  },
];

// ════════════════════════════════════════════════════════════════════════════════════════════
//  5. INJECTIONS, DRIPS AND FLUIDS
// ════════════════════════════════════════════════════════════════════════════════════════════
//  Read the rules:
//    Medicare Claims Processing Manual, Chapter 12 §30.5 — the office/practitioner hierarchy:
//    which single administration is the "initial" one, and what counts as an extra hour:
//    https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c12.pdf
//    NCCI Policy Manual 2026, Chapter 11 §B — one initial code per visit, and fluid given to
//    carry a drug is not separately billable hydration:
//    https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf
export const INJECTION_VISITS: Visit[] = [
  {
    visit: 'One injection into the muscle',
    procedure: INJECTION,
    answers: { Administrations: [{ Route: 'IM/SC', Drug: 'ceftriaxone' }] },
    suggests: ['96372'],
  },
  {
    visit: 'One medication pushed into a vein',
    procedure: INJECTION,
    answers: { Administrations: [{ Route: 'IV push', Drug: 'ketorolac', 'IV access site': 'left arm' }] },
    suggests: ['96374'],
  },
  {
    visit: 'A drip of medication running an hour and a half',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV infusion', Drug: 'ceftriaxone', 'IV access site': 'left arm', Start: '10:00', Stop: '11:30' },
      ],
    },
    suggests: ['96365'],
  },
  {
    visit: 'A drip of medication running two and a half hours plus one minute — two extra hours become billable',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV infusion', Drug: 'vancomycin', 'IV access site': 'left arm', Start: '10:00', Stop: '12:31' },
      ],
    },
    suggests: ['96365', '96366 x2'],
  },
  {
    visit: 'A drip that ran only ten minutes counts as a push, not an infusion',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV infusion', Drug: 'ondansetron', 'IV access site': 'left arm', Start: '10:00', Stop: '10:10' },
      ],
    },
    suggests: ['96374'],
  },
  {
    visit: 'A drip of exactly 15 minutes is still a push',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV infusion', Drug: 'ondansetron', 'IV access site': 'left arm', Start: '10:00', Stop: '10:15' },
      ],
    },
    suggests: ['96374'],
  },
  {
    visit: 'One minute more and it becomes an infusion',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV infusion', Drug: 'ondansetron', 'IV access site': 'left arm', Start: '10:00', Stop: '10:16' },
      ],
    },
    suggests: ['96365'],
  },
  {
    visit: 'A drip of one hour thirty-one minutes — the first extra hour becomes billable',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV infusion', Drug: 'vancomycin', 'IV access site': 'left arm', Start: '10:00', Stop: '11:31' },
      ],
    },
    suggests: ['96365', '96366'],
  },
  {
    visit: 'A drip of two hours thirty — still only one extra hour',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV infusion', Drug: 'vancomycin', 'IV access site': 'left arm', Start: '10:00', Stop: '12:30' },
      ],
    },
    suggests: ['96365', '96366'],
  },
  {
    visit: 'Plain fluids for dehydration, running one hour',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV hydration', Drug: 'normal saline', 'IV access site': 'left arm', Start: '10:00', Stop: '11:00' },
      ],
    },
    suggests: ['96360'],
  },
  {
    visit: 'Plain fluids running two and a half hours plus one minute',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV hydration', Drug: 'normal saline', 'IV access site': 'left arm', Start: '10:00', Stop: '12:31' },
      ],
    },
    suggests: ['96360', '96361 x2'],
  },
  {
    visit: 'Plain fluids for only half an hour — too short to bill',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV hydration', Drug: 'normal saline', 'IV access site': 'left arm', Start: '10:00', Stop: '10:30' },
      ],
    },
    suggests: [],
    tells: 'Fluid replacement shorter than 31 minutes is not reported separately.',
  },
  {
    visit: 'Fluids and a medication drip in the same visit — a coder decides which one leads',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV hydration', Drug: 'normal saline', 'IV access site': 'left arm', Start: '10:00', Stop: '11:00' },
        { Route: 'IV infusion', Drug: 'ceftriaxone', 'IV access site': 'left arm', Start: '11:00', Stop: '12:00' },
      ],
    },
    suggests: [],
    tells:
      "This case needs a coder's judgment — Fluid replacement given alongside a medication in this visit needs a coder to assign the codes.",
  },
];

// ════════════════════════════════════════════════════════════════════════════════════════════
//  6. HEART TRACING (EKG)
// ════════════════════════════════════════════════════════════════════════════════════════════
//  Read the rules:
//    Medicare Claims Processing Manual, Chapter 13 §100.1 — tracing, interpretation and report:
//    https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c13.pdf
//    NCCI Policy Manual 2026, Chapter 11 §I:
//    https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf
export const EKG_VISITS: Visit[] = [
  {
    visit: 'The practice recorded the tracing and wrote the report',
    procedure: EKG,
    answers: { 'Component furnished': 'tracing and report' },
    suggests: ['93000'],
  },
  {
    visit: 'The practice only recorded the tracing; someone else reads it',
    procedure: EKG,
    answers: { 'Component furnished': 'tracing only' },
    suggests: ['93005'],
  },
  {
    visit: 'The practice only read a tracing recorded elsewhere',
    procedure: EKG,
    answers: { 'Component furnished': 'interpretation/report only' },
    suggests: ['93010'],
  },
  {
    visit: 'Two tracings the same day by the same clinician',
    procedure: EKG,
    answers: { 'Component furnished': 'tracing and report', 'Same-day recordings': 2 },
    suggests: ['93000', '93000-76'],
  },
  {
    visit: 'Two tracings the same day by different clinicians',
    procedure: EKG,
    answers: { 'Component furnished': 'tracing and report', 'Same-day recordings': 2, 'Repeat clinician': 'different' },
    suggests: ['93000', '93000-77'],
  },
  {
    visit: 'The tracing was part of a stress test, so it is not billed on its own',
    procedure: EKG,
    answers: { 'Component furnished': 'tracing and report', 'ECG integral to stress testing or monitoring': true },
    suggests: [],
    tells: 'The ECG is included in the stress test or monitoring service.',
  },
];

// ════════════════════════════════════════════════════════════════════════════════════════════
//  7. BURNS
// ════════════════════════════════════════════════════════════════════════════════════════════
//  Read the rules:
//    NCCI MUE table — the daily unit allowance used for the burn codes:
//    https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits-mues
//    ACEP Coding and Nomenclature Committee, 2019 — how burn treatment is documented and the
//    body-surface bands (corroboration, not a CPT codebook):
//    https://www.acepnow.com/article/coding-wizard-how-to-document-burn-treatment/
export const BURN_VISITS: Visit[] = [
  {
    visit: 'A first-degree burn treated',
    procedure: BURN,
    answers: { 'Deepest burn degree treated': 'first' },
    suggests: ['16000'],
  },
  {
    visit: 'A blistering burn just under 5% of the body',
    procedure: BURN,
    answers: { 'Deepest burn degree treated': 'partial thickness', 'Treated partial-thickness body surface (%)': 4.9 },
    suggests: ['16020'],
  },
  {
    visit: 'A blistering burn at exactly 5% — the band starts here',
    procedure: BURN,
    answers: { 'Deepest burn degree treated': 'partial thickness', 'Treated partial-thickness body surface (%)': 5 },
    suggests: ['16025'],
  },
  {
    visit: 'A blistering burn at exactly 10% — still the middle band',
    procedure: BURN,
    answers: { 'Deepest burn degree treated': 'partial thickness', 'Treated partial-thickness body surface (%)': 10 },
    suggests: ['16025'],
  },
  {
    visit: 'A blistering burn just over 10%',
    procedure: BURN,
    answers: { 'Deepest burn degree treated': 'partial thickness', 'Treated partial-thickness body surface (%)': 10.1 },
    suggests: ['16030'],
  },
  {
    visit: 'A full-thickness burn — coded outside this set',
    procedure: BURN,
    answers: { 'Deepest burn degree treated': 'full thickness' },
    suggests: [],
    tells:
      "This case needs a coder's judgment — Treatment of a full-thickness burn is coded outside the local burn treatment codes.",
  },
];

// ════════════════════════════════════════════════════════════════════════════════════════════
//  8. THE REMAINING PROCEDURES
// ════════════════════════════════════════════════════════════════════════════════════════════
//  Read the rules — one line per procedure in this section:
//    Warts and other benign lesions — MAC article A57482 gives the 1–14 / 15+ lesion bands:
//    https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid=57482
//    Bladder catheter — NCCI Chapter 7: catheter insertion is part of a surgical package:
//    https://www.cms.gov/files/document/07-chapter7-ncci-medicare-policy-manual-2026-final.pdf
//    Nosebleed packing — NCCI Chapter 5 §C.5: bleeding control during a scope is not separate:
//    https://www.cms.gov/files/document/05-chapter5-ncci-medicare-policy-manual-2026-final.pdf
//    Nursemaid's elbow — NCCI Chapter 4 (dislocation bundling) and RVU26A row 24640:
//    https://www.cms.gov/files/document/04-chapter4-ncci-medicare-policy-manual-2026-final.pdf
//    Nail trephination — NCCI Chapter 3 and RVU26A row 11740:
//    https://www.cms.gov/files/document/03-chapter3-ncci-medicare-policy-manual-2026-final.pdf
//    Nebulizer and IV placement — NCCI Chapter 11 §J.7–8 (one treatment per episode) and §B.4
//    (the IV line is part of the administration it serves):
//    https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf
export const OTHER_VISITS: Visit[] = [
  {
    visit: 'One wart frozen off',
    procedure: LESION,
    answers: { 'Lesion category': 'benign (excluding tags/vascular)' },
    suggests: ['17110'],
  },
  {
    visit: 'Fourteen warts — still the first code',
    procedure: LESION,
    answers: { 'Lesion category': 'benign (excluding tags/vascular)', 'Lesion count': 14 },
    suggests: ['17110'],
  },
  {
    visit: 'Fifteen warts — the code changes here',
    procedure: LESION,
    answers: { 'Lesion category': 'benign (excluding tags/vascular)', 'Lesion count': 15 },
    suggests: ['17111'],
  },
  {
    visit: 'Skin tags removed — a different code family',
    procedure: LESION,
    answers: { 'Lesion category': 'skin tags' },
    suggests: [],
    tells: "This case needs a coder's judgment — Use the code family for this lesion category.",
  },
  {
    visit: 'A straight catheter passed and removed',
    procedure: CATHETER,
    answers: { 'Catheter type': 'straight' },
    suggests: ['51701'],
  },
  {
    visit: 'A catheter left in place',
    procedure: CATHETER,
    answers: { 'Catheter type': 'indwelling' },
    suggests: ['51702'],
  },
  {
    visit: 'A catheter left in place after a difficult insertion',
    procedure: CATHETER,
    answers: { 'Catheter type': 'indwelling', 'Complicated indwelling insertion': true },
    suggests: ['51703'],
  },
  {
    visit: 'A catheter passed only to collect a urine sample — Medicare has its own code for that',
    procedure: CATHETER,
    answers: { 'Catheter type': 'straight', Purpose: 'specimen only' },
    suggests: ['51701', 'P9612'],
  },
  {
    visit: 'The catheter was part of another procedure',
    procedure: CATHETER,
    answers: { 'Catheter type': 'straight', 'Part of another procedure': true },
    suggests: [],
    tells: 'Catheterization is included in the other procedure.',
  },
  {
    visit: 'A nosebleed on the left stopped with cautery',
    procedure: NOSEBLEED,
    answers: { 'Left anterior treatment': 'limited' },
    suggests: ['30901-LT'],
  },
  {
    visit: 'A stubborn nosebleed on the left needing repeated attempts',
    procedure: NOSEBLEED,
    answers: { 'Left anterior treatment': 'extensive' },
    suggests: ['30903-LT'],
  },
  {
    visit: 'Both nostrils treated the same way — one line, both sides',
    procedure: NOSEBLEED,
    answers: { 'Left anterior treatment': 'limited', 'Right anterior treatment': 'limited' },
    suggests: ['30901-50'],
  },
  {
    visit: 'Left nostril stubborn, right one simple — two lines, the lesser one marked as separate work',
    procedure: NOSEBLEED,
    answers: { 'Left anterior treatment': 'extensive', 'Right anterior treatment': 'limited' },
    suggests: ['30903-LT', '30901-RT-59'],
  },
  {
    visit: 'A bleed from the back of the nose treated for the first time',
    procedure: NOSEBLEED,
    answers: { 'Posterior treatment': 'first', 'Posterior side': 'left' },
    suggests: ['30905'],
  },
  {
    visit: 'A bleed from the back of the nose treated again',
    procedure: NOSEBLEED,
    answers: { 'Posterior treatment': 'repeat', 'Posterior side': 'left' },
    suggests: ['30906'],
  },
  {
    visit: 'Only a temporary pledget was used — nothing separately billable',
    procedure: NOSEBLEED,
    answers: { 'Left anterior treatment': 'temporary pledget only' },
    suggests: [],
    tells: 'No separately coded cautery or retained packing documented.',
  },
  {
    visit: 'The bleeding was caused by another nasal procedure, so it is part of that one',
    procedure: NOSEBLEED,
    answers: { 'Left anterior treatment': 'limited', 'Bleeding caused by another nasal procedure': true },
    suggests: [],
    tells: 'Bleeding control is included in the procedure that caused it.',
  },
  {
    visit: 'An endoscope was needed to control the bleeding',
    procedure: NOSEBLEED,
    answers: {
      'Left anterior treatment': 'limited',
      'Bleeding control required an endoscope (not visualization alone)': true,
    },
    suggests: [],
    tells: "This case needs a coder's judgment — Endoscopic bleeding control needs a different procedure code.",
  },
  {
    visit: "A child's pulled elbow put back",
    procedure: ELBOW,
    answers: { Condition: 'subluxation' },
    suggests: ['24640'],
  },
  {
    visit: 'A true dislocation or fracture, not a pulled elbow',
    procedure: ELBOW,
    answers: { Condition: 'true dislocation/fracture' },
    suggests: [],
    tells: "This case needs a coder's judgment — The documented condition is not confirmed radial-head subluxation.",
  },
  {
    visit: 'Blood released from under one nail',
    procedure: NAIL,
    answers: {},
    suggests: ['11740'],
  },
  {
    visit: 'Blood released from under two nails',
    procedure: NAIL,
    answers: { 'Digits treated': 2 },
    suggests: ['11740 x2'],
  },
  {
    visit: 'The nail was taken off — a different code',
    procedure: NAIL,
    answers: { 'Nail removed': true },
    suggests: [],
    tells: "This case needs a coder's judgment — Nail removal or nail-bed repair uses other codes.",
  },
  {
    visit: 'One breathing treatment given',
    procedure: NEBULIZER,
    answers: {},
    suggests: ['94640'],
  },
  {
    visit: 'Two separate breathing treatments the same day',
    procedure: NEBULIZER,
    answers: { 'Episodes of care': 2 },
    suggests: ['94640', '94640-76'],
  },
  {
    visit: 'Continuous breathing treatment lasting over an hour',
    procedure: NEBULIZER,
    answers: { 'Continuous treatment over one hour': true },
    suggests: [],
    tells:
      "This case needs a coder's judgment — Continuous inhalation treatment lasting over one hour is coded separately.",
  },
  {
    visit: 'A drip line put in and nothing else — charting it is the documentation',
    procedure: IV_LINE,
    answers: {},
    suggests: ['36000'],
  },
];

// ════════════════════════════════════════════════════════════════════════════════════════════
//  9. WOUND REPAIR — the code depends on where the wound is, how deep the repair was,
//     and how long the wound is. Read each table as: this site, this length → this code.
//     A length is the first length that falls into that band.
// ════════════════════════════════════════════════════════════════════════════════════════════
//  Read the rules:
//    ACEP Wound Repair FAQ §§2–10 — simple vs. intermediate vs. complex, and when the lengths
//    of several wounds are added together:
//    https://www.acep.org/administration/reimbursement/reimbursement-faqs/wound-repair
//    NCCI Policy Manual 2026, Chapter 3 §H and §L — repair bundling:
//    https://www.cms.gov/files/document/03-chapter3-ncci-medicare-policy-manual-2026-final.pdf

/** Stitches through the skin only. */
export const SIMPLE_REPAIR: [site: string, lengthCm: number, code: string][] = [
  ['trunk', 1, '12001'],
  ['trunk', 2.6, '12002'],
  ['trunk', 7.6, '12004'],
  ['trunk', 12.6, '12005'],
  ['trunk', 20.1, '12006'],
  ['trunk', 30.1, '12007'],
  ['face', 1, '12011'],
  ['face', 2.6, '12013'],
  ['face', 5.1, '12014'],
  ['face', 7.6, '12015'],
  ['face', 12.6, '12016'],
  ['face', 20.1, '12017'],
  ['face', 30.1, '12018'],
];

/** A deeper repair: here the wound was heavily contaminated and needed extensive cleaning. */
export const INTERMEDIATE_REPAIR: [site: string, lengthCm: number, code: string][] = [
  ['trunk', 1, '12031'],
  ['trunk', 2.6, '12032'],
  ['trunk', 7.6, '12034'],
  ['trunk', 12.6, '12035'],
  ['trunk', 20.1, '12036'],
  ['trunk', 30.1, '12037'],
  ['neck', 1, '12041'],
  ['neck', 2.6, '12042'],
  ['neck', 7.6, '12044'],
  ['neck', 12.6, '12045'],
  ['neck', 20.1, '12046'],
  ['neck', 30.1, '12047'],
  ['face', 1, '12051'],
  ['face', 2.6, '12052'],
  ['face', 5.1, '12053'],
  ['face', 7.6, '12054'],
  ['face', 12.6, '12055'],
  ['face', 20.1, '12056'],
  ['face', 30.1, '12057'],
];

/** The hardest repairs: contaminated AND with bone, cartilage or tendon showing. Past 7.5 cm
 *  the extra length is billed with a second, add-on code, one unit per extra 5 cm started. */
export const COMPLEX_REPAIR: [site: string, lengthCm: number, codes: string[]][] = [
  ['trunk', 2, ['13100']],
  ['trunk', 2.6, ['13101']],
  ['trunk', 7.5, ['13101']],
  ['trunk', 7.6, ['13101', '13102']],
  ['trunk', 12.5, ['13101', '13102']],
  ['trunk', 12.6, ['13101', '13102 x2']],
  ['trunk', 17.6, ['13101', '13102 x3']],
  ['scalp', 2, ['13120']],
  ['scalp', 2.6, ['13121']],
  ['scalp', 7.6, ['13121', '13122']],
  ['neck', 2, ['13131']],
  ['neck', 2.6, ['13132']],
  ['neck', 7.6, ['13132', '13133']],
  ['eyelid', 2, ['13151']],
  ['eyelid', 2.6, ['13152']],
  ['eyelid', 7.6, ['13152', '13153']],
];

export const WOUND_REPAIR_VISITS: Visit[] = [
  {
    visit: 'One 2 cm cut on the trunk closed with a single layer of stitches',
    procedure: LACERATION,
    answers: { Wounds: [{ Site: 'trunk', 'Length (cm)': 2, Closure: 'single layer' }] },
    suggests: ['12001'],
  },
  {
    visit: 'Two cuts of the same kind — their lengths are added together before choosing the code',
    procedure: LACERATION,
    answers: {
      Wounds: [
        { Site: 'trunk', 'Length (cm)': 2, Closure: 'single layer' },
        { Site: 'arm', 'Length (cm)': 3, Closure: 'single layer' },
      ],
    },
    suggests: ['12002'],
  },
  {
    visit: 'A cut glued shut — Medicare has its own code for glue-only closure',
    procedure: LACERATION,
    answers: { Wounds: [{ Site: 'trunk', 'Length (cm)': 2, Closure: 'adhesive only' }] },
    suggests: ['12001', 'G0168'],
  },
  {
    visit: 'A cut closed with adhesive strips only — no repair code',
    procedure: LACERATION,
    answers: { Wounds: [{ Site: 'trunk', 'Length (cm)': 2, Closure: 'strips only' }] },
    suggests: [],
    tells: 'No separate repair code for the documented closure.',
  },
  {
    visit: 'A flap was deliberately created — that is reconstructive surgery, not a repair',
    procedure: LACERATION,
    answers: {
      Wounds: [
        {
          Site: 'trunk',
          'Length (cm)': 2,
          Closure: 'single layer',
          'Deliberately developed adjacent tissue transfer': true,
        },
      ],
    },
    suggests: [],
    tells: "This case needs a coder's judgment — Use reconstructive tissue-transfer codes.",
  },
];

// ════════════════════════════════════════════════════════════════════════════════════════════
//  10. WHEN THE FORM IS NOT FINISHED — the system must ask, never guess.
//      Each line: what is left blank → the exact sentence the provider must see.
// ════════════════════════════════════════════════════════════════════════════════════════════
//  No outside source to read here: this is the product rule that the system asks rather than
//  guesses. The wording below is what the provider must see on screen.
export const UNFINISHED_FORMS: { visit: string; procedure: string; answers: FormAnswers; asksFor: string[] }[] = [
  {
    visit: 'The form was opened and nothing filled in — one wound row is waiting',
    procedure: LACERATION,
    answers: {},
    asksFor: ['Wound 1: Site', 'Wound 1: Closure'],
  },
  {
    visit: 'A wound with a length but no site and no closure',
    procedure: LACERATION,
    answers: { Wounds: [{ 'Length (cm)': 2 }] },
    asksFor: ['Wound 1: Site', 'Wound 1: Closure'],
  },
  {
    visit: 'A first wound is complete, a second one was added and left blank',
    procedure: LACERATION,
    answers: { Wounds: [{ Site: 'trunk', 'Length (cm)': 2, Closure: 'single layer' }, {}] },
    asksFor: ['Wound 2: Site', 'Wound 2: Closure'],
  },
  {
    visit: 'A wound with a site and closure but no length',
    procedure: LACERATION,
    answers: { Wounds: [{ Site: 'trunk', Closure: 'single layer' }] },
    asksFor: ['Wound 1: Length (cm)'],
  },
  {
    visit: 'Nothing answered about the drainage',
    procedure: DRAINAGE,
    answers: {},
    asksFor: ['Collection type', 'Drainage method'],
  },
  {
    visit: 'No administration has been added yet',
    procedure: INJECTION,
    answers: { Administrations: [] },
    asksFor: ['Administrations'],
  },
  {
    visit: 'A second administration was added and left blank',
    procedure: INJECTION,
    answers: {
      Administrations: [{ Route: 'IV push', Drug: 'ketorolac', 'IV access site': 'left arm' }, {}],
    },
    asksFor: ['Administration 2: Route', 'Administration 2: Drug'],
  },
  {
    visit: 'An infusion with no start and stop time',
    procedure: INJECTION,
    answers: { Administrations: [{ Route: 'IV infusion', Drug: 'ceftriaxone', 'IV access site': 'left arm' }] },
    asksFor: ['Administration 1: Start', 'Administration 1: Stop'],
  },
  {
    visit: 'The burn degree has not been chosen',
    procedure: BURN,
    answers: {},
    asksFor: ['Deepest burn degree treated'],
  },
  {
    visit: 'A blistering burn with no surface area given',
    procedure: BURN,
    answers: { 'Deepest burn degree treated': 'partial thickness' },
    asksFor: ['Treated partial-thickness body surface (%)'],
  },
  {
    visit: 'The EKG component has not been chosen',
    procedure: EKG,
    answers: {},
    asksFor: ['Component furnished'],
  },
  {
    visit: 'The catheter type has not been chosen',
    procedure: CATHETER,
    answers: {},
    asksFor: ['Catheter type'],
  },
  {
    visit: 'The lesion category has not been chosen',
    procedure: LESION,
    answers: {},
    asksFor: ['Lesion category'],
  },
  {
    visit: 'The elbow condition has not been chosen',
    procedure: ELBOW,
    answers: {},
    asksFor: ['Condition'],
  },
  {
    visit: 'The splint device and body region have not been chosen',
    procedure: SPLINT,
    answers: { 'Fabricated from raw materials': true },
    asksFor: ['Device', 'Body region'],
  },
  {
    visit: 'A back-of-the-nose bleed was treated but the side is missing',
    procedure: NOSEBLEED,
    answers: { 'Posterior treatment': 'first' },
    asksFor: ['Posterior side'],
  },
  {
    visit: 'The foreign body location has not been chosen',
    procedure: FOREIGN_BODY,
    answers: {},
    asksFor: ['Foreign body location'],
  },
];

// ════════════════════════════════════════════════════════════════════════════════════════════
//  11. EVERY VISIT IN ONE LIST — the tests run this list from top to bottom.
// ════════════════════════════════════════════════════════════════════════════════════════════
export const ALL_VISITS: Visit[] = [
  ...EAR_WAX,
  ...DRAINAGE_VISITS,
  ...FOREIGN_BODY_VISITS,
  ...SPLINT_VISITS,
  ...INJECTION_VISITS,
  ...EKG_VISITS,
  ...BURN_VISITS,
  ...OTHER_VISITS,
  ...WOUND_REPAIR_VISITS,
];

// ════════════════════════════════════════════════════════════════════════════════════════════
//  12. CHECKING THE CODES ALREADY ON THE BILL
//      The first table above is about what the system SUGGESTS. This one is the other direction:
//      the provider has put a code on the visit, and the system says whether the answers back it up.
//
//      verdict 'supported'    — the answers produce exactly this code
//      verdict 'not supported' — the answers produce something else; `because` is what the provider reads
//      verdict 'not checked'  — the code is outside this procedure's rules, so the system leaves it alone
// ════════════════════════════════════════════════════════════════════════════════════════════
//  Read the rules:
//    NCCI MUE table — the usual daily unit allowance per code:
//    https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits-mues
//    NCCI PTP edits — which two codes may not be billed for the same visit:
//    https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits
export const CODE_CHECKS: {
  visit: string;
  procedure: string;
  answers: FormAnswers;
  billed: { code: string; units?: number; modifiers?: string[] };
  verdict: 'supported' | 'not supported' | 'not checked';
  because?: string;
}[] = [
  {
    visit: 'A 2 cm trunk cut, single layer — and 12001 is on the bill',
    procedure: LACERATION,
    answers: { Wounds: [{ Site: 'trunk', 'Length (cm)': 2, Closure: 'single layer' }] },
    billed: { code: '12001' },
    verdict: 'supported',
  },
  {
    visit: 'The same 2 cm cut, but a longer-wound code was billed',
    procedure: LACERATION,
    answers: { Wounds: [{ Site: 'trunk', 'Length (cm)': 2, Closure: 'single layer' }] },
    billed: { code: '12004' },
    verdict: 'not supported',
    because: 'The answers support 12001 instead.',
  },
  {
    visit: 'An office-visit code sits on the same visit — not this procedure’s business',
    procedure: LACERATION,
    answers: { Wounds: [{ Site: 'trunk', 'Length (cm)': 2, Closure: 'single layer' }] },
    billed: { code: '99213' },
    verdict: 'not checked',
  },
  {
    visit: 'One abscess drained, and the multiple-abscess code was billed',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'abscess', 'Drainage method': 'incision' },
    billed: { code: '10061' },
    verdict: 'not supported',
    because: 'The answers support 10060 instead.',
  },
  {
    visit: 'One abscess drained, and the simple code was billed',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'abscess', 'Drainage method': 'incision' },
    billed: { code: '10060' },
    verdict: 'supported',
  },
  {
    visit: 'Five collections aspirated and five units billed',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'abscess', 'Drainage method': 'needle', 'Distinct collections': 5 },
    billed: { code: '10160', units: 5 },
    verdict: 'supported',
  },
  {
    visit: 'Five collections aspirated but only one unit billed',
    procedure: DRAINAGE,
    answers: { 'Collection type': 'abscess', 'Drainage method': 'needle', 'Distinct collections': 5 },
    billed: { code: '10160', units: 1 },
    verdict: 'not supported',
    because: 'The answers support 5 units of 10160; 1 unit selected.',
  },
  {
    visit: 'Both ears irrigated and billed as one bilateral line',
    procedure: CERUMEN,
    answers: {
      'Impaction established by': 'inflammation',
      'Left ear removal method': 'irrigation',
      'Right ear removal method': 'irrigation',
    },
    billed: { code: '69209', modifiers: ['50'] },
    verdict: 'supported',
  },
  {
    visit: 'Both ears irrigated but the bilateral modifier was left off',
    procedure: CERUMEN,
    answers: {
      'Impaction established by': 'inflammation',
      'Left ear removal method': 'irrigation',
      'Right ear removal method': 'irrigation',
    },
    billed: { code: '69209' },
    verdict: 'not supported',
    because: 'The answers support 69209 with modifier 50.',
  },
  {
    visit: 'The practice recorded and read the tracing, but only the tracing code was billed',
    procedure: EKG,
    answers: { 'Component furnished': 'tracing and report' },
    billed: { code: '93005' },
    verdict: 'not supported',
    // Flagged, never blocked: the provider is told the documentation supports more.
    because:
      'Documentation supports the full recording with interpretation and report; a component-only code is selected.',
  },
  {
    visit: 'A blistering burn over 3% billed as the small-area code',
    procedure: BURN,
    answers: { 'Deepest burn degree treated': 'partial thickness', 'Treated partial-thickness body surface (%)': 3 },
    billed: { code: '16020' },
    verdict: 'supported',
  },
  {
    visit: 'Two recordings, and the repeat was billed with the wrong modifier',
    procedure: EKG,
    answers: { 'Component furnished': 'tracing and report', 'Same-day recordings': 2 },
    billed: { code: '93000', modifiers: ['59'] },
    verdict: 'not supported',
    because: 'The answers support 93000 with no modifier and with modifier 76.',
  },
  {
    visit: 'Half an hour of fluid replacement billed as the hydration hour',
    procedure: INJECTION,
    answers: {
      Administrations: [
        { Route: 'IV hydration', Drug: 'normal saline', 'IV access site': 'left arm', Start: '10:00', Stop: '10:30' },
      ],
    },
    billed: { code: '96360' },
    verdict: 'not supported',
    because: 'The answers support no code for this service.',
  },
  {
    visit: 'A code billed while the form is still unfinished — nothing is judged yet',
    procedure: LACERATION,
    answers: { Wounds: [{ Site: 'trunk', 'Length (cm)': 2 }] },
    billed: { code: '12001' },
    verdict: 'not checked',
  },
];

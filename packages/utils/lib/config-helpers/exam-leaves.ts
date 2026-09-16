// Flatten the exam config into a list of SELECTABLE LEAVES: every checkbox a provider can tick,
// with the label they read and the body-system card it sits under.
//
// This is a shared config helper rather than Easy Chart's own, because it is the exam config's own
// shape being described — a quick-add search, a keyboard palette or a config audit all want the same
// list. `buildExamFieldToSectionMap` already walks this tree for section grouping; this walks it for
// the labels, which is what anything matching free text against the exam needs.

import type {
  ExamCardComponent,
  ExamCardNonTextComponent,
  ExamItemConfig,
  ExamModalWithColumnsSection,
} from 'config-types';
import { isDropdownComponent, isMultiSelectComponent } from '../ottehr-config/examination/examination.schema';

export interface ExamLeaf {
  /**
   * The SAVEABLE chart-data field. For a modal option this is the PARENT checkbox's field, not the
   * option's own key: `getAllExamFieldsMetadata` only registers the parent, and save-chart-data rejects
   * anything else with "Exam observation with field … not found".
   */
  field: string;
  /** What the provider reads, fully qualified ("Right: Appearance: Swelling"). */
  label: string;
  /** Just the leaf's own words, without the path. What free text is actually matched against. */
  leafLabel: string;
  /** Body-system card, e.g. "Ears". An exam finding must not be filed under a different one. */
  sectionKey: string;
  sectionLabel: string;
  /** Which side of the card it sits on. A normal is not an abnormal finding and vice versa. */
  polarity: 'normal' | 'abnormal';
  /** The path from the card down to the leaf, for disambiguating in a picker. */
  path: string[];
  /**
   * Set when this leaf is an option inside a checkbox-with-modal. Such an option is NOT its own
   * observation — it is stored as a component of `field`, so the write has to build the component
   * rather than a second row.
   */
  component?: { code: string; label: string; groupLabel: string; columnLabel?: string; abnormal?: boolean };
}

/**
 * Every selectable leaf in an exam config, in config order.
 *
 * NOTE: several leaves can share one `field` — a checkbox-with-modal's options all save into the
 * parent observation, distinguished by their `component`. Do not key a map on `field` alone.
 */
export function buildExamLeafCatalogue(examConfig: ExamItemConfig): ExamLeaf[] {
  const leaves: ExamLeaf[] = [];

  const push = (
    field: string,
    leafLabel: string,
    path: string[],
    sectionKey: string,
    sectionLabel: string,
    polarity: 'normal' | 'abnormal',
    component?: ExamLeaf['component']
  ): void => {
    if (!leafLabel?.trim()) return;
    leaves.push({
      field,
      leafLabel,
      label: [...path, leafLabel].filter(Boolean).join(': '),
      sectionKey,
      sectionLabel,
      polarity,
      path,
      ...(component ? { component } : {}),
    });
  };

  const walkModal = (
    modal: Record<string, ExamModalWithColumnsSection>,
    parentField: string,
    path: string[],
    sectionKey: string,
    sectionLabel: string,
    polarity: 'normal' | 'abnormal'
  ): void => {
    for (const section of Object.values(modal)) {
      for (const column of Object.values(section.columns)) {
        // The column header is the laterality ("Left"/"Right") and is load-bearing: an abnormal on
        // one side must not match the normal on the other.
        const columnPath = [...path, section.label, column.header ?? ''].filter(Boolean);
        for (const group of Object.values(column.groups)) {
          for (const [optionKey, option] of Object.entries(group.options)) {
            push(
              // The PARENT's field, not `optionKey`. An option key is not a saveable observation —
              // saving one returns "Exam observation with field … not found".
              parentField,
              option.label,
              [...columnPath, group.label],
              sectionKey,
              sectionLabel,
              // A modal option declares its own polarity, which is more reliable than the side of
              // the card the modal's checkbox happens to live on.
              option.abnormal === false ? 'normal' : option.abnormal === true ? 'abnormal' : polarity,
              {
                code: optionKey,
                label: option.label,
                groupLabel: group.label,
                ...(column.header ? { columnLabel: column.header } : {}),
                ...(option.abnormal != null ? { abnormal: option.abnormal } : {}),
              }
            );
          }
        }
      }
    }
  };

  const walk = (
    components: Record<string, ExamCardComponent>,
    path: string[],
    sectionKey: string,
    sectionLabel: string,
    polarity: 'normal' | 'abnormal'
  ): void => {
    for (const [field, component] of Object.entries(components)) {
      switch (component.type) {
        // Comment boxes are free text, not selectable findings.
        case 'text':
          break;
        case 'checkbox':
          // A legacy field is only rendered when it already holds data, so it must never be a
          // match target for something new.
          if (!component.legacy) push(field, component.label, path, sectionKey, sectionLabel, polarity);
          break;
        case 'checkbox-with-modal':
          push(field, component.label, path, sectionKey, sectionLabel, polarity);
          walkModal(component.modal, field, [...path, component.label], sectionKey, sectionLabel, polarity);
          break;
        case 'dropdown':
          if (isDropdownComponent(component)) {
            for (const [optionField, option] of Object.entries(component.components)) {
              push(optionField, option.label, [...path, component.label], sectionKey, sectionLabel, polarity);
            }
          }
          break;
        case 'multi-select':
          if (isMultiSelectComponent(component)) {
            for (const [optionField, option] of Object.entries(component.options)) {
              push(optionField, option.label, [...path, component.label], sectionKey, sectionLabel, polarity);
            }
          }
          break;
        case 'column':
          walk(component.components, [...path, component.label].filter(Boolean), sectionKey, sectionLabel, polarity);
          break;
        case 'form':
          for (const field2 of Object.keys(component.components)) {
            push(field2, humanizeFieldName(field2), [...path, component.label], sectionKey, sectionLabel, polarity);
          }
          break;
      }
    }
  };

  for (const [sectionKey, card] of Object.entries(examConfig)) {
    walk(card.components.normal as Record<string, ExamCardNonTextComponent>, [], sectionKey, card.label, 'normal');
    walk(card.components.abnormal as Record<string, ExamCardNonTextComponent>, [], sectionKey, card.label, 'abnormal');
  }

  return leaves;
}

/**
 * Form elements are keyed rather than labelled, so the key IS the label a provider sees. Mirrors the
 * formatting `extractObservationsFromExamComponents` already applies to the same keys.
 */
function humanizeFieldName(fieldName: string): string {
  return fieldName
    .split('-')
    .map((word) =>
      word
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())
        .trim()
    )
    .join(' ');
}

/**
 * Each exam card's free-text COMMENT field, keyed by both section key and section label.
 *
 * The exam tab is mostly checkboxes plus one free-text area per card. That area is where a dictated
 * observation goes when the checkbox catalogue cannot represent it: "positive Homan's sign" is a real
 * finding with no leaf to tick, and the alternative to writing it here is losing the provider's words
 * entirely. Keyed by both because a caller may hold either — the leaf catalogue carries `sectionKey`,
 * while a section label is what a human-readable inference produces.
 */
export function buildExamCommentFields(examConfig: ExamItemConfig): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [sectionKey, card] of Object.entries(examConfig)) {
    const field = Object.keys(card.components.comment ?? {})[0];
    if (!field) continue;
    map[sectionKey] = field;
    if (card.label) map[card.label] = field;
  }
  return map;
}

/**
 * The exam card a free-text finding belongs to, or undefined when it cannot be told confidently.
 *
 * HIGH PRECISION OVER COVERAGE, deliberately: only a word from the CARD'S OWN NAME counts, and only
 * when exactly one card matches. A finding filed under the wrong body system is worse than one filed
 * under the general card — "Photophobia" appearing under Genitourinary is actively misleading in a
 * signed note, and that is what a scoring heuristic over leaf labels produced (it also sent "left ear
 * canal" to Lungs, on the strength of "tenderness" appearing in several chest-wall leaves).
 *
 * So this answers only the easy cases — "ear canal", "lung field", "abdomen soft" — and returns
 * undefined for everything else, which the caller files under the general card. Widening it means
 * adding an anatomy vocabulary curated to the same standard: a term that names exactly one card, and
 * nothing for a term that does not ("discharge" is any orifice; "vestibule" is nasal or vaginal).
 */
export function inferExamSectionKey(text: string, leaves: ExamLeaf[]): string | undefined {
  const words = new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  );
  if (words.size === 0) return undefined;

  const hits = new Set<string>();
  // Terms that name exactly ONE card but share no word with its name. Curated to the same standard as
  // the card-name match: a term that could belong to two cards is deliberately absent, so it falls
  // through to the general card rather than guessing.
  for (const word of words) {
    const section = singularForms(word)
      .map((form) => UNAMBIGUOUS_ANATOMY[form])
      .find((hit) => hit !== undefined);
    if (section) hits.add(section);
  }
  const seen = new Set<string>();
  for (const leaf of leaves) {
    if (seen.has(leaf.sectionKey)) continue;
    seen.add(leaf.sectionKey);
    const name = `${leaf.sectionKey} ${leaf.sectionLabel}`.toLowerCase().split(/[^a-z0-9]+/);
    for (const word of words) {
      // Whole word against whole word, tolerating only a plural 's' — substring matching makes "ear"
      // hit "smear" and "back" hit "backache" in another card's name, while a strict equality misses
      // the singular/plural split every card name has ("ear canal" vs the card "Ears").
      if (name.some((part) => part === word || part === `${word}s` || `${part}s` === word)) {
        hits.add(leaf.sectionKey);
      }
    }
  }
  return hits.size === 1 ? [...hits][0] : undefined;
}

/**
 * Anatomy that names exactly one exam card without sharing a word with its label. Every entry is a
 * term a clinician would only use about that one card; anything ambiguous ("discharge" is any orifice,
 * "vestibule" is nasal or vaginal, "effusion" is a knee or a pleura, "distress" is general or respiratory)
 * is deliberately absent so it falls through to the general card rather than guessing. Singular forms
 * only — the lookup strips a plural 's'/'es' — so "wheezes", "rhonchi", "nodes" all resolve. Before this
 * vocabulary covered every card, "scattered rhonchi" and "no wheezes" were filed under General Appearance.
 */
/** The forms a plural may take — "wheezes" → "wheeze", "crackles" → "crackle", "nodes" → "node", "varicosities" → "varicosity". */
const singularForms = (word: string): string[] => [
  word,
  ...(word.endsWith('s') ? [word.slice(0, -1)] : []),
  ...(word.endsWith('es') ? [word.slice(0, -2)] : []),
  ...(word.endsWith('ies') ? [`${word.slice(0, -3)}y`] : []),
];

const UNAMBIGUOUS_ANATOMY: Record<string, string> = {
  // Ears
  tympanic: 'ears',
  tm: 'ears',
  auricle: 'ears',
  auricular: 'ears',
  pinna: 'ears',
  tragus: 'ears',
  tragal: 'ears',
  otoscopy: 'ears',
  otoscopic: 'ears',
  cerumen: 'ears',
  otitis: 'ears',
  otorrhea: 'ears',
  hemotympanum: 'ears',
  mastoid: 'ears',
  // Eyes
  photophobia: 'eyes',
  conjunctiva: 'eyes',
  conjunctival: 'eyes',
  sclera: 'eyes',
  scleral: 'eyes',
  icterus: 'eyes',
  icteric: 'eyes',
  pupil: 'eyes',
  pupillary: 'eyes',
  cornea: 'eyes',
  corneal: 'eyes',
  eyelid: 'eyes',
  periorbital: 'eyes',
  extraocular: 'eyes',
  eom: 'eyes',
  ptosis: 'eyes',
  nystagmus: 'eyes',
  fundus: 'eyes',
  fundi: 'eyes',
  fundoscopic: 'eyes',
  acuity: 'eyes',
  // Nose
  nasal: 'nose',
  nares: 'nose',
  naris: 'nose',
  nostril: 'nose',
  turbinate: 'nose',
  septum: 'nose',
  septal: 'nose',
  rhinorrhea: 'nose',
  epistaxis: 'nose',
  sinus: 'nose',
  sinuses: 'nose',
  maxillary: 'nose',
  // Oral cavity
  pharynx: 'oral',
  pharyngeal: 'oral',
  oropharynx: 'oral',
  oropharyngeal: 'oral',
  peritonsillar: 'oral',
  tonsil: 'oral',
  tonsillar: 'oral',
  uvula: 'oral',
  uvular: 'oral',
  palate: 'oral',
  palatal: 'oral',
  gum: 'oral',
  gingiva: 'oral',
  gingival: 'oral',
  dentition: 'oral',
  tooth: 'oral',
  teeth: 'oral',
  dental: 'oral',
  tongue: 'oral',
  lingual: 'oral',
  buccal: 'oral',
  mouth: 'oral',
  lip: 'oral',
  trismus: 'oral',
  // Neck
  cervical: 'neck',
  thyroid: 'neck',
  thyromegaly: 'neck',
  trachea: 'neck',
  tracheal: 'neck',
  meningismus: 'neck',
  nuchal: 'neck',
  torticollis: 'neck',
  jvd: 'neck',
  jugular: 'neck',
  // Lymph nodes
  lymphadenopathy: 'lymph',
  lymph: 'lymph',
  node: 'lymph',
  adenopathy: 'lymph',
  lymphadenitis: 'lymph',
  // Skin, hair, nails
  rash: 'skin',
  urticaria: 'skin',
  hive: 'skin',
  petechiae: 'skin',
  purpura: 'skin',
  cellulitis: 'skin',
  abscess: 'skin',
  dermatitis: 'skin',
  eczema: 'skin',
  impetigo: 'skin',
  nail: 'skin',
  hair: 'skin',
  turgor: 'skin',
  wound: 'skin',
  laceration: 'skin',
  burn: 'skin',
  bite: 'skin',
  sting: 'skin',
  tinea: 'skin',
  scabies: 'skin',
  wart: 'skin',
  nevus: 'skin',
  mole: 'skin',
  // Heart
  murmur: 'heart',
  gallop: 'heart',
  rhythm: 'heart',
  s1: 'heart',
  s2: 'heart',
  s3: 'heart',
  s4: 'heart',
  systolic: 'heart',
  diastolic: 'heart',
  cardiac: 'heart',
  precordial: 'heart',
  pmi: 'heart',
  // Vascular
  pulse: 'vascular',
  pedal: 'vascular',
  capillary: 'vascular',
  refill: 'vascular',
  varicose: 'vascular',
  varicosity: 'vascular',
  homan: 'vascular',
  // Lungs, chest wall
  wheeze: 'lungs',
  wheezing: 'lungs',
  crackle: 'lungs',
  rale: 'lungs',
  rhonchi: 'lungs',
  rhonchus: 'lungs',
  stridor: 'lungs',
  breath: 'lungs',
  retraction: 'lungs',
  auscultation: 'lungs',
  expiratory: 'lungs',
  inspiratory: 'lungs',
  grunting: 'lungs',
  // Abdomen
  abdominal: 'abdomen',
  bowel: 'abdomen',
  epigastric: 'abdomen',
  periumbilical: 'abdomen',
  umbilical: 'abdomen',
  suprapubic: 'abdomen',
  rlq: 'abdomen',
  llq: 'abdomen',
  ruq: 'abdomen',
  luq: 'abdomen',
  quadrant: 'abdomen',
  hepatomegaly: 'abdomen',
  splenomegaly: 'abdomen',
  hepatosplenomegaly: 'abdomen',
  guarding: 'abdomen',
  rebound: 'abdomen',
  distension: 'abdomen',
  distention: 'abdomen',
  distended: 'abdomen',
  mcburney: 'abdomen',
  murphy: 'abdomen',
  rovsing: 'abdomen',
  psoas: 'abdomen',
  obturator: 'abdomen',
  // Back
  spinal: 'back',
  spine: 'back',
  paraspinal: 'back',
  lumbar: 'back',
  sacral: 'back',
  sacroiliac: 'back',
  cva: 'back',
  costovertebral: 'back',
  flank: 'back',
  scoliosis: 'back',
  kyphosis: 'back',
  vertebral: 'back',
  // Extremities
  wrist: 'extremities',
  ankle: 'extremities',
  knee: 'extremities',
  elbow: 'extremities',
  shoulder: 'extremities',
  hip: 'extremities',
  finger: 'extremities',
  toe: 'extremities',
  hand: 'extremities',
  foot: 'extremities',
  feet: 'extremities',
  forearm: 'extremities',
  calf: 'extremities',
  calves: 'extremities',
  thigh: 'extremities',
  digit: 'extremities',
  metacarpal: 'extremities',
  metatarsal: 'extremities',
  phalanx: 'extremities',
  phalanges: 'extremities',
  achilles: 'extremities',
  patella: 'extremities',
  patellar: 'extremities',
  clavicle: 'extremities',
  clavicular: 'extremities',
  humerus: 'extremities',
  ulna: 'extremities',
  ulnar: 'extremities',
  tibia: 'extremities',
  tibial: 'extremities',
  fibula: 'extremities',
  femur: 'extremities',
  rom: 'extremities',
  snuffbox: 'extremities',
  joint: 'extremities',
  ligament: 'extremities',
  drawer: 'extremities',
  lachman: 'extremities',
  mcmurray: 'extremities',
  // Neurologic
  neuro: 'neurologic',
  neurologic: 'neurologic',
  neurological: 'neurologic',
  cranial: 'neurologic',
  sensation: 'neurologic',
  sensory: 'neurologic',
  coordination: 'neurologic',
  cerebellar: 'neurologic',
  romberg: 'neurologic',
  babinski: 'neurologic',
  clonus: 'neurologic',
  gait: 'neurologic',
  ataxia: 'neurologic',
  ataxic: 'neurologic',
  dysmetria: 'neurologic',
  pronator: 'neurologic',
  // Psychiatric
  mood: 'psychiatric',
  affect: 'psychiatric',
  judgment: 'psychiatric',
  insight: 'psychiatric',
  suicidal: 'psychiatric',
  homicidal: 'psychiatric',
  hallucination: 'psychiatric',
  // General appearance
  lethargic: 'general',
  alert: 'general',
  oriented: 'general',
  consolable: 'general',
  playful: 'general',
  interactive: 'general',
  dehydrated: 'general',
  // Head
  scalp: 'head',
  skull: 'head',
  fontanelle: 'head',
  fontanel: 'head',
  atraumatic: 'head',
  normocephalic: 'head',
  forehead: 'head',
  occipital: 'head',
  tmj: 'head',
  // GU (male)
  penile: 'gu-male',
  penis: 'gu-male',
  scrotal: 'gu-male',
  scrotum: 'gu-male',
  testicular: 'gu-male',
  testicle: 'gu-male',
  testis: 'gu-male',
  testes: 'gu-male',
  foreskin: 'gu-male',
  cremasteric: 'gu-male',
  epididymis: 'gu-male',
  epididymal: 'gu-male',
  hydrocele: 'gu-male',
  varicocele: 'gu-male',
  phimosis: 'gu-male',
  // GU (female)
  vaginal: 'gu-female',
  vagina: 'gu-female',
  vulvar: 'gu-female',
  vulva: 'gu-female',
  labial: 'gu-female',
  labia: 'gu-female',
  introitus: 'gu-female',
  adnexal: 'gu-female',
  adnexa: 'gu-female',
  cervix: 'gu-female',
  uterine: 'gu-female',
  uterus: 'gu-female',
  bartholin: 'gu-female',
  speculum: 'gu-female',
  // Rectal
  rectal: 'rectal',
  rectum: 'rectal',
  anal: 'rectal',
  anus: 'rectal',
  perianal: 'rectal',
  perirectal: 'rectal',
  hemorrhoid: 'rectal',
  sphincter: 'rectal',
  prostate: 'rectal',
};

/** Words too generic to point at a body system. */
const STOP_WORDS = new Set([
  'with',
  'without',
  'positive',
  'negative',
  'mild',
  'moderate',
  'severe',
  'noted',
  'sign',
  // Laterality and vague position words identify no card.
  'left',
  'right',
  'bilateral',
  'over',
  'the',
  'and',
  'area',
  'region',
]);

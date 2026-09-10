import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { ScribeAnalysis } from './types';

/**
 * Stand-in for the ambient scribe AI. The real analysis is a separate project; this module only
 * exists so the review/edit/apply UX can be exercised end to end. It ignores the transcript
 * contents and returns a fixed set of recommendations that a real model could plausibly extract
 * from the sample transcript below.
 */

export const SAMPLE_TRANSCRIPT = `Provider: Good morning. What brings you in today?
Patient: I've had this post-nasal drip and pressure in my sinuses for about a week now. It's mostly the pressure at this point.
Provider: Any fever with it?
Patient: No fever. I checked a couple of times.
Provider: Ear pain? Sore throat?
Patient: No ear pain. My throat's fine too. It's really the sinuses, right here across my cheeks and forehead.
Provider: Headaches?
Patient: Yeah, headaches most afternoons. That's when it's the worst. I get a little dizzy when I stand up too fast.
Provider: Is anything still dripping down the back of your throat?
Patient: Not so much anymore, honestly. It was the first few days. Now it's the pressure, and my eyes have been kind of goopy in the morning.
Provider: Any discharge from the eyes during the day?
Patient: Just some crust in the morning, a little watery.
Provider: What have you been taking for it?
Patient: Ibuprofen when the headache gets bad. I don't remember the dose, whatever's in the bottle at home. And a sinus allergy med, Claritin or something like it, the one my wife takes.
Provider: Any allergies to medications?
Patient: Fentanyl. I had a bad reaction after my knee surgery.
Provider: Good to know. Do you know your current weight?
Patient: I'm about 170 pounds.
Provider: Okay. This sounds like a sinus infection on top of the drip. Let's take a look.`;

// Matches a template in the global-templates seed data so the first stage really applies
// against a seeded environment rather than failing on a name nothing has.
export const SAMPLE_TEMPLATE_NAME = 'Sinusitis';

const SAMPLE_ANALYSIS: ScribeAnalysis = {
  recommendations: [
    {
      id: 'template-sinusitis',
      kind: 'template',
      section: 'template',
      templateName: SAMPLE_TEMPLATE_NAME,
      evidence: 'This sounds like a sinus infection on top of the drip.',
    },
    {
      id: 'hpi-summary',
      kind: 'hpi',
      section: 'hpi',
      text: 'Patient reports having post-nasal drip and sinus pressure for 1 week.',
      evidence: "I've had this post-nasal drip and pressure in my sinuses for about a week now.",
    },
    {
      id: 'ros-eyes-discharge',
      kind: 'ros',
      section: 'ros',
      baseKey: 'ros-eyes-discharge',
      finding: RosFindingState.Reports,
      label: 'Discharge',
      systemLabel: 'Eyes',
      evidence: 'Just some crust in the morning, a little watery.',
    },
    {
      id: 'ros-constitutional-fever',
      kind: 'ros',
      section: 'ros',
      baseKey: 'ros-constitutional-fever',
      finding: RosFindingState.Denies,
      label: 'Fever',
      systemLabel: 'Constitutional',
      evidence: 'No fever. I checked a couple of times.',
    },
    {
      id: 'ros-ent-ear-pain',
      kind: 'ros',
      section: 'ros',
      baseKey: 'ros-ent-ear-pain',
      finding: RosFindingState.Denies,
      label: 'Ear pain',
      systemLabel: 'Ears/Nose/Throat',
      evidence: 'No ear pain.',
    },
    {
      id: 'ros-ent-sore-throat',
      kind: 'ros',
      section: 'ros',
      baseKey: 'ros-ent-sore-throat',
      finding: RosFindingState.Denies,
      label: 'Sore throat',
      systemLabel: 'Ears/Nose/Throat',
      evidence: "My throat's fine too.",
    },
    {
      id: 'ros-neuro-headache',
      kind: 'ros',
      section: 'ros',
      baseKey: 'ros-neuro-headache',
      finding: RosFindingState.Reports,
      label: 'Headache',
      systemLabel: 'Neurologic',
      evidence: "Yeah, headaches most afternoons. That's when it's the worst.",
    },
    {
      id: 'ros-ent-post-nasal-drip',
      kind: 'ros',
      section: 'ros',
      baseKey: 'ros-ent-post-nasal-drip',
      finding: RosFindingState.Denies,
      label: 'Post-nasal drip',
      systemLabel: 'Ears/Nose/Throat',
      evidence: 'Not so much anymore, honestly. It was the first few days.',
      warning: 'Possible conflict: the HPI recommendation records post-nasal drip as a presenting complaint.',
    },
    {
      id: 'ros-ent-sinus-pain',
      kind: 'ros',
      section: 'ros',
      baseKey: 'ros-ent-sinus-pain',
      finding: RosFindingState.Reports,
      label: 'Sinus pain/pressure',
      systemLabel: 'Ears/Nose/Throat',
      evidence: "It's really the sinuses, right here across my cheeks and forehead.",
    },
    {
      id: 'vital-weight',
      kind: 'vital-weight',
      section: 'vitals',
      weightLbs: 170,
      evidence: "I'm about 170 pounds.",
      warning: 'Patient-reported, not measured.',
    },
    {
      id: 'allergy-fentanyl',
      kind: 'allergy',
      section: 'allergies',
      name: 'Fentanyl',
      evidence: 'Fentanyl. I had a bad reaction after my knee surgery.',
    },
    {
      id: 'medication-ibuprofen',
      kind: 'medication',
      section: 'medications',
      name: 'Ibuprofen',
      type: 'as-needed',
      patientCouldNotConfirmDosage: true,
      evidence: "Ibuprofen when the headache gets bad. I don't remember the dose.",
    },
    {
      id: 'medication-claritin',
      kind: 'medication',
      section: 'medications',
      name: 'Claritin (loratadine)',
      type: 'as-needed',
      patientCouldNotConfirmDosage: true,
      evidence: 'And a sinus allergy med, Claritin or something like it, the one my wife takes.',
      warning:
        'Patient described "a sinus allergy med"; Claritin is a best guess. Confirm the product before applying.',
    },
    {
      id: 'dx-postnasal-drip',
      kind: 'diagnosis',
      section: 'assessment',
      code: 'R09.82',
      display: 'Postnasal drip',
      transcriptTerm: 'post-nasal drip',
      evidence: "I've had this post-nasal drip and pressure in my sinuses for about a week now.",
    },
    {
      id: 'dx-acute-sinusitis',
      kind: 'diagnosis',
      section: 'assessment',
      code: 'J01.90',
      display: 'Acute sinusitis, unspecified',
      transcriptTerm: 'sinus infection',
      isPrimary: true,
      evidence: 'This sounds like a sinus infection on top of the drip.',
    },
    {
      id: 'dx-dizziness',
      kind: 'diagnosis',
      section: 'assessment',
      code: 'R42',
      display: 'Dizziness and giddiness',
      transcriptTerm: 'dizziness',
      evidence: 'I get a little dizzy when I stand up too fast.',
    },
  ],
  orderSuggestions: [
    {
      id: 'order-dexamethasone',
      name: 'Dexamethasone',
      orderType: 'in-house-medication',
      rationale: 'Sinus pressure with daily headaches; a single in-house dose may reduce mucosal inflammation.',
      evidence: "It's really the sinuses, right here across my cheeks and forehead.",
    },
    {
      id: 'order-guaifenesin',
      name: 'Guaifenesin',
      orderType: 'in-house-medication',
      rationale: 'Thins secretions to relieve the post-nasal drip and sinus congestion.',
      evidence: "I've had this post-nasal drip and pressure in my sinuses for about a week now.",
    },
  ],
};

const DEFAULT_DELAY_MS = 1400;

/**
 * Pretends to analyze `transcript`. Resolves with a deep copy so the panel can edit the
 * recommendations in place without mutating the fixture between runs.
 */
export const analyzeTranscript = async (
  transcript: string,
  options: { delayMs?: number } = {}
): Promise<ScribeAnalysis> => {
  if (!transcript.trim()) {
    throw new Error('Paste a transcript first.');
  }
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return JSON.parse(JSON.stringify(SAMPLE_ANALYSIS)) as ScribeAnalysis;
};

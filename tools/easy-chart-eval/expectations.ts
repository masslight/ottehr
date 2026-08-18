// Per-case deterministic expectations for the twenty synthetic dictations in ./cases.
//
// THERE ARE NO GOLD NOTES. The harvested (transcript, gold note) corpus was PHI, lived in gitignored
// directories, and was never committed — correctly so. So these cases cannot answer "did the planner
// match what a clinician wrote". What they answer, cheaply and on every change, is "is the output
// internally correct and clinically sane".
//
// Everything below is derivable from the narrative text alone, by reading it. Nothing here is a
// judgement call about what a clinician would have charted.

import { EvalExpectations } from 'utils/lib/easy-chart/eval-scorer';

export interface EvalCase extends EvalExpectations {
  id: string;
  /** A one-line reminder of what the case is, so a failing run is readable. */
  summary: string;
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'case-01',
    summary: 'Lumbar strain after lifting; extensive pertinent negatives; PCP follow-up in 1–2 weeks',
    expectsDisposition: true,
    negatedFindings: ['numbness', 'tingling', 'weakness', 'fever', 'straight leg raise'],
  },
  {
    id: 'case-02',
    summary: 'Strep pharyngitis, 7y; amoxicillin; pediatrician follow-up in 2–3 days',
    expectsDisposition: true,
    negatedFindings: ['cough', 'runny nose', 'hoarseness', 'drooling', 'trismus', 'rash'],
  },
  {
    id: 'case-03',
    summary: 'Uncomplicated cystitis; nitrofurantoin; follow-up within two days',
    expectsDisposition: true,
    negatedFindings: ['fever', 'flank', 'vaginal discharge', 'costovertebral', 'peritoneal'],
  },
  {
    id: 'case-04',
    summary: 'Viral croup, 2y; in-clinic dexamethasone; pediatrician follow-up in 1–2 days',
    expectsDisposition: true,
    negatedFindings: ['drooling', 'respiratory distress at rest'],
  },
  {
    id: 'case-05',
    summary: 'Hand laceration repaired with sutures; tetanus given; PCP for suture removal',
    expectsDisposition: true,
    negatedFindings: ['numbness', 'foreign body', 'tendon involvement'],
  },
  {
    id: 'case-06',
    summary: 'Asthma exacerbation, 9y; nebs + prednisolone burst; pediatrician in 2–3 days',
    expectsDisposition: true,
    negatedFindings: ['fever'],
  },
  {
    id: 'case-07',
    summary: 'Lateral ankle sprain with normal x-ray; PCP if not improving in 5–7 days',
    expectsDisposition: true,
    negatedFindings: ['pop', 'fracture', 'tenderness over the posterior edge'],
  },
  {
    id: 'case-08',
    summary: 'Bronchiolitis, 4mo, RSV positive; pediatrician in 1–2 days',
    expectsDisposition: true,
    negatedFindings: ['fever'],
  },
  {
    id: 'case-09',
    summary: 'COPD exacerbation; prednisone + azithromycin; PCP or pulmonology in 2–3 days',
    expectsDisposition: true,
    negatedFindings: ['chest pain', 'fevers', 'leg swelling'],
  },
  {
    id: 'case-10',
    summary: 'Forehead laceration closed with skin adhesive, 5y; pediatrician as needed',
    expectsDisposition: true,
    negatedFindings: ['loss of consciousness', 'vomiting', 'behavior change', 'foreign body', 'step-off'],
  },
  {
    id: 'case-11',
    summary: 'Cellulitis of the right shin; cephalexin; recheck in 2–3 days',
    expectsDisposition: true,
    negatedFindings: ['drainage', 'fluctuance', 'pus', 'crepitus', 'red streaking'],
  },
  {
    id: 'case-12',
    summary: 'Viral gastroenteritis with mild dehydration, 3y; ondansetron; pediatrician in 1–2 days',
    expectsDisposition: true,
    negatedFindings: ['blood in the stool', 'rebound', 'guarding'],
  },
  {
    id: 'case-13',
    summary: 'Acute urticaria from a sulfa antibiotic; allergy must be added; PCP follow-up',
    expectsDisposition: true,
    negatedFindings: ['swelling of the lips', 'trouble breathing', 'throat tightness', 'wheezing'],
  },
  {
    id: 'case-14',
    summary: 'Hand-foot-and-mouth disease, 18mo; supportive care; pediatrician if not improving',
    expectsDisposition: true,
  },
  {
    id: 'case-15',
    summary: 'Cutaneous abscess incised and drained; TMP-SMX; recheck here in two days',
    expectsDisposition: true,
    negatedFindings: ['fever', 'diabetes', 'crepitus'],
  },
  {
    id: 'case-16',
    summary: 'Concussion after a soccer collision, 14y; pediatrician in 2–3 days',
    expectsDisposition: true,
    negatedFindings: ['loss of consciousness', 'vomiting', 'neck pain', 'weakness', 'seizure', 'focal deficits'],
  },
  {
    id: 'case-17',
    summary: 'Distal radius fracture splinted; orthopedics within one week',
    expectsDisposition: true,
    negatedFindings: ['numbness', 'break in the skin'],
  },
  {
    id: 'case-18',
    summary: 'Bacterial conjunctivitis, 6y; erythromycin ointment; pediatrician in 2–3 days',
    expectsDisposition: true,
    negatedFindings: ['eye pain', 'vision change', 'photophobia', 'corneal opacity', 'proptosis'],
  },
  {
    id: 'case-19',
    summary: 'Renal colic; IV ketorolac; tamsulosin; PCP or urology follow-up',
    expectsDisposition: true,
    negatedFindings: ['fever', 'vaginal bleeding', 'rebound', 'guarding'],
  },
  {
    id: 'case-20',
    summary: 'Nasal foreign body removed, 3y; pediatrician as needed',
    expectsDisposition: true,
    negatedFindings: ['fever', 'respiratory distress'],
  },
];

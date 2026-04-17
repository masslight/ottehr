export interface RosCardItem {
  label: string;
}

export interface RosCard {
  label: string;
  items: Record<string, RosCardItem>;
}

export type RosItemConfig = Record<string, RosCard>;

export const InPersonRosConfig: RosItemConfig = {
  constitutional: {
    label: 'Constitutional',
    items: {
      'ros-constitutional-fever': { label: 'Fever' },
      'ros-constitutional-chills': { label: 'Chills' },
      'ros-constitutional-night-sweats': { label: 'Night sweats' },
      'ros-constitutional-fatigue': { label: 'Fatigue' },
      'ros-constitutional-weight-change': { label: 'Weight loss/gain' },
      'ros-constitutional-poor-appetite': { label: 'Poor appetite' },
    },
  },
  eyes: {
    label: 'Eyes',
    items: {
      'ros-eyes-vision-changes': { label: 'Vision changes' },
      'ros-eyes-blurry-vision': { label: 'Blurry vision' },
      'ros-eyes-double-vision': { label: 'Double vision' },
      'ros-eyes-eye-pain': { label: 'Eye pain' },
      'ros-eyes-redness': { label: 'Redness' },
      'ros-eyes-discharge': { label: 'Discharge' },
      'ros-eyes-itching': { label: 'Itching' },
      'ros-eyes-photophobia': { label: 'Photophobia' },
    },
  },
  ent: {
    label: 'Ears, Nose, and Throat',
    items: {
      'ros-ent-ear-pain': { label: 'Ear pain' },
      'ros-ent-hearing-loss': { label: 'Hearing loss' },
      'ros-ent-tinnitus': { label: 'Tinnitus' },
      'ros-ent-ear-drainage': { label: 'Ear drainage' },
      'ros-ent-ear-fullness': { label: 'Ear fullness' },
      'ros-ent-nasal-congestion': { label: 'Nasal congestion' },
      'ros-ent-rhinorrhea': { label: 'Rhinorrhea' },
      'ros-ent-post-nasal-drip': { label: 'Post-nasal drip' },
      'ros-ent-sinus-pain': { label: 'Sinus pain/pressure' },
      'ros-ent-sneezing': { label: 'Sneezing' },
      'ros-ent-epistaxis': { label: 'Epistaxis' },
      'ros-ent-sore-throat': { label: 'Sore throat' },
      'ros-ent-hoarseness': { label: 'Hoarseness' },
      'ros-ent-difficulty-swallowing': { label: 'Difficulty swallowing' },
      'ros-ent-throat-swelling': { label: 'Throat swelling' },
      'ros-ent-oral-sores': { label: 'Oral sores/lesions' },
    },
  },
  cardiovascular: {
    label: 'Cardiovascular',
    items: {
      'ros-cardiovascular-chest-pain': { label: 'Chest pain' },
      'ros-cardiovascular-palpitations': { label: 'Palpitations' },
      'ros-cardiovascular-dyspnea-on-exertion': { label: 'Dyspnea on exertion' },
      'ros-cardiovascular-orthopnea': { label: 'Orthopnea' },
      'ros-cardiovascular-pnd': { label: 'Paroxysmal nocturnal dyspnea (PND)' },
      'ros-cardiovascular-leg-swelling': { label: 'Leg swelling/edema' },
      'ros-cardiovascular-claudication': { label: 'Claudication' },
    },
  },
  respiratory: {
    label: 'Respiratory',
    items: {
      'ros-respiratory-cough': { label: 'Cough' },
      'ros-respiratory-shortness-of-breath': { label: 'Shortness of breath' },
      'ros-respiratory-wheezing': { label: 'Wheezing' },
      'ros-respiratory-chest-tightness': { label: 'Chest tightness' },
      'ros-respiratory-sputum': { label: 'Sputum production' },
      'ros-respiratory-hemoptysis': { label: 'Hemoptysis' },
      'ros-respiratory-stridor': { label: 'Stridor' },
    },
  },
  gastrointestinal: {
    label: 'Gastrointestinal',
    items: {
      'ros-gi-nausea': { label: 'Nausea' },
      'ros-gi-vomiting': { label: 'Vomiting' },
      'ros-gi-diarrhea': { label: 'Diarrhea' },
      'ros-gi-constipation': { label: 'Constipation' },
      'ros-gi-abdominal-pain': { label: 'Abdominal pain' },
      'ros-gi-bloating': { label: 'Bloating' },
      'ros-gi-acid-reflux': { label: 'Acid reflux/heartburn' },
      'ros-gi-blood-in-stool': { label: 'Blood in stool' },
      'ros-gi-tarry-stools': { label: 'Black/tarry stools' },
      'ros-gi-bowel-changes': { label: 'Changes in bowel habits' },
      'ros-gi-difficulty-swallowing': { label: 'Difficulty swallowing' },
    },
  },
  genitourinary: {
    label: 'Genitourinary',
    items: {
      'ros-gu-dysuria': { label: 'Dysuria' },
      'ros-gu-frequency': { label: 'Urinary frequency' },
      'ros-gu-urgency': { label: 'Urinary urgency' },
      'ros-gu-hematuria': { label: 'Hematuria' },
      'ros-gu-flank-pain': { label: 'Flank pain' },
      'ros-gu-incontinence': { label: 'Incontinence' },
      'ros-gu-penile-discharge': { label: 'Penile discharge' },
      'ros-gu-penile-pain': { label: 'Penile pain' },
      'ros-gu-testicular-pain': { label: 'Testicular pain' },
      'ros-gu-scrotal-swelling': { label: 'Scrotal swelling' },
      'ros-gu-pelvic-pain': { label: 'Pelvic pain' },
      'ros-gu-vaginal-discharge': { label: 'Vaginal discharge' },
      'ros-gu-abnormal-vaginal-bleeding': { label: 'Abnormal vaginal bleeding' },
      'ros-gu-dyspareunia': { label: 'Dyspareunia' },
    },
  },
  musculoskeletal: {
    label: 'Musculoskeletal',
    items: {
      'ros-msk-joint-pain': { label: 'Joint pain' },
      'ros-msk-joint-swelling': { label: 'Joint swelling' },
      'ros-msk-muscle-aches': { label: 'Muscle aches/myalgia' },
      'ros-msk-back-pain': { label: 'Back pain' },
      'ros-msk-neck-pain': { label: 'Neck pain' },
      'ros-msk-limited-rom': { label: 'Limited range of motion' },
      'ros-msk-gait-difficulty': { label: 'Difficulty with gait' },
    },
  },
  skin: {
    label: 'Skin/Integumentary',
    items: {
      'ros-skin-rash': { label: 'Rash' },
      'ros-skin-itching': { label: 'Itching/pruritus' },
      'ros-skin-redness': { label: 'Redness/erythema' },
      'ros-skin-wounds': { label: 'Non-healing wounds' },
      'ros-skin-bruising': { label: 'Easy bruising' },
      'ros-skin-color-changes': { label: 'Skin color changes' },
      'ros-skin-lumps': { label: 'New lumps/bumps' },
      'ros-skin-swelling': { label: 'Localized swelling' },
    },
  },
  neurologic: {
    label: 'Neurologic',
    items: {
      'ros-neuro-headache': { label: 'Headache' },
      'ros-neuro-dizziness': { label: 'Dizziness/vertigo' },
      'ros-neuro-syncope': { label: 'Syncope/near-syncope' },
      'ros-neuro-numbness': { label: 'Numbness' },
      'ros-neuro-tingling': { label: 'Tingling/paresthesia' },
      'ros-neuro-weakness': { label: 'Weakness' },
      'ros-neuro-difficulty-speaking': { label: 'Difficulty speaking' },
      'ros-neuro-seizures': { label: 'Seizures' },
      'ros-neuro-coordination': { label: 'Coordination problems' },
      'ros-neuro-confusion': { label: 'Confusion/altered mental status' },
    },
  },
  psychiatric: {
    label: 'Psychiatric',
    items: {
      'ros-psych-anxiety': { label: 'Anxiety' },
      'ros-psych-depression': { label: 'Depression' },
      'ros-psych-agitation': { label: 'Agitation/irritability' },
      'ros-psych-sleep-disturbance': { label: 'Sleep disturbance' },
      'ros-psych-suicidal-ideation': { label: 'Suicidal ideation' },
      'ros-psych-homicidal-ideation': { label: 'Homicidal ideation' },
      'ros-psych-hallucinations': { label: 'Hallucinations' },
    },
  },
  endocrine: {
    label: 'Endocrine',
    items: {
      'ros-endo-heat-intolerance': { label: 'Heat intolerance' },
      'ros-endo-cold-intolerance': { label: 'Cold intolerance' },
      'ros-endo-excessive-thirst': { label: 'Excessive thirst' },
      'ros-endo-excessive-urination': { label: 'Excessive urination' },
      'ros-endo-hair-skin-changes': { label: 'Hair/skin changes' },
      'ros-endo-weight-changes': { label: 'Unexplained weight changes' },
    },
  },
  hematologic: {
    label: 'Hematologic/Lymphatic',
    items: {
      'ros-heme-easy-bruising': { label: 'Easy bruising' },
      'ros-heme-prolonged-bleeding': { label: 'Prolonged bleeding' },
      'ros-heme-swollen-nodes': { label: 'Swollen lymph nodes' },
      'ros-heme-clotting-problems': { label: 'History of clotting problems' },
    },
  },
  allergic: {
    label: 'Allergic/Immunologic',
    items: {
      'ros-allergy-seasonal': { label: 'Seasonal allergies' },
      'ros-allergy-food': { label: 'Food allergies' },
      'ros-allergy-medication': { label: 'Medication allergies' },
      'ros-allergy-frequent-infections': { label: 'Frequent infections' },
      'ros-allergy-immunocompromised': { label: 'Immunocompromised status' },
    },
  },
};

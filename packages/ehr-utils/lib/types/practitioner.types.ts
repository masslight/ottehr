export type PractitionerQualificationCode =
  | 'MD'
  | 'PA'
  | 'DO'
  | 'NP'
  | 'RN'
  | 'CNM'
  | 'PMHNP'
  | 'RNFA'
  | 'ACSW'
  | 'APCC'
  | 'BCBA'
  | 'BCaBA'
  | 'BHA'
  | 'BHARI'
  | 'COUNSELOR'
  | 'OD'
  | 'DPM'
  | 'DA'
  | 'DDS'
  | 'DEH'
  | 'DMD'
  | 'DPT'
  | 'PT'
  | 'PTA'
  | 'PBT'
  | 'LCADC'
  | 'LCAT'
  | 'LCMHC'
  | 'LCMHC-S'
  | 'LCMHCA'
  | 'LCPC'
  | 'LCSW'
  | 'LSW'
  | 'LCSWA'
  | 'LICSW'
  | 'LIMHP-CSW'
  | 'LIMHP-CMSW'
  | 'LIMHP'
  | 'LISW'
  | 'LMFT'
  | 'LMFT-S'
  | 'LMFTA'
  | 'LMHC'
  | 'LMSW'
  | 'LPC'
  | 'LPC-C'
  | 'LPCA'
  | 'LPCC'
  | 'LPCI'
  | 'LSCSW'
  | 'MFTA'
  | 'MHCA'
  | 'MHT'
  | 'OMS'
  | 'ORTH'
  | 'OT'
  | 'OTA'
  | 'OTHER'
  | 'RD'
  | 'RPh'
  | 'PhT'
  | 'PhD'
  | 'PsyD'
  | 'RBT'
  | 'RCSWI'
  | 'RHMCI'
  | 'SLP'
  | 'LPN'
  | 'LAc'
  | 'LMT'
  | 'DC'
  | 'ND'
  | 'MA'
  | 'LPCMH'
  | 'LIMHP-CPC'
  | 'LPC-MH'
  | 'LPC/MHSP'
  | 'CMHC'
  | 'ALC'
  | 'LAC'
  | 'LACMH'
  | 'LAPC'
  | 'ACMHC'
  | 'LMHCA'
  | 'LGPC'
  | 'CSW'
  | 'LCSW-C'
  | 'ISW'
  | 'LISW-CP'
  | 'CSW-PIP'
  | 'CISW'
  | 'MLSW'
  | 'CMSW'
  | 'LGSW'
  | 'LASW'
  | 'APSW'
  | 'RT'
  | 'AUD'
  | 'CRNA'
  | 'OPTHAMOLOGIST'
  | 'OPA'
  | 'CP-A'
  | 'AT'
  | 'FITNESS-PROFESSI'
  | 'EMR'
  | 'EMT'
  | 'EMT-A'
  | 'LVN'
  | 'MLT'
  | 'NMT'
  | 'LN'
  | 'OPT'
  | 'OTHER-ALLIED-HEA'
  | 'PAR'
  | 'PHARMACY-ASSISTA'
  | 'PI'
  | 'PODIATRIC-ASSIST'
  | 'RADIOLOGY-TECH'
  | 'ACU'
  | 'DT'
  | 'MOT'
  | 'MPT'
  | 'MT'
  | 'OTD'
  | 'OTR/L'
  | 'RDN'
  | 'SLP-CF'
  | 'SLPD'
  | 'ATC'
  | 'COTA'
  | 'LMPC'
  | 'ORT'
  | 'SLPA'
  | 'MT-BC';

export const PractitionerQualificationCodesLabels: Record<PractitionerQualificationCode, string> = {
  'CSW-PIP': 'Clinical Social Worker-Private Independent Practice',
  'FITNESS-PROFESSI': 'Fitness Professional (not a standardized code)',
  'LISW-CP': 'Licensed Independent Social Worker-Clinical Practice',
  'PHARMACY-ASSISTA': 'Pharmacy Assistant (not a standardized code)',
  'PODIATRIC-ASSIST': 'Podiatric Assistant (may vary by state)',
  CISW: 'Certified Independent Social Worker',
  CMSW: 'Clinical Master Social Worker',
  COUNSELOR: 'Counselor',
  ISW: 'Independent Social Worker',
  MLSW: 'Master of Social Work',
  ORTH: '',
  RHMCI: '',
  DO: 'Doctor of Osteopathic Medicine',
  MD: 'Doctor of Medicine',
  PA: 'Physician Assistant',
  RN: 'Registered Nurse',
  NP: 'Nurse Practitioner',
  CNM: 'Certified Nurse Midwife',
  PMHNP: 'Psychiatric Mental Health Nurse Practitioner',
  RNFA: 'Registered Nurse First Assistant',
  ACSW: "Master's level Clinical Social Worker",
  APCC: 'Advanced Practice Clinical Counselor',
  BCBA: 'Board Certified Behavior Analyst',
  BCaBA: 'Board Certified Assistant Behavior Analyst',
  BHA: 'Bachelor of Health Administration',
  BHARI: 'Behavioral Health Associate in Recovery',
  OD: 'Doctor of Optometry',
  DPM: 'Doctor of Podiatric Medicine',
  DA: 'Dental Assistant',
  DDS: 'Doctor of Dental Surgery',
  DEH: 'Dental Hygienist',
  DMD: 'Doctor of Dental Medicine',
  DPT: 'Doctor of Physical Therapy',
  PT: 'Physical Therapist',
  PTA: 'Physical Therapist Assistant',
  PBT: 'Physical Therapist Aide',
  LCADC: 'Licensed Clinical Alcohol and Drug Counselor',
  LCAT: 'Licensed Marriage and Family Therapist',
  LCMHC: 'Licensed Clinical Mental Health Counselor',
  'LCMHC-S': 'Licensed Clinical Mental Health Counselor Supervisor',
  LCMHCA: 'Licensed Clinical Mental Health Counselor Associate',
  LCPC: 'Licensed Clinical Professional Counselor',
  LCSW: 'Licensed Clinical Social Worker',
  LSW: 'Licensed Social Worker',
  LCSWA: 'Licensed Certified Social Worker Assistant',
  LICSW: 'Licensed Independent Clinical Social Worker',
  'LIMHP-CSW': 'Licensed Independent Mental Health Professional-Clinical Social Worker',
  'LIMHP-CMSW': 'Licensed Independent Mental Health Professional-Clinical Master Social Worker',
  LIMHP: 'Licensed Independent Mental Health Professional (followed by specific area)',
  LISW: 'Licensed Independent Social Worker',
  LMFT: 'Licensed Marriage and Family Therapist',
  'LMFT-S': 'Licensed Marriage and Family Therapist Supervisor',
  LMFTA: 'Licensed Marriage and Family Therapist Associate',
  LMHC: 'Licensed Mental Health Counselor (may vary by state)',
  LMSW: 'Licensed Master Social Worker',
  LPC: 'Licensed Professional Counselor',
  'LPC-C': 'Licensed Professional Counselor-Candidate/Provisional',
  LPCA: 'Licensed Professional Counselor Associate',
  LPCC: 'Licensed Professional Clinical Counselor',
  LPCI: 'Licensed Professional Counselor Intern',
  LSCSW: 'Licensed Specialist Clinical Social Worker',
  MFTA: 'Marriage and Family Therapist Assistant',
  MHCA: 'Mental Health Counselor Aide',
  MHT: 'Mental Health Technician',
  OMS: 'Oral and Maxillofacial Surgeon',
  OT: 'Occupational Therapist',
  OTA: 'Occupational Therapist Assistant',
  OTHER: 'Other Healthcare Professional (specify)',
  RD: 'Registered Dietitian',
  RPh: 'Registered Pharmacist',
  PhT: 'Pharmacy Technician',
  PhD: 'Doctor of Philosophy (in a healthcare field)',
  PsyD: 'Doctor of Psychology',
  RBT: 'Registered Behavior Technician',
  RCSWI: 'Registered Clinical Social Work Intern',
  SLP: 'Speech-Language Pathologist',
  LPN: 'Licensed Practical Nurse',
  LAc: 'Licensed Acupuncturist',
  LMT: 'Licensed Massage Therapist',
  DC: 'Doctor of Chiropractic',
  ND: 'Doctor of Naturopathic Medicine',
  MA: 'Medical Assistant',
  LPCMH: 'Licensed Professional Counselor in Mental Health',
  'LIMHP-CPC': 'Licensed Independent Mental Health Professional-Clinical Pastoral Counselor',
  'LPC-MH': 'Licensed Professional Counselor-Mental Health',
  'LPC/MHSP': 'Licensed Professional Counselor/Mental Health Service Provider',
  CMHC: 'Certified Mental Health Counselor',
  ALC: 'Addictions Counselor',
  LAC: 'Licensed Addiction Counselor',
  LACMH: 'Licensed Addiction Counselor-Mental Health',
  LAPC: 'Licensed Associate Professional Counselor',
  ACMHC: 'Associate Certified Mental Health Counselor',
  LMHCA: 'Licensed Master Mental Health Counselor',
  LGPC: 'Licensed Graduate Professional Counselor',
  CSW: 'Clinical Social Worker',
  'LCSW-C': 'Licensed Clinical Social',
  LGSW: 'Licensed Graduate Social Worker',
  LASW: 'Licensed Addiction Specialist Social Worker (may vary by state)',
  APSW: 'Academy of Certified Social Workers (not a specific license)',
  RT: 'Respiratory Therapist',
  AUD: 'Audiologist',
  CRNA: 'Certified Registered Nurse Anesthetist',
  OPTHAMOLOGIST: 'Ophthalmologist (M.D. specializing in the eye)',
  OPA: 'Ophthalmic Technician/Assistant',
  'CP-A': 'Unknown meaning** (not a recognized code in standard healthcare classification systems)',
  AT: 'Athletic Trainer',
  EMR: 'Electronic Medical Records (not a profession)',
  EMT: 'Emergency Medical Technician (basic level)',
  'EMT-A': 'Emergency Medical Technician-Advanced',
  LVN: 'Licensed Vocational Nurse',
  MLT: 'Medical Laboratory Technician',
  NMT: 'Nuclear Medicine Technologist',
  LN: 'Licensed Dietitian/Nutritionist (may vary by state)',
  OPT: 'Ophthalmic Technician (may vary from OPA)',
  'OTHER-ALLIED-HEA': 'Other Allied Health Professional (specify)',
  PAR: 'Physician Assistant (PA is more common)',
  PI: 'Physician Assistant (PA is more common)',
  'RADIOLOGY-TECH': 'Radiologic Technologist (general term)',
  ACU: 'Acupuncturist (may differ from LAc)',
  DT: 'Dance Therapist',
  MOT: 'Occupational Therapist (OT is more common)',
  MPT: 'Master of Physical Therapy (not a profession)',
  MT: 'Massage Therapist (may differ from LMT)',
  OTD: 'Doctor of Occupational Therapy (OT is more common)',
  'OTR/L': 'Occupational Therapist Registered/Licensed',
  RDN: 'Registered Dietitian Nutritionist',
  'SLP-CF': 'Speech-Language Pathologist-Clinical Fellow (student)',
  SLPD: 'Speech-Language Pathologist (general term)',
  ATC: 'Athletic Trainer (already mentioned)',
  COTA: 'Certified Occupational Therapist Assistant',
  LMPC: 'Licensed Marriage and Family Therapist (already mentioned)',
  ORT: 'Orthotist (may differ from CPO)',
  SLPA: 'Speech-Language Pathology Assistant',
  'MT-BC': 'Music Therapist-Board Certified',
};

export const PractitionerQualificationCodesDisplay = Object.keys(PractitionerQualificationCodesLabels).map((key) => ({
  value: key,
  label: `${key} (${PractitionerQualificationCodesLabels[key as PractitionerQualificationCode]})`,
}));

export interface PractitionerLicense {
  state: string;
  code: PractitionerQualificationCode;
  active: boolean;
}

export const PHOTON_PRESCRIBER_SYSTEM_URL = 'http://api.zapehr.com/photon-prescriber-id';
export const PHOTON_PRACTITIONER_ENROLLED = 'http://api.zapehr.com/photon-practitioner-enrolled';

export const FileType = {
  MEDICAL_SUMMARY: 'medical-summary',
  PROGRESS_NOTE: 'progress-note',
  INSURANCE_CARD: 'insurance-card',
  GENERATED_FORM: 'generated-form',
  CHART_TRANSCRIPTION: 'chart-transcription',
  CODE_SUMMARY: 'code-summary',
  COMPANY_MEDICAL_RECORD: 'company-medical-record',
  CONSENTS: 'consents',
  DRIVERS_LICENSE: 'drivers-license',
  LIC: 'lic',
  EXAM: 'exam',
  EXAM_SUMMARY: 'exam-summary',
  EXAM_LAB: 'exam-lab',
  EXAM_DOT: 'exam-dot',
  HIPAA_CONSENT: 'hipaa-consent',
  HIPAA_NOTICE: 'hipaa-notice',
  ID_CARD: 'id-card',
  IMPORTED_CHART: 'imported-chart',
  INSURANCE: 'insurance',
  INSURANCE_AGREEMENT: 'insurance-agreement',
  LAB_REPORT: 'lab-report',
  LAB_REQ: 'lab-req',
  LAB: 'lab',
  MED_HX: 'med-hx',
  PAT_HX: 'pat-hx',
  PATIENT_AUTHORIZATION: 'patient-authorization',
  PATIENT_CLINICAL_SUMMARY: 'patient-clinical-summary',
  PATIENT_INFO: 'patient-info',
  PAYMENT_RECEIPT: 'payment-receipt',
  REGISTRATION_FORM: 'registration-form',
  SCHOOL_NOTE: 'school-note',
  TEXAS_IMMUNIZATION_REGISTRY_VITAL_REPORT: 'texas-immunization-registry-vital-report',
  TRANSCRIPTION: 'transcription',
  VISIT_FOLLOW_UP_COMM: 'visit-follow-up-comm',
  VITALS: 'vitals',
  WORK_NOTE: 'work-note',
  XRAY_OVER_READ_REPORT: 'xray-over-read-report',
  XRAY_CHEST: 'xray-chest',
  XRAY: 'xray',
  BILLING: 'billing',

  REG: 'reg', // Full Account file (Patient Registration, guarantor, billing etc)
  DOT: 'dot', // DOT license
  EKG: 'ekg',
  RX: 'rx',
  PRE_OP_REQ: 'pre-op-req', // Confirms that the essential  documentation needed before a patient can undergo surgery have been successfully brought into the system.
  REQ: 'req', // Confirms any physician req /order has been transferred
  M_CLR_FX: 'm-clr-fx', // Confirms that a medical clearance document has imported (once that was originally faxed)

  OTHER: 'other',
} as const;

export type FileType = (typeof FileType)[keyof typeof FileType];

type FileTypeChipColors = { bg: string; text: string };
const chipColor: Record<string, FileTypeChipColors> = {
  lightBlue: { bg: '#B2EBF2', text: '#006064' },
  green: { bg: '#C8E6C9', text: '#1B5E20' },
  purple: { bg: '#E1BEE7', text: '#4A148C' },
  amber: { bg: '#FFE0B2', text: '#E65100' },
  rose: { bg: '#FFCDD2', text: '#B71C1C' },
  teal: { bg: '#B2DFDB', text: '#004D40' },
  indigo: { bg: '#C5CAE9', text: '#1A237E' },
};
// folder: naming convention used to infer file types from S3 object keys (not flexible -- files already uploaded under these names)
// label: display string for the front end (change here to reclassify without touching FileType values)
// color: { bg: string; text: string } - anything without a color will fallback to gray
export const FileTypeMap: Record<FileType, { folder: string; label: string; color?: FileTypeChipColors }> = {
  [FileType.MEDICAL_SUMMARY]: { folder: 'medical_summary', label: 'Medical Summary', color: chipColor.lightBlue },
  [FileType.PROGRESS_NOTE]: { folder: 'ProgressNotes', label: 'Progress Note', color: chipColor.green },
  [FileType.INSURANCE_CARD]: { folder: 'InsuranceCard', label: 'Insurance Card', color: chipColor.purple },
  [FileType.GENERATED_FORM]: { folder: 'GeneratedForm', label: 'Generated Form', color: chipColor.green },
  [FileType.CHART_TRANSCRIPTION]: {
    folder: 'ChartTranscription',
    label: 'Chart Transcription',
    color: chipColor.green,
  },
  [FileType.CODE_SUMMARY]: { folder: 'CodeSummary', label: 'Code Summary', color: chipColor.green },
  [FileType.COMPANY_MEDICAL_RECORD]: {
    folder: 'CompanyMedicalRecord',
    label: 'Company Medical Record',
    color: chipColor.green,
  },
  [FileType.CONSENTS]: { folder: 'Consents', label: 'Consents', color: chipColor.rose },
  [FileType.DRIVERS_LICENSE]: { folder: 'DriversLicense', label: "Driver's License", color: chipColor.purple },
  [FileType.LIC]: { folder: 'LIC', label: 'LIC', color: chipColor.purple },
  [FileType.EXAM]: { folder: 'Exam', label: 'Exam', color: chipColor.green },
  [FileType.EXAM_SUMMARY]: { folder: 'ExamSummary', label: 'Exam', color: chipColor.green },
  [FileType.EXAM_LAB]: { folder: 'ExamLab', label: 'Exam/Lab', color: chipColor.green },
  [FileType.EXAM_DOT]: { folder: 'ExamDOT', label: 'DOT Exam', color: chipColor.green },
  [FileType.HIPAA_CONSENT]: { folder: 'HIPAAConsent', label: 'HIPAA Consent', color: chipColor.rose },
  [FileType.HIPAA_NOTICE]: { folder: 'HIPAANotice', label: 'HIPAA Notice', color: chipColor.rose },
  [FileType.ID_CARD]: { folder: 'IDCard', label: 'ID Card', color: chipColor.purple },
  [FileType.IMPORTED_CHART]: { folder: 'ImportedChart', label: 'Imported Chart', color: chipColor.green },
  [FileType.INSURANCE]: { folder: 'Insurance', label: 'Insurance', color: chipColor.amber },
  [FileType.INSURANCE_AGREEMENT]: {
    folder: 'InsuranceAgreement',
    label: 'Insurance Agreement',
    color: chipColor.amber,
  },
  [FileType.LAB_REPORT]: { folder: 'LabReport', label: 'Lab Report', color: chipColor.green },
  [FileType.LAB_REQ]: { folder: 'LabReq', label: 'Lab Req', color: chipColor.green },
  [FileType.LAB]: { folder: 'Lab', label: 'Lab', color: chipColor.green },
  [FileType.MED_HX]: { folder: 'MedHx', label: 'Medical History', color: chipColor.green },
  [FileType.PAT_HX]: { folder: 'PatHx', label: 'Patient History', color: chipColor.green },
  [FileType.PATIENT_AUTHORIZATION]: {
    folder: 'PatientAuthorization',
    label: 'Patient Authorization',
    color: chipColor.rose,
  },
  [FileType.PATIENT_CLINICAL_SUMMARY]: {
    folder: 'PatientClinicalSummary',
    label: 'Patient Clinical Summary',
    color: chipColor.green,
  },
  [FileType.PATIENT_INFO]: { folder: 'PatientInfo', label: 'Patient Info', color: chipColor.purple },
  [FileType.PAYMENT_RECEIPT]: { folder: 'PaymentReceipt', label: 'Payment Receipt', color: chipColor.amber },
  [FileType.REGISTRATION_FORM]: { folder: 'RegistrationForm', label: 'Registration Form', color: chipColor.purple },
  [FileType.SCHOOL_NOTE]: { folder: 'SchoolNote', label: 'School Note', color: chipColor.green },
  [FileType.TEXAS_IMMUNIZATION_REGISTRY_VITAL_REPORT]: {
    folder: 'TexasImmunizationRegistryVitalReport',
    label: 'Texas Immunization Registry Vital Report',
    color: chipColor.green,
  },
  [FileType.TRANSCRIPTION]: { folder: 'Transcription', label: 'Transcription', color: chipColor.green },
  [FileType.VISIT_FOLLOW_UP_COMM]: {
    folder: 'VisitFollowUpComm',
    label: 'Visit Follow-Up Communication',
    color: chipColor.indigo,
  },
  [FileType.VITALS]: { folder: 'Vitals', label: 'Vitals', color: chipColor.green },
  [FileType.WORK_NOTE]: { folder: 'WorkNote', label: 'Work Note', color: chipColor.green },
  [FileType.XRAY_OVER_READ_REPORT]: {
    folder: 'X-RayOverReadReport',
    label: 'X-Ray Over-Read Report',
    color: chipColor.green,
  },
  [FileType.XRAY_CHEST]: { folder: 'CXR-REP', label: 'Chest X-Ray', color: chipColor.green },
  [FileType.XRAY]: { folder: 'X-ray', label: 'X-Ray', color: chipColor.green },
  [FileType.BILLING]: { folder: 'Billing', label: 'Billing', color: chipColor.amber },
  [FileType.REG]: { folder: 'REG', label: 'REG', color: chipColor.purple },
  [FileType.DOT]: { folder: 'DOT', label: 'DOT', color: chipColor.green },
  [FileType.EKG]: { folder: 'EKG', label: 'EKG', color: chipColor.green },
  [FileType.RX]: { folder: 'RX', label: 'RX', color: chipColor.green },
  [FileType.PRE_OP_REQ]: { folder: 'PRE-OP-REQ', label: 'Pre-Op Req', color: chipColor.teal },
  [FileType.REQ]: { folder: 'REQ', label: 'REQ', color: chipColor.teal },
  [FileType.M_CLR_FX]: { folder: 'M-CLR-FX', label: 'M/CLR FX', color: chipColor.teal },
  [FileType.OTHER]: { folder: 'Other', label: 'Other' },
};

export interface LegacyFile {
  key: string;
  fileName: string;
  fileType: FileType;
  presignedUrl: string;
}

export interface LegacyPatientRecord {
  patientFolder: string;
  patientId: string;
  displayName: string;
  files: LegacyFile[];
}

export interface SearchLegacyRecordsInput {
  lastName: string;
  firstName?: string;
  dateOfBirth?: string;
  /** 1-based page index (default: 1) */
  page?: number;
  /** Patient folders per page (default: 20, max: 50) */
  pageSize?: number;
  /** Max files returned per patient record (default: 50, max: 200) */
  maxFilesPerRecord?: number;
}

export interface SearchLegacyRecordsOutput {
  results: LegacyPatientRecord[];
  /** Total number of matching patient folders (for pagination) */
  total: number;
  page: number;
  pageSize: number;
}

import { DispositionType } from '../types/api/chart-data/chart-data.types';

const pcpLabel = 'Primary Care Physician';

export const mapDispositionTypeToLabel: Record<DispositionType, string> = {
  ip: 'Ottehr IP Transfer',
  'ip-lab': 'Ottehr IP Lab',
  pcp: pcpLabel,
  ed: 'ED Transfer',
  'ip-oth': 'Non-Ottehr IP Transfer',
  'pcp-no-type': pcpLabel,
  another: 'Transfer to Another Location',
  specialty: 'Specialty Transfer',
};

export const OTHER_SPECIALTY_TRANSFER_OPTION = 'Other';

export const DEFAULT_SPECIALTY_TRANSFER_OPTIONS = [
  'Allergist',
  'Cardiologist',
  'Dermatology',
  'Diagnostic Imaging',
  'ENT',
  'Family Medicine',
  'Gastroenterology',
  'General Surgery',
  'Neurology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Physical Therapy',
];

export const getSpecialtyTransferSelectOptions = (configured: string[], current?: string): string[] => {
  const options = new Set(configured);
  if (current && current !== OTHER_SPECIALTY_TRANSFER_OPTION) {
    options.add(current);
  }

  const sortedOptions = [...options].sort((a, b) => a.localeCompare(b));

  return [...sortedOptions, OTHER_SPECIALTY_TRANSFER_OPTION];
};

/**
 * Builds the human-readable specialty-transfer string. When the selected specialty is "Other",
 * the free-text the provider typed is shown (falling back to "Other" when no text was entered).
 */
export const getSpecialtyTransferDisplay = (specialty?: string, specialtyOther?: string): string | undefined => {
  if (specialty === OTHER_SPECIALTY_TRANSFER_OPTION) {
    return specialtyOther?.trim() || OTHER_SPECIALTY_TRANSFER_OPTION;
  }
  return specialty || undefined;
};

export const dispositionCheckboxOptions = [
  {
    label: 'Dentistry',
    name: 'dentistry',
  },
  {
    label: 'ENT',
    name: 'ent',
  },
  {
    label: 'Ophthalmology',
    name: 'ophthalmology',
  },
  {
    label: 'Orthopedics',
    name: 'orthopedics',
  },
  {
    label: 'Other',
    name: 'other',
  },
  // {
  //   label: 'Lurie CT',
  //   name: 'lurie-ct',
  // },
] as const;

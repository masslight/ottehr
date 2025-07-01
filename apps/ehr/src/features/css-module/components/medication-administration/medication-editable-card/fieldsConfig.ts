export type MedicationOrderType = 'order-new' | 'order-edit' | 'dispense' | 'dispense-not-administered';

export const fieldsConfigForOrder = {
  medicationId: { xs: 6, isRequired: true },
  associatedDx: { xs: 6, isRequired: false },
  dose: { xs: 6, isRequired: true },
  units: { xs: 6, isRequired: true },
  manufacturer: { xs: 6, isRequired: false },
  route: { xs: 6, isRequired: true },

  // TODO: uncomment when the "anatomical locations" feature is completed
  // location: { xs: 6, isRequired: false },
  instructions: { xs: 12, isRequired: false },
} as const;

export const fieldsConfigForDispense = {
  medicationId: { xs: 6, isRequired: true },
  associatedDx: { xs: 6, isRequired: false },
  dose: { xs: 6, isRequired: true },
  units: { xs: 6, isRequired: true },
  lotNumber: { xs: 3, isRequired: true },
  expDate: { xs: 3, isRequired: true },
  manufacturer: { xs: 6, isRequired: false },
  route: { xs: 6, isRequired: true },

  // TODO: uncomment when the "anatomical locations" feature is completed
  // location: { xs: 6, isRequired: false },
  dateGiven: { xs: 6, isRequired: true },
  timeGiven: { xs: 6, isRequired: true },
  instructions: { xs: 12, isRequired: false },
} as const;

export const fieldsConfigForNotAdministered = {
  medicationId: { xs: 6, isRequired: true },
  associatedDx: { xs: 6, isRequired: true },
  dose: { xs: 6, isRequired: true },
  units: { xs: 6, isRequired: true },
  lotNumber: { xs: 3, isRequired: false }, // Not required for partial administration
  expDate: { xs: 3, isRequired: false }, // Not required for partial administration
  manufacturer: { xs: 6, isRequired: false },
  route: { xs: 6, isRequired: true },

  // TODO: uncomment when the "anatomical locations" feature is completed
  // location: { xs: 6, isRequired: false },
  dateGiven: { xs: 6, isRequired: true },
  timeGiven: { xs: 6, isRequired: true },
  instructions: { xs: 12, isRequired: false },
} as const;

export const fieldsConfig = {
  'order-new': fieldsConfigForOrder,
  'order-edit': fieldsConfigForOrder,
  dispense: fieldsConfigForDispense,
  'dispense-not-administered': fieldsConfigForNotAdministered,
} as const;

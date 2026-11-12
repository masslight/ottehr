import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { create } from 'zustand';

/** A sent prescription the table's Reorder hands to the order form above it, until the form takes it. */
export const useReorderPrescriptionStore = create<{ prescription?: PrescribedMedicationDTO }>()(() => ({}));

export const reorderPrescription = (prescription: PrescribedMedicationDTO): void =>
  useReorderPrescriptionStore.setState({ prescription });

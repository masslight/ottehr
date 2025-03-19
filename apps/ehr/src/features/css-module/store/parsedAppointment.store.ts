import { create } from 'zustand';
import { VisitDataAndMappedData } from '../parser';

const PARSED_APPOINTMENT_INITIAL: VisitDataAndMappedData = { data: {}, mappedData: {} };

export const useParsedAppointmentStore = create<VisitDataAndMappedData>()(() => ({
  ...PARSED_APPOINTMENT_INITIAL,
}));

import { create } from 'zustand';
import { AppointmentProcessedSourceData } from '../parser';

const PARSED_APPOINTMENT_INITIAL: AppointmentProcessedSourceData = { sourceData: {}, processedData: {} };

export const useParsedAppointmentStore = create<AppointmentProcessedSourceData>()(() => ({
  ...PARSED_APPOINTMENT_INITIAL,
}));

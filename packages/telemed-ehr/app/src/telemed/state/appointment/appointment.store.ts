import { create } from 'zustand';
import { Appointment, Encounter, Location, Patient, QuestionnaireResponse } from 'fhir/r4';
import { GetChartDataResponse } from 'ehr-utils';

type AppointmentState = {
  appointment: Appointment | undefined;
  patient: Patient | undefined;
  location: Location | undefined;
  encounter: Encounter;
  questionnaireResponse: QuestionnaireResponse | undefined;
  isAppointmentLoading: boolean;
  isChartDataLoading: boolean;
  chartData: GetChartDataResponse | undefined;
};

interface AppointmentStoreActions {
  setPartialChartData: (value: Partial<GetChartDataResponse>) => void;
}

const APPOINTMENT_INITIAL: AppointmentState = {
  appointment: undefined,
  patient: undefined,
  location: undefined,
  encounter: {} as Encounter,
  questionnaireResponse: undefined,
  isAppointmentLoading: false,
  isChartDataLoading: false,
  chartData: undefined,
};

export const useAppointmentStore = create<AppointmentState & AppointmentStoreActions>()((set) => ({
  ...APPOINTMENT_INITIAL,
  setPartialChartData: (data) => {
    set((state) => ({
      chartData: { ...state.chartData, patientId: state.chartData!.patientId, ...data },
    }));
  },
}));

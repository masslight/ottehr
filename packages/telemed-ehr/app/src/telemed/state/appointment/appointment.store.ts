import { Appointment, Encounter, Location, Patient, QuestionnaireResponse } from 'fhir/r4';
import { GetChartDataResponse } from 'ehr-utils';
import { create } from 'zustand';

type AppointmentState = {
  appointment: Appointment | undefined;
  patient: Patient | undefined;
  location: Location | undefined;
  encounter: Encounter;
  questionnaireResponse: QuestionnaireResponse | undefined;
  patientPhotoUrls: string[];
  schoolWorkNoteUrls: string[];
  isAppointmentLoading: boolean;
  isChartDataLoading: boolean;
  isExamObservationsLoading: boolean;
  isReadOnly: boolean;
  chartData: GetChartDataResponse | undefined;
  currentTab: string;
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
  patientPhotoUrls: [],
  schoolWorkNoteUrls: [],
  isAppointmentLoading: false,
  isChartDataLoading: false,
  isExamObservationsLoading: false,
  isReadOnly: true,
  chartData: undefined,
  currentTab: 'hpi',
};

export const useAppointmentStore = create<AppointmentState & AppointmentStoreActions>()((set) => ({
  ...APPOINTMENT_INITIAL,
  setPartialChartData: (data) => {
    set((state) => ({
      chartData: { ...state.chartData, patientId: state.chartData!.patientId, ...data },
    }));
  },
}));

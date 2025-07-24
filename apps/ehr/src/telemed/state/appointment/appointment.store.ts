import { Appointment, Encounter, Location, Patient, Practitioner, QuestionnaireResponse } from 'fhir/r4b';
import { GetChartDataResponse, ObservationDTO, ReviewAndSignData } from 'utils';
import { create } from 'zustand';

type AppointmentState = {
  appointment: Appointment | undefined;
  patient: Patient | undefined;
  location: Location | undefined;
  locationVirtual: Location | undefined;
  practitioner?: Practitioner;
  encounter: Encounter;
  questionnaireResponse: QuestionnaireResponse | undefined;
  patientPhotoUrls: string[];
  schoolWorkNoteUrls: string[];
  isAppointmentLoading: boolean;
  isChartDataLoading: boolean;
  chartData: GetChartDataResponse | undefined;
  currentTab: string;
  reviewAndSignData: ReviewAndSignData | undefined;
};

interface AppointmentStoreActions {
  setPartialChartData: (value: Partial<GetChartDataResponse>) => void;
  updateObservation: (observation: ObservationDTO) => void;
}

const APPOINTMENT_INITIAL: AppointmentState = {
  appointment: undefined,
  patient: undefined,
  location: undefined,
  locationVirtual: undefined,
  practitioner: undefined,
  encounter: {} as Encounter,
  questionnaireResponse: undefined,
  patientPhotoUrls: [],
  schoolWorkNoteUrls: [],
  isAppointmentLoading: false,
  isChartDataLoading: false,
  chartData: undefined,
  currentTab: 'hpi',
  reviewAndSignData: undefined,
};

export const useAppointmentStore = create<AppointmentState & AppointmentStoreActions>()((set) => ({
  ...APPOINTMENT_INITIAL,
  setPartialChartData: (data) => {
    set((state) => ({
      chartData: { ...state.chartData, patientId: state.chartData?.patientId || '', ...data },
    }));
  },
  updateObservation: (newObservation: ObservationDTO) =>
    set((state) => {
      const currentObservations = state.chartData?.observations || [];
      const updatedObservations: ObservationDTO[] = [...currentObservations];

      const existingObservationIndex = updatedObservations.findIndex(
        (observation) => observation.field === newObservation.field
      );

      const updatedObservation = { ...updatedObservations[existingObservationIndex] };

      if (existingObservationIndex !== -1 && 'value' in newObservation) {
        if (!('note' in newObservation) && 'note' in updatedObservation) delete updatedObservation.note;

        updatedObservations[existingObservationIndex] = {
          ...updatedObservation,
          value: newObservation.value,
          ...('note' in newObservation && { note: newObservation.note }),
        } as ObservationDTO;
      } else {
        updatedObservations.push(newObservation);
      }

      return {
        chartData: {
          ...state.chartData!,
          observations: updatedObservations,
        },
      };
    }),
}));

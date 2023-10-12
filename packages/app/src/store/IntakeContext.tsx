import { Dispatch, FC, ReactNode, SetStateAction, createContext, useContext, useReducer, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { IntakeAction, IntakeState } from './types';

const initialState = {};

const PatientContext = createContext<PatientContextProps | undefined>(undefined);

type IntakeDataContextProps = {
  state: IntakeState;
  dispatch: Dispatch<IntakeAction>;
};

type PatientContextProps = {
  patientName: string;
  setPatientName: Dispatch<SetStateAction<string>>;
  isVideoOpen: boolean;
  setIsVideoOpen: Dispatch<SetStateAction<boolean>>;
  isMicOpen: boolean;
  setIsMicOpen: Dispatch<SetStateAction<boolean>>;
};

export const usePatient = (): PatientContextProps => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatient must be used within a PatientProvider');
  }
  return context;
};

export const PatientProvider: FC = () => {
  const [patientName, setPatientName] = useState('');
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isMicOpen, setIsMicOpen] = useState(false);

  return (
    <PatientContext.Provider
      value={{ patientName, setPatientName, isVideoOpen, setIsVideoOpen, isMicOpen, setIsMicOpen }}
    >
      <Outlet />
    </PatientContext.Provider>
  );
};

export const IntakeDataContext = createContext<IntakeDataContextProps>({ state: initialState, dispatch: () => null });

const intakeDataReducer = (state: IntakeState, action: IntakeAction): IntakeState => {
  switch (action.type) {
    case 'SET_FHIR_CLIENT':
      return { ...state, fhirClient: action.fhirClient };
    case 'SET_ZAMBDA_CLIENT':
      return { ...state, zambdaClient: action.zambdaClient };
    case 'UPDATE_APPOINTMENT_ID':
      return { ...state, appointmentId: action.appointmentId };
    case 'UPDATE_ADDITIONAL_INFORMATION':
      return { ...state, additionalInformation: action.additionalInformation };
    case 'UPDATE_APPOINTMENT_SLOT':
      return { ...state, appointmentSlot: action.appointmentSlot };
    case 'UPDATE_CANCELLATION_REASON':
      return { ...state, additionalInformation: action.cancellationReason };
    case 'UPDATE_CONSENT_FORM_ID':
      return { ...state, consentFormId: action.consentFormId };
    case 'UPDATE_CONSENT_FORM_SIGNER_ID':
      return { ...state, consentFormSignerId: action.consentFormSignerId };
    case 'UPDATE_COVERAGE_ID':
      return { ...state, coverageId: action.coverageId };
    case 'UPDATE_LOCATIONS':
      return { ...state, locations: action.locations };
    case 'UPDATE_LOCATION_ID':
      return { ...state, locationId: action.locationId };
    case 'UPDATE_PATIENT':
      return { ...state, patientInfo: action.patient };
    case 'UPDATE_PATIENTS':
      return { ...state, patients: action.patients };
    case 'UPDATE_PHONE_NUMBER':
      return { ...state, phoneNumber: action.phoneNumber };
    case 'UPDATE_RELATED_PERSON_ID':
      return { ...state, relatedPersonId: action.relatedPersonId };
    case 'UPDATE_RESPONSIBLE_PARTY_ID':
      return { ...state, responsiblePartyId: action.responsiblePartyId };
    case 'UPDATE_SELECTED_APPOINTMENT_SLOT_ID':
      return { ...state, selectedApptSlotId: action.selectedApptSlotId };
    case 'UPDATE_SELECTED_LOCATION':
      return { ...state, selectedLocation: action.location };
    case 'UPDATE_SLOTS':
      return { ...state, slots: action.slots };
    case 'UPDATE_SUBMITTED_INSURANCE_TYPE':
      return { ...state, submittedInsuranceType: action.submittedInsuranceType };
    case 'UPDATE_TIMEZONE':
      return { ...state, timezone: action.timezone };
    default:
      return state;
  }
};

interface IntakeDataProviderProps {
  children: ReactNode;
}

export const IntakeDataProvider: FC<IntakeDataProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(intakeDataReducer, initialState);

  return <IntakeDataContext.Provider value={{ state, dispatch }}>{children}</IntakeDataContext.Provider>;
};

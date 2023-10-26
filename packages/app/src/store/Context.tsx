import { Dispatch, FC, ReactNode, SetStateAction, createContext, useContext, useReducer, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Action, State } from './types';
import { LocalAudioTrack, LocalVideoTrack, Room } from 'twilio-video';

const initialState = {};

const VideoParticipantContext = createContext<VideoParticipantContextProps | undefined>(undefined);

const PatientContext = createContext<PatientContextProps | undefined>(undefined);

type DataContextProps = {
  dispatch: Dispatch<Action>;
  state: State;
};

type PatientContextProps = {
  patientName: string;
  setPatientName: Dispatch<SetStateAction<string>>;
};

type VideoParticipantContextProps = {
  isMicOpen: boolean;
  isVideoOpen: boolean;
  localTracks: (LocalAudioTrack | LocalVideoTrack)[];
  room: Room | null;
  selectedSpeaker: string | null;
  setIsMicOpen: Dispatch<SetStateAction<boolean>>;
  setIsVideoOpen: Dispatch<SetStateAction<boolean>>;
  setLocalTracks: Dispatch<SetStateAction<(LocalAudioTrack | LocalVideoTrack)[]>>;
  setRoom: Dispatch<SetStateAction<Room | null>>;
  setSelectedSpeaker: Dispatch<SetStateAction<string | null>>;
};

export const useVideoParticipant = (): VideoParticipantContextProps => {
  const context = useContext(VideoParticipantContext);
  if (!context) {
    throw new Error('useVideoParticipant must be used within a VideoParticipantProvider');
  }
  return context;
};

type VideoParticipantProviderProps = {
  children: ReactNode;
};

export const VideoParticipantProvider: FC<VideoParticipantProviderProps> = ({ children }) => {
  const [isMicOpen, setIsMicOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [localTracks, setLocalTracks] = useState<(LocalAudioTrack | LocalVideoTrack)[]>([]);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);

  return (
    <VideoParticipantContext.Provider
      value={{
        isMicOpen,
        isVideoOpen,
        localTracks,
        room,
        selectedSpeaker,
        setIsMicOpen,
        setIsVideoOpen,
        setLocalTracks,
        setRoom,
        setSelectedSpeaker,
      }}
    >
      {children}
    </VideoParticipantContext.Provider>
  );
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

  return (
    <PatientContext.Provider
      value={{
        patientName,
        setPatientName,
      }}
    >
      <Outlet />
    </PatientContext.Provider>
  );
};

export const DataContext = createContext<DataContextProps>({ dispatch: () => null, state: initialState });

const DataReducer = (state: State, action: Action): State => {
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

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: FC<DataProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(DataReducer, initialState);

  return <DataContext.Provider value={{ dispatch, state }}>{children}</DataContext.Provider>;
};

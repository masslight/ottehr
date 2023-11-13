import { Dispatch, FC, ReactNode, SetStateAction, createContext, useContext, useReducer, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LocalAudioTrack, LocalVideoTrack, Room } from 'twilio-video';
import { Action, State } from './types';

const initialState = {};

// Data

type DataContextProps = {
  dispatch: Dispatch<Action>;
  state: State;
};

export const DataContext = createContext<DataContextProps>({ dispatch: () => null, state: initialState });

const DataReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_FHIR_CLIENT':
      return { ...state, fhirClient: action.fhirClient };
    case 'SET_ZAMBDA_CLIENT':
      return { ...state, zambdaClient: action.zambdaClient };
    case 'UPDATE_PATIENT':
      return { ...state, patientInfo: action.patientInfo };
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

// Patient

type PatientContextProps = {
  patientName: string;
  providerId: string;
  providerName: string;
  setPatientName: Dispatch<SetStateAction<string>>;
  setProviderId: Dispatch<SetStateAction<string>>;
  setProviderName: Dispatch<SetStateAction<string>>;
};

const PatientContext = createContext<PatientContextProps | undefined>(undefined);

export const PatientProvider: FC = () => {
  const [patientName, setPatientName] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providerName, setProviderName] = useState('');

  return (
    <PatientContext.Provider
      value={{
        patientName,
        providerId,
        providerName,
        setPatientName,
        setProviderId,
        setProviderName,
      }}
    >
      <Outlet />
    </PatientContext.Provider>
  );
};

export const usePatient = (): PatientContextProps => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatient must be used within a PatientProvider');
  }
  return context;
};

// Video

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

const VideoParticipantContext = createContext<VideoParticipantContextProps | undefined>(undefined);

type VideoParticipantProviderProps = {
  children: ReactNode;
};

export const VideoParticipantProvider: FC<VideoParticipantProviderProps> = ({ children }) => {
  const [isMicOpen, setIsMicOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [localTracks, setLocalTracks] = useState<(LocalAudioTrack | LocalVideoTrack)[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
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

export const useVideoParticipant = (): VideoParticipantContextProps => {
  const context = useContext(VideoParticipantContext);
  if (!context) {
    throw new Error('useVideoParticipant must be used within a VideoParticipantProvider');
  }
  return context;
};

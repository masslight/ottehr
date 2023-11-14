import {
  Dispatch,
  FC,
  ReactNode,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';
import { Outlet } from 'react-router-dom';
import { LocalAudioTrack, LocalVideoTrack, Room } from 'twilio-video';
import { Action, State } from './types';
import { useAuth0 } from '@auth0/auth0-react';
import { setFhirClient } from './Actions';
import { zapehrApi } from '../api/zapehrApi';

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
  setPatientName: Dispatch<SetStateAction<string>>;
};

const PatientContext = createContext<PatientContextProps | undefined>(undefined);

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

// Practitioner

type PractitionerProfile = {
  [key: string]: any;
};

type PractitionerContextProps = {
  practitionerProfile: PractitionerProfile | null | undefined;
  setPractitionerProfile: Dispatch<SetStateAction<PractitionerProfile | null>>;
};

const PractitionerContext = createContext<PractitionerContextProps | undefined>(undefined);

interface PractitionerProviderProps {
  children: ReactNode;
}

// Define the PractitionerProvider component with explicit props
export const PractitionerProvider: FC<PractitionerProviderProps> = ({ children }) => {
  const [practitionerProfile, setPractitionerProfile] = useState<Partial<PractitionerProfile | null | undefined>>(null);
  const { isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const { state, dispatch } = useContext(DataContext);

  useEffect(() => {
    async function setFhirClientToken(): Promise<void> {
      if (isAuthenticated) {
        const accessToken = await getAccessTokenSilently();
        const user = await zapehrApi.getUser(accessToken);
        const userId = user.profile.split('/')[1];
        console.log('user', user);
        setFhirClient(accessToken, dispatch);
        const fhirClient = state.fhirClient;
        const profile = await fhirClient?.readResource({
          resourceId: userId,
          resourceType: 'Practitioner',
        });
        setPractitionerProfile(profile);

        console.log('profile', profile);
      } else if (!isAuthenticated && !isLoading) {
        loginWithRedirect().catch((error: Error) => {
          console.error(`Error calling loginWithRedirect: ${error}`);
        });
      }
    }
    setFhirClientToken().catch((error) => {
      console.log(error);
    });
  }, [dispatch, getAccessTokenSilently, isAuthenticated]);

  return (
    <PractitionerContext.Provider value={{ practitionerProfile, setPractitionerProfile }}>
      {children}
    </PractitionerContext.Provider>
  );
};

export const usePractitioner = (): PractitionerContextProps => {
  const context = useContext(PractitionerContext);
  if (!context) {
    throw new Error('usePractitioner must be used within a PractitionerProvider');
  }
  return context;
};

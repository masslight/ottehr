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
import { getUser } from '../api';
import { Practitioner } from 'fhir/r4';

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

type ParticipantContextProps = {
  patientName: string;
  providerId: string;
  providerName: string;
  setPatientName: Dispatch<SetStateAction<string>>;
  setProviderId: Dispatch<SetStateAction<string>>;
  setProviderName: Dispatch<SetStateAction<string>>;
};

const ParticipantContext = createContext<ParticipantContextProps | undefined>(undefined);

export const ParticipantProvider: FC = () => {
  const [patientName, setPatientName] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providerName, setProviderName] = useState('');

  return (
    <ParticipantContext.Provider
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
    </ParticipantContext.Provider>
  );
};

export const useParticipant = (): ParticipantContextProps => {
  const context = useContext(ParticipantContext);
  if (!context) {
    throw new Error('useParticipant must be used within a ParticipantProvider');
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

type Provider = {
  firstName: string;
  lastName: string;
  slug: string;
  title: string;
};

type PractitionerContextProps = {
  practitionerProfile: Practitioner | null | undefined;
  provider: Provider | undefined;
};

const PractitionerContext = createContext<PractitionerContextProps | undefined>(undefined);

export const PractitionerProvider: FC = () => {
  const [accessToken, setAccessToken] = useState<string>('');
  const [practitionerProfile, setPractitionerProfile] = useState<Practitioner | null | undefined>(null);
  const [provider, setProvider] = useState<Provider | undefined>();
  const { state, dispatch } = useContext(DataContext);
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    async function setFhirClientToken(): Promise<void> {
      if (isAuthenticated) {
        const accessToken = await getAccessTokenSilently();
        setFhirClient(accessToken, dispatch);
        setAccessToken(accessToken);
      }
    }
    setFhirClientToken().catch((error) => {
      console.log(error);
    });
  }, [dispatch, getAccessTokenSilently, isAuthenticated]);

  useEffect(() => {
    async function setUserProfile(): Promise<void> {
      const user = await getUser(accessToken);
      const [resourceType, userId] = user.profile.split('/');
      const fhirClient = state.fhirClient;
      const profile = await fhirClient?.readResource<Practitioner>({
        resourceId: userId,
        resourceType: resourceType,
      });
      const provider: Provider = {
        firstName: profile?.name && profile.name[0].given ? profile.name[0].given[0] : '',
        lastName: profile?.name && profile.name[0].family ? profile.name[0].family : '',
        slug: profile?.identifier && profile.identifier[0].value ? profile.identifier[0].value : '',
        title: profile?.name && profile.name[0].prefix ? profile.name[0].prefix[0] : '',
      };
      setProvider(provider);
      setPractitionerProfile(profile);
    }
    if (state.fhirClient) {
      setUserProfile().catch((error) => {
        console.log(error);
      });
    }
  }, [accessToken, state.fhirClient]);

  return (
    <PractitionerContext.Provider value={{ practitionerProfile, provider }}>
      <Outlet />
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

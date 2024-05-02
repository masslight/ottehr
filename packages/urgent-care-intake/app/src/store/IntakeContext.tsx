import { createContext, Dispatch, FC, ReactNode, useReducer } from 'react';
import { IntakeState, IntakeAction } from './types';

const initialState = {};

type IntakeDataContextProps = {
  state: IntakeState;
  dispatch: Dispatch<IntakeAction>;
};

export const IntakeDataContext = createContext<IntakeDataContextProps>({ state: initialState, dispatch: () => null });

const intakeDataReducer = (state: IntakeState, action: IntakeAction): IntakeState => {
  switch (action.type) {
    case 'SET_VISIT_TYPE':
      return { ...state, visitType: action.visitType };
    case 'UPDATE_PATIENTS':
      return { ...state, patients: action.patients };
    case 'UPDATE_PATIENT':
      return { ...state, patientInfo: action.patient };
    case 'UPDATE_SELECTED_LOCATION':
      return { ...state, selectedLocation: action.location };
    case 'UPDATE_APPOINTMENT_SLOT':
      return { ...state, appointmentSlot: action.appointmentSlot };
    case 'UPDATE_APPOINTMENT_ID':
      return { ...state, appointmentID: action.appointmentID };
    case 'UPDATE_NETWORK_ERROR':
      return { ...state, networkError: action.networkError };
    case 'UPDATE_PAPERWORK_QUESTIONS':
      return { ...state, paperworkQuestions: action.paperworkQuestions };
    case 'UPDATE_COMPLETED_PAPERWORK':
      // when paperwork is a parameter, include the current paperwork
      return { ...state, completedPaperwork: { ...state.completedPaperwork, ...action.completedPaperwork } };
    case 'UPDATE_FILE_URLS':
      return { ...state, fileURLs: action.fileURLs };
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

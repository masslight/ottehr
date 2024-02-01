import React, { createContext, Dispatch, FC, ReactNode, useReducer } from 'react';
import { IntakeState, IntakeAction } from './types';

const initialState = {};

type IntakeDataContextProps = {
  state: IntakeState;
  dispatch: Dispatch<IntakeAction>;
};

export const IntakeDataContext = createContext<IntakeDataContextProps>({
  state: initialState,
  dispatch: () => null,
});

const intakeDataReducer = (state: IntakeState, action: IntakeAction): IntakeState => {
  switch (action.type) {
    case 'SET_FHIR_CLIENT':
      return { ...state, fhirClient: action.fhirClient };
    case 'SET_APP_CLIENT':
      return { ...state, appClient: action.appClient };
    case 'SET_ZAMBDA_CLIENT':
      return { ...state, zambdaClient: action.zambdaClient };
    case 'SET_INTAKE_ZAMBDA_CLIENT':
      return { ...state, intakeZambdaClient: action.intakeZambdaClient };
    case 'SET_Z3_CLIENT':
      return { ...state, z3Client: action.z3Client };
    case 'SET_USER':
      return { ...state, user: action.user };
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

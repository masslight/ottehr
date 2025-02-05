import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { sidebarMenuIcons } from '../components/Sidebar';
import { CSSModal } from '../components/CSSModal';
import { ROUTER_PATH, routesCSS } from '../routing/routesCSS';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';

export type InteractionMode = 'intake' | 'provider' | 'readonly';

export type CSSValidator = () => React.ReactElement | string;

export type CSSValidators = Record<string, CSSValidator>;

export interface RouteCSS {
  path: ROUTER_PATH;
  sidebarPath?: string; // used for generating link in sidebar if route has dynamic slug
  activeCheckPath?: string; // helps to check active path if route contains dynamic slug
  modes: InteractionMode[];
  element: React.ReactNode;
  text: string;
  iconKey: keyof typeof sidebarMenuIcons;
  isSkippedInNavigation?: boolean;
}

interface NavigationContextType {
  currentRoute: string | undefined;
  goToNext: () => void;
  goToPrevious: () => void;
  addNextPageValidators: (validatiors: CSSValidators) => void; // blocks next navigation if validators return non empty string and show modal with this message.
  addPreviousPageValidators: (validatiors: CSSValidators) => void; // blocks navigation if validators return non empty string and show modal with this message.
  resetNavigationState: () => void;
  setIsNavigationHidden: (hide: boolean) => void;
  isNavigationHidden: boolean;
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;
  availableRoutes: string[];
  isFirstPage: boolean;
  isLastPage: boolean;
  isNavigationDisabled: boolean;
  setNavigationDisable: (state: Record<string, boolean>) => void; // disable intake navigation buttons, use case - updating required field
  nextButtonText: string;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// hack for safe using ounside context in the telemed components
export let setNavigationDisable: NavigationContextType['setNavigationDisable'] = () => {
  return;
};

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const nextPageValidatorsRef = useRef<CSSValidators>({});
  const previousPageValidatorsRef = useRef<CSSValidators>({});

  const [isNavigationHidden, setIsNavigationHidden] = useState(false);

  const [interactionMode, _setInteractionMode] = useState<InteractionMode>('intake'); // todo: calc actual initial InteractionMode value

  const [modalContent, setModalContent] = useState<ReturnType<CSSValidator>>();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [_disabledNavigationState, _setDisabledNavigationState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (interactionMode === 'intake') {
      setIsNavigationHidden(false);
    } else {
      setIsNavigationHidden(true);
    }
  }, [interactionMode]);

  setNavigationDisable = (newState: Record<string, boolean>): void => {
    let shouldUpdate = false;
    for (const key of Object.keys(newState)) {
      if (!!_disabledNavigationState[key] !== !!newState[key]) {
        shouldUpdate = true;
        break;
      }
    }
    if (shouldUpdate) {
      _setDisabledNavigationState({ ..._disabledNavigationState, ...newState });
    }
  };

  const isNavigationDisabled = Object.values(_disabledNavigationState).some(Boolean);

  const addNextPageValidators = (newValidators: CSSValidators): void => {
    nextPageValidatorsRef.current = { ...nextPageValidatorsRef.current, ...newValidators };
  };

  const addPreviousPageValidators = (newValidators: CSSValidators): void => {
    previousPageValidatorsRef.current = { ...previousPageValidatorsRef.current, ...newValidators };
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const resetNavigationState = (): void => {
    nextPageValidatorsRef.current = {};
    previousPageValidatorsRef.current = {};
    setIsModalOpen(false);
    setModalContent('');
    _setDisabledNavigationState({});
  };

  const availableRoutes = Object.values(routesCSS)
    .filter((route) => route.modes.includes(interactionMode))
    .map((route) => route.path);

  const setInteractionMode = (mode: InteractionMode): void => {
    const basePath = location.pathname.match(/.*?(in-person)\/[^/]*/)?.[0];

    if (!basePath) {
      return;
    }

    const firstAvailableRoute = Object.values(routesCSS).find((route) => route.modes.includes(mode));

    if (!firstAvailableRoute) {
      return;
    }

    const routePath = firstAvailableRoute.sidebarPath || firstAvailableRoute.path;
    const newPath = `${basePath}/${routePath}`;
    _setInteractionMode(mode);
    navigate(newPath);
  };

  const currentRouteIndex = availableRoutes.indexOf((location.pathname.split('/').pop() || '') as ROUTER_PATH);
  const currentRoute = availableRoutes[currentRouteIndex];

  const goToNext = useCallback(() => {
    if (currentRouteIndex < availableRoutes.length - 1) {
      const validators = Object.values(nextPageValidatorsRef.current);
      for (let i = 0; i < validators.length; i++) {
        const validationResult = validators[i]();
        if (validationResult) {
          setModalContent(validationResult);
          setIsModalOpen(true);
          return;
        }
      }
      navigate(availableRoutes[currentRouteIndex + 1]);
    }
  }, [availableRoutes, currentRouteIndex, navigate]);

  const goToPrevious = useCallback(() => {
    if (currentRouteIndex > 0) {
      const validators = Object.values(previousPageValidatorsRef.current);
      for (let i = 0; i < validators.length; i++) {
        const validationResult = validators[i]();
        if (validationResult) {
          setModalContent(validationResult);
          setIsModalOpen(true);
          return;
        }
      }
      navigate(availableRoutes[currentRouteIndex - 1]);
    }
  }, [availableRoutes, currentRouteIndex, navigate]);

  const isFirstPage = currentRouteIndex === 0;
  const isLastPage = currentRouteIndex === availableRoutes.length - 1;

  const { chartData, isChartDataLoading } = getSelectors(useAppointmentStore, ['chartData', 'isChartDataLoading']);

  const nextButtonText = (() => {
    if (isChartDataLoading) return ' ';
    switch (currentRoute) {
      case 'allergies':
        return chartData?.allergies?.length ? 'Allergies Confirmed' : 'Confirmed No Known Allergies';
      case 'medications':
        return chartData?.medications?.length ? 'Medications Confirmed' : 'Confirmed No Medications';
      case 'medical-conditions':
        return chartData?.conditions?.length ? 'Medical Conditions Confirmed' : 'Confirmed No Medical Conditions';
      case 'surgical-history':
        return chartData?.procedures?.length ? 'Surgical History Confirmed' : 'Confirmed No Surgical History';
      case 'hospitalization':
        return `${
          chartData?.episodeOfCare?.length ? 'Hospitalization Confirmed' : 'Confirmed No Hospitalization'
        } AND Complete Intake`;
      default:
        return isLastPage ? 'Complete' : 'Next';
    }
  })();

  return (
    <NavigationContext.Provider
      value={{
        currentRoute,
        goToNext,
        goToPrevious,
        addNextPageValidators,
        addPreviousPageValidators,
        resetNavigationState: resetNavigationState,
        setIsNavigationHidden,
        isNavigationHidden,
        interactionMode,
        setInteractionMode,
        availableRoutes,
        isFirstPage,
        isLastPage,
        setNavigationDisable,
        isNavigationDisabled,
        nextButtonText,
      }}
    >
      {children}
      <CSSModal
        open={isModalOpen}
        handleClose={closeModal}
        title="Validation Error"
        description={modalContent as React.ReactElement}
        closeButtonText="Close"
        confirmText="OK"
        handleConfirm={closeModal}
      />
    </NavigationContext.Provider>
  );
};

export const useNavigationContext = (): NavigationContextType => {
  const context = useContext(NavigationContext);

  if (context === undefined) {
    throw new Error('useNavigationContext must be used within a NavigationProvider');
  }

  // clear state on component unmount
  useEffect(() => {
    return () => {
      context?.resetNavigationState?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return context;
};

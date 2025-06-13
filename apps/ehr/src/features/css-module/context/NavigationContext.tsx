import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useMatch, useNavigate, useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { CSSModal } from '../components/CSSModal';
import { sidebarMenuIcons } from '../components/Sidebar';
import { useAppointment } from '../hooks/useAppointment';
import { ROUTER_PATH, routesCSS } from '../routing/routesCSS';

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
  addNextPageValidators: (validators: CSSValidators) => void; // blocks next navigation if validators return non empty string and show modal with this message.
  addPreviousPageValidators: (validators: CSSValidators) => void; // blocks navigation if validators return non empty string and show modal with this message.
  resetNavigationState: () => void;
  setIsNavigationHidden: (hide: boolean) => void;
  isNavigationHidden: boolean;
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode, shouldNavigate: boolean) => void;
  availableRoutes: RouteCSS[];
  isFirstPage: boolean;
  isLastPage: boolean;
  isNavigationDisabled: boolean;
  setNavigationDisable: (state: Record<string, boolean>) => void; // disable intake navigation buttons, use case - updating required field
  nextButtonText: string;
  isLoading: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// hack for safe using outside context in the telemed components
export let setNavigationDisable: NavigationContextType['setNavigationDisable'] = () => {
  return;
};

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { id: appointmentID } = useParams();

  const navigate = useNavigate();
  const location = useLocation();

  const nextPageValidatorsRef = useRef<CSSValidators>({});
  const previousPageValidatorsRef = useRef<CSSValidators>({});

  const [isNavigationHidden, setIsNavigationHidden] = useState(false);

  const [isModeInitialized, setIsModeInitialized] = useState(false);
  const [interactionMode, _setInteractionMode] = useState<InteractionMode>('intake'); // todo: calc actual initial InteractionMode value

  const [modalContent, setModalContent] = useState<ReturnType<CSSValidator>>();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [_disabledNavigationState, _setDisabledNavigationState] = useState<Record<string, boolean>>({});

  const { isLoading, visitState } = useAppointment(appointmentID);
  const { encounter } = visitState;
  const { chartData, isChartDataLoading } = getSelectors(useAppointmentStore, ['chartData', 'isChartDataLoading']);

  const setInteractionMode = useCallback(
    (mode: InteractionMode, shouldNavigate: boolean): void => {
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
      setIsModeInitialized(true);

      if (shouldNavigate) {
        navigate(newPath);
      }
    },
    [location.pathname, navigate]
  );

  useEffect(() => {
    if (
      encounter?.participant?.find(
        (participant) =>
          participant.type?.find(
            (type) =>
              type.coding?.find(
                (coding) =>
                  coding.system === 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType' &&
                  coding.code === 'ATND'
              ) != null
          ) != null
      ) &&
      !isModeInitialized
    ) {
      setInteractionMode('provider', false);
    } else if (encounter?.id) {
      setIsModeInitialized(true);
    }
  }, [encounter?.id, encounter?.participant, setInteractionMode, interactionMode, isModeInitialized]);

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

  const availableRoutes = Object.values(routesCSS).filter(
    (route) => !isLoading && isModeInitialized && route.modes.includes(interactionMode)
  );
  const availableRoutesForBottomNavigation = availableRoutes.filter((route) => !route.isSkippedInNavigation);

  const availableRoutesPathsForBottomNavigation = availableRoutesForBottomNavigation.map(
    (route) => route.sidebarPath || route.path
  );

  const match = useMatch('/in-person/:id/*');
  const splat = match?.params['*'];
  const currentRouteIndex = availableRoutesPathsForBottomNavigation.indexOf(splat || '');
  const currentRoute = availableRoutesPathsForBottomNavigation[currentRouteIndex];
  const isFirstPage = currentRouteIndex === 0;
  const isLastPage = currentRouteIndex === availableRoutesPathsForBottomNavigation.length - 1;
  const nextRoutePath = !isLastPage ? availableRoutesPathsForBottomNavigation?.[currentRouteIndex + 1] : null;
  const previousRoutePath = !isFirstPage ? availableRoutesPathsForBottomNavigation?.[currentRouteIndex - 1] : null;

  // Hide bottom navigation for pages that shouldn't be accessed through the bottom navigation
  // These pages will have currentRouteIndex === -1 because they are not in the availableRoutesPathsForBottomNavigation array
  // Examples: order details, order edit pages
  const isPageWithHiddenBottomNavigation = currentRouteIndex === -1;

  useEffect(() => {
    setIsNavigationHidden(isPageWithHiddenBottomNavigation);
  }, [isPageWithHiddenBottomNavigation]);

  const goToNext = useCallback(() => {
    if (!nextRoutePath) {
      return;
    }

    const validators = Object.values(nextPageValidatorsRef.current);

    for (let i = 0; i < validators.length; i++) {
      const validationResult = validators[i]();

      if (validationResult) {
        setModalContent(validationResult);
        setIsModalOpen(true);
        return;
      }
    }

    navigate(nextRoutePath);
  }, [nextRoutePath, navigate]);

  const goToPrevious = useCallback(() => {
    if (!previousRoutePath) {
      return;
    }

    const validators = Object.values(previousPageValidatorsRef.current);

    for (let i = 0; i < validators.length; i++) {
      const validationResult = validators[i]();
      if (validationResult) {
        setModalContent(validationResult);
        setIsModalOpen(true);
        return;
      }
    }

    navigate(previousRoutePath);
  }, [previousRoutePath, navigate]);

  const nextButtonText = (() => {
    if (isChartDataLoading) return ' ';

    if (interactionMode === 'intake') {
      switch (currentRoute) {
        case 'allergies':
          return chartData?.allergies?.length ? 'Allergies Confirmed' : 'Confirmed No Known Allergies';
        case 'medications':
          return chartData?.medications?.length ? 'Medications Confirmed' : 'Confirmed No Medications';
        case 'medical-conditions':
          return chartData?.conditions?.length ? 'Medical Conditions Confirmed' : 'Confirmed No Medical Conditions';
        case 'surgical-history':
          return chartData?.surgicalHistory?.length ? 'Surgical History Confirmed' : 'Confirmed No Surgical History';
        case 'hospitalization':
          return `${
            chartData?.episodeOfCare?.length ? 'Hospitalization Confirmed' : 'Confirmed No Hospitalization'
          } AND Complete Intake`;
        default:
          return isLastPage ? 'Complete' : 'Next';
      }
    }

    return 'Next';
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
        isLoading: isLoading || !isModeInitialized,
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

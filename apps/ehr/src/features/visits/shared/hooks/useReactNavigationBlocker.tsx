import { Box } from '@mui/material';
import React, { ReactElement, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';

type ConfirmationModalProps =
  | {
      /** Title Case. */
      title?: string;
      /** Replaces the hook's `modalText`. */
      description?: ReactNode;
      /** Rendered under the description. */
      ContentComponent?: ReactElement;
      /** The button that keeps the user where they are. */
      stayLabel?: string;
      /** The button that lets the blocked action go ahead. */
      proceedLabel?: string;
    }
  | undefined;

type Options = {
  interceptNavigation?: boolean;
};

export const useReactNavigationBlocker = (
  shouldBlock: () => boolean,
  modalText = 'You have unsaved changes that will be lost if you leave this page.',
  options?: Options
): {
  ConfirmationModal: React.FC<ConfirmationModalProps>;
  requestConfirmation: () => Promise<boolean>;
} => {
  const { interceptNavigation = true } = options ?? {};

  const [isModalOpen, setIsModalOpen] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const navigationContext = React.useContext(UNSAFE_NavigationContext);
  const lastLocationRef = useRef(location);

  const requestConfirmation = useCallback((): Promise<boolean> => {
    if (!shouldBlock()) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      setIsModalOpen(true);
      resolveRef.current = resolve;
    });
  }, [shouldBlock]);

  const handleStay = useCallback(() => {
    setIsModalOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const handleProceed = useCallback(() => {
    setIsModalOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  useEffect(() => {
    if (!interceptNavigation || !shouldBlock()) return;

    const originalPush = navigationContext.navigator.push;
    const originalReplace = navigationContext.navigator.replace;

    navigationContext.navigator.push = async (to, state) => {
      const canProceed = await requestConfirmation();
      if (canProceed) originalPush(to, state);
    };

    navigationContext.navigator.replace = async (to, state) => {
      const canProceed = await requestConfirmation();
      if (canProceed) originalReplace(to, state);
    };

    return () => {
      navigationContext.navigator.push = originalPush;
      navigationContext.navigator.replace = originalReplace;
    };
  }, [navigationContext, interceptNavigation, shouldBlock, requestConfirmation]);

  useEffect(() => {
    if (!interceptNavigation) return;

    if (location !== lastLocationRef.current && shouldBlock()) {
      const checkNavigation = async (): Promise<void> => {
        const canProceed = await requestConfirmation();
        if (!canProceed) {
          navigate(lastLocationRef.current, { replace: true });
        } else {
          lastLocationRef.current = location;
        }
      };
      void checkNavigation();
    } else {
      lastLocationRef.current = location;
    }
  }, [location, navigate, interceptNavigation, shouldBlock, requestConfirmation]);

  const ConfirmationModal: React.FC<ConfirmationModalProps> = (props) => {
    const {
      title = 'Confirmation Required',
      description = modalText,
      ContentComponent,
      stayLabel = 'Continue Editing',
      proceedLabel = 'Leave',
    } = props ?? {};

    // ✕, Esc and a backdrop click all mean "stay": only the primary button lets the action go ahead.
    return (
      <AppDialog
        variant="alert"
        open={isModalOpen}
        onClose={handleStay}
        title={title}
        dismiss={{ label: stayLabel }}
        primary={{ label: proceedLabel, onClick: handleProceed }}
      >
        <Box data-testid={dataTestIds.dialog.inPersonModalContent}>
          <Box>{description}</Box>
          {ContentComponent}
        </Box>
      </AppDialog>
    );
  };

  return { ConfirmationModal, requestConfirmation };
};

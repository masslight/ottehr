import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import { InPersonModal } from '../../in-person/components/InPersonModal';

type InPersonModalProps =
  | Partial<Omit<React.ComponentProps<typeof InPersonModal>, 'handleConfirm' | 'open' | 'handleClose'>>
  | undefined;

type Options = {
  interceptNavigation?: boolean;
};

export const useReactNavigationBlocker = (
  shouldBlock: () => boolean,
  modalText = 'You have unsaved changes that will be lost if you leave this page.',
  options?: Options
): {
  ConfirmationModal: React.FC<InPersonModalProps>;
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

  const handleConfirm = useCallback(() => {
    setIsModalOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
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

  const ConfirmationModal: React.FC<InPersonModalProps> = (props) => {
    const {
      title = 'Confirmation Required',
      confirmText = 'Continue edit',
      closeButtonText = 'Leave',
      ...rest
    } = props ?? {};

    return (
      <InPersonModal
        open={isModalOpen}
        handleClose={handleClose}
        title={title}
        description={modalText}
        handleConfirm={handleConfirm}
        confirmText={confirmText}
        closeButtonText={closeButtonText}
        closeButton={false}
        {...rest}
      />
    );
  };

  return { ConfirmationModal, requestConfirmation };
};

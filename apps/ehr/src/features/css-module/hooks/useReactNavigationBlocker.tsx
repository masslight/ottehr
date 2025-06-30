import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import { CSSModal } from '../components/CSSModal';

export const useReactNavigationBlocker = (
  shouldBlock: () => boolean,
  modalText = 'You have unsaved changes that will be lost if you leave this page.'
): { ConfirmationModal: React.FC } => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const resolveRef = useRef<((value: unknown) => void) | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const navigationContext = React.useContext(UNSAFE_NavigationContext);
  const lastLocationRef = useRef(location);

  const showConfirmDialog = useCallback(() => {
    if (!shouldBlock()) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      setIsModalOpen(true);
      resolveRef.current = resolve;
    });
  }, [shouldBlock]);

  const handleConfirm = useCallback(() => {
    setIsModalOpen(false);
    resolveRef.current?.(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    resolveRef.current?.(true);
  }, []);

  useEffect(() => {
    if (!shouldBlock()) return;

    const originalPush = navigationContext.navigator.push;
    const originalReplace = navigationContext.navigator.replace;

    navigationContext.navigator.push = async (to, state) => {
      const canProceed = await showConfirmDialog();
      if (canProceed) {
        originalPush(to, state);
      }
    };

    navigationContext.navigator.replace = async (to, state) => {
      const canProceed = await showConfirmDialog();
      if (canProceed) {
        originalReplace(to, state);
      }
    };

    return () => {
      navigationContext.navigator.push = originalPush;
      navigationContext.navigator.replace = originalReplace;
    };
  }, [navigationContext, shouldBlock, showConfirmDialog]);

  useEffect(() => {
    if (location !== lastLocationRef.current && shouldBlock()) {
      const checkNavigation = async (): Promise<void> => {
        const canProceed = await showConfirmDialog();
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
  }, [location, navigate, shouldBlock, showConfirmDialog]);

  const ConfirmationModal = (): React.ReactElement => (
    <CSSModal
      open={isModalOpen}
      handleClose={handleClose}
      title="Confirmation Required"
      description={modalText}
      handleConfirm={handleConfirm}
      confirmText="Continue edit"
      closeButtonText="Leave"
      closeButton={false}
    />
  );

  return { ConfirmationModal };
};

import { ReactElement, useEffect, useState } from 'react';
import { AppDialog } from './AppDialog';

interface LogoutWarningProps {
  modalOpen: boolean;
  onEnd: () => void;
  onContinue: () => void;
  timeoutInSeconds: number;
}

export default function LogoutWarning({
  modalOpen,
  onEnd,
  onContinue,
  timeoutInSeconds,
}: LogoutWarningProps): ReactElement {
  const [countdown, setCountdown] = useState(timeoutInSeconds);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (modalOpen) {
      setCountdown(timeoutInSeconds);

      intervalId = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            clearInterval(intervalId);
            onEnd();
            return 0;
          }
          return prevCountdown - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [modalOpen, timeoutInSeconds, onEnd]);

  const handleContinue = (): void => {
    setCountdown(timeoutInSeconds);
    onContinue();
  };

  // Esc and a backdrop click have always ended the session here, and still do. The ✕ is new with the
  // standard shell; it keeps the session, since a close button should never log anyone out.
  return (
    <AppDialog
      variant="alert"
      open={modalOpen}
      onClose={(reason) => (reason === 'closeButton' ? handleContinue() : onEnd())}
      title="Your Session Is About to Expire"
      primary={{ label: 'End Session', onClick: onEnd }}
      dismiss={{ label: 'Continue Session', onClick: handleContinue }}
    >
      You will be logged out in {countdown} seconds due to inactivity.
    </AppDialog>
  );
}

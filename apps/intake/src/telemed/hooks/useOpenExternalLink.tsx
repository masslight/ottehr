import { createIOSMesssageOpenPageExternal, sendIOSAppMessage } from '../features/ios-communication';
import { useIOSAppSync } from '../features/ios-communication/useIOSAppSync';

export const useOpenExternalLink = (): ((link: string) => void) => {
  const { isIOSApp } = useIOSAppSync();
  return (link: string): void => {
    if (isIOSApp) {
      sendIOSAppMessage(createIOSMesssageOpenPageExternal(link));
    } else {
      window.open(link, '_blank');
    }
  };
};

const iOSAppMessageTypeLiterals = {
  CALL_STARTED: 'CALL_STARTED' as const,
  ACCESS_TOKEN: 'ACCESS_TOKEN' as const,
  CLOSE_WEB_VIEW: 'CLOSE_WEB_VIEW' as const,
  OPEN_PAGE: 'OPEN_PAGE' as const,
  OPEN_PAGE_EXTERNAL: 'OPEN_PAGE_EXTERNAL' as const,
};

// message types
interface IOSMessageWWaitingRoomStatus {
  type: typeof iOSAppMessageTypeLiterals.CALL_STARTED;
  payload: { appointmentID: string };
}

interface IOSMessageWAccessToken {
  type: typeof iOSAppMessageTypeLiterals.ACCESS_TOKEN;
  payload: string;
}

interface IOSMessageCloseWebView {
  type: typeof iOSAppMessageTypeLiterals.CLOSE_WEB_VIEW;
}

interface IOSMessageOpenPage {
  type: typeof iOSAppMessageTypeLiterals.OPEN_PAGE;
  payload: string;
}

interface IOSMessageOpenPageExternal {
  type: typeof iOSAppMessageTypeLiterals.OPEN_PAGE_EXTERNAL;
  payload: string;
}

// message creators
export const createIOSMessageCallStarted = (
  payload: IOSMessageWWaitingRoomStatus['payload']
): IOSMessageWWaitingRoomStatus => ({
  type: 'CALL_STARTED',
  payload,
});
export const createIOSMessageWAccessToken = (payload: string): IOSMessageWAccessToken => ({
  type: 'ACCESS_TOKEN',
  payload,
});
export const createIOSMessageCloseWebView = (): IOSMessageCloseWebView => ({
  type: 'CLOSE_WEB_VIEW',
});
export const createIOSMessageOpenPage = (payload: string): IOSMessageOpenPage => ({
  type: 'OPEN_PAGE',
  payload,
});
export const createIOSMessageOpenPageExternal = (payload: string): IOSMessageOpenPageExternal => ({
  type: 'OPEN_PAGE_EXTERNAL',
  payload,
});

type IOSCommunicationMessage =
  | IOSMessageWAccessToken
  | IOSMessageWWaitingRoomStatus
  | IOSMessageCloseWebView
  | IOSMessageOpenPage
  | IOSMessageOpenPageExternal;

export const sendIOSAppMessage = (message: IOSCommunicationMessage): void => {
  if ((window as any).webkit?.messageHandlers?.iosAppCommunicationChannel) {
    (window as any).webkit.messageHandlers.iosAppCommunicationChannel?.postMessage?.(JSON.stringify(message));
  } else {
    throw Error('iOS app message communication channel is not set');
  }
};

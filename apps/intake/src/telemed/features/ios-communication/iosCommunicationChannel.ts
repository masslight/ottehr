// message types
interface IOSMessageWWaitingRoomStatus {
  type: 'CALL_STARTED';
  payload: { appointmentID: string };
}

interface IOSMessageWAccessToken {
  type: 'ACCESS_TOKEN';
  payload: string;
}

interface IOSMessageCloseWebView {
  type: 'CLOSE_WEB_VIEW';
}

interface IOSMessageOpenPage {
  type: 'OPEN_PAGE';
  payload: string;
}

interface IOSMessageOpenPageExternal {
  type: 'OPEN_PAGE_EXTERNAL';
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

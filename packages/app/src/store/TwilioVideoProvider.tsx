/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
// import React, { createContext, ReactNode, useCallback } from 'react';
// import { CreateLocalTrackOptions, ConnectOptions, LocalAudioTrack, LocalVideoTrack, Room } from 'twilio-video';
// import { ErrorCallback } from '../../types';
// import { SelectedParticipantProvider } from './useSelectedParticipant/useSelectedParticipant';

// import useHandleRoomDisconnection from './useHandleRoomDisconnection/useHandleRoomDisconnection';
// import useHandleTrackPublicationFailed from './useHandleTrackPublicationFailed/useHandleTrackPublicationFailed';
// import useLocalTracks from './useLocalTracks/useLocalTracks';
// import useRestartAudioTrackOnDeviceChange from './useRestartAudioTrackOnDeviceChange/useRestartAudioTrackOnDeviceChange';
// import useRoom from './useRoom/useRoom';

// /*
//  *  The hooks used by the VideoProvider component are different than the hooks found in the 'hooks/' directory. The hooks
//  *  in the 'hooks/' directory can be used anywhere in a video application, and they can be used any number of times.
//  *  the hooks in the 'VideoProvider/' directory are intended to be used by the VideoProvider component only. Using these hooks
//  *  elsewhere in the application may cause problems as these hooks should not be used more than once in an application.
//  */

// export interface IVideoContext {
//   room: Room | null;
//   localTracks: (LocalAudioTrack | LocalVideoTrack)[];
//   isConnecting: boolean;
//   connect: (token: string) => Promise<void>;
//   onError: ErrorCallback;
//   getLocalVideoTrack: (newOptions?: CreateLocalTrackOptions) => Promise<LocalVideoTrack>;
//   isAcquiringLocalTracks: boolean;
//   removeLocalVideoTrack: () => void;
//   getAudioAndVideoTracks: () => Promise<void>;
// }

// export const VideoContext = createContext<IVideoContext>(null!);

// interface VideoProviderProps {
//   options?: ConnectOptions;
//   onError: ErrorCallback;
//   children: ReactNode;
// }

// export function VideoProvider({ options, children, onError = () => {} }: VideoProviderProps) {
//   const onErrorCallback: ErrorCallback = useCallback(
//     (error: { message: any }) => {
//       console.log(`ERROR: ${error.message}`, error);
//       onError(error);
//     },
//     [onError]
//   );

//   const {
//     localTracks,
//     getLocalVideoTrack,
//     isAcquiringLocalTracks,
//     removeLocalAudioTrack,
//     removeLocalVideoTrack,
//     getAudioAndVideoTracks,
//   } = useLocalTracks();
//   const { room, isConnecting, connect } = useRoom(localTracks, onErrorCallback, options);

//   // Register callback functions to be called on room disconnect.
//   useHandleRoomDisconnection(room, onError, removeLocalAudioTrack, removeLocalVideoTrack);
//   useHandleTrackPublicationFailed(room, onError);
//   useRestartAudioTrackOnDeviceChange(localTracks);

//   return (
//     <VideoContext.Provider
//       value={{
//         room,
//         localTracks,
//         isConnecting,
//         onError: onErrorCallback,
//         getLocalVideoTrack,
//         connect,
//         isAcquiringLocalTracks,
//         removeLocalVideoTrack,
//         getAudioAndVideoTracks,
//       }}
//     >
//       <SelectedParticipantProvider room={room}>{children}</SelectedParticipantProvider>
//     </VideoContext.Provider>
//   );
// }

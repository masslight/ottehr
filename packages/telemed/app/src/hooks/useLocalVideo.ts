import { RefObject, useEffect } from 'react';
import { LocalTrack, LocalVideoTrack } from 'twilio-video';

export const useLocalVideo = (ref: RefObject<HTMLDivElement>, localTracks: LocalTrack[]): void => {
  useEffect(() => {
    const currentRef = ref.current;

    if (currentRef) {
      const localVideoTrack = localTracks.find((track) => track.kind === 'video') as LocalVideoTrack;

      if (localVideoTrack && localVideoTrack.attach) {
        const videoElement = localVideoTrack.attach();
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        currentRef.appendChild(videoElement);
      }
    }

    return () => {
      if (currentRef) {
        currentRef.querySelectorAll('video').forEach((v) => v.remove());
      }
    };
  }, [localTracks, ref]);
};

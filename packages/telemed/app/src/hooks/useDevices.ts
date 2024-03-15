import { useEffect, useState } from 'react';

// The type of the value that is returned by a promise resolution
type ThenArg<T> = T extends PromiseLike<infer U> ? U : never;

type DeviceInfo = {
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  hasAudioInputDevices: boolean;
  hasVideoInputDevices: boolean;
  videoInputDevices: MediaDeviceInfo[];
};

async function getDeviceInfo(): Promise<DeviceInfo> {
  const devices = await navigator.mediaDevices.enumerateDevices();

  return {
    audioInputDevices: devices.filter((device) => device.kind === 'audioinput'),
    audioOutputDevices: devices.filter((device) => device.kind === 'audiooutput'),
    hasAudioInputDevices: devices.some((device) => device.kind === 'audioinput'),
    hasVideoInputDevices: devices.some((device) => device.kind === 'videoinput'),
    videoInputDevices: devices.filter((device) => device.kind === 'videoinput'),
  };
}

export function useDevices(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<ThenArg<ReturnType<typeof getDeviceInfo>>>({
    audioInputDevices: [],
    audioOutputDevices: [],
    hasAudioInputDevices: false,
    hasVideoInputDevices: false,
    videoInputDevices: [],
  });

  useEffect(() => {
    const getDevices = (): void => {
      getDeviceInfo()
        .then((devices) => setDeviceInfo(devices))
        .catch((error) => {
          console.error('Failed to fetch devices:', error);
        });
    };

    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    getDevices();

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, [setDeviceInfo]);

  return deviceInfo;
}

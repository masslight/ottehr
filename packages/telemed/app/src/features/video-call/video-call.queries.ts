import { useQuery } from 'react-query';
import { useWaitingRoomStore } from '../waiting-room';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetVideoToken = (
  getAccessTokenSilently: () => Promise<string>,
  onSuccess: (data: { token: string }) => void,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  return useQuery(
    ['video-token'],
    async () => {
      const waitingRoom = useWaitingRoomStore.getState();
      const token = await getAccessTokenSilently();

      if (waitingRoom.encounterId && token) {
        // TODO: use env variable
        const videoTokenResp = await fetch(
          `https://project-api.zapehr.com/v1/telemed/token?encounterId=${waitingRoom.encounterId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            method: 'GET',
          },
        );
        return (await videoTokenResp.json()) as { token: string };
      }

      throw new Error('api client not defined or appointmentID not provided');
    },
    {
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get waiting room: ', err);
      },
    },
  );
};

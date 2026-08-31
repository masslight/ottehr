import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { SchoolWorkNoteExcuseDocFileDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

type SchoolWorkNoteExcuseDocFilePresigned = SchoolWorkNoteExcuseDocFileDTO & { presignedUrl?: string };

export const useExcusePresignedFiles = (
  schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[]
): SchoolWorkNoteExcuseDocFilePresigned[] => {
  const { getAccessTokenSilently } = useAuth0();
  const [presignedFiles, setPresignedFiles] = useState<SchoolWorkNoteExcuseDocFilePresigned[]>([]);

  useEffect(() => {
    const fetch = async (): Promise<void> => {
      if (!schoolWorkNotes) {
        return;
      }

      const authToken = await getAccessTokenSilently();
      const urls = [];

      for (const item of schoolWorkNotes) {
        const presignedUrl = await getPresignedURL(item.url!, authToken);
        urls.push({ ...item, presignedUrl });
      }

      setPresignedFiles(urls);
    };

    void fetch();
  }, [schoolWorkNotes, getAccessTokenSilently]);

  return presignedFiles;
};

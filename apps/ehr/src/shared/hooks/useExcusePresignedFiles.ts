import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { SchoolWorkNoteExcuseDocFileDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { mapWithConcurrency } from 'utils/lib/utils/concurrency';

const PRESIGN_CONCURRENCY = 5;

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

      let authToken: string;
      try {
        authToken = await getAccessTokenSilently();
      } catch (error) {
        // Settle with URL-less entries so callers can tell a failed presign from a pending one.
        console.error('Failed to get a token for school/work note presigning', error);
        setPresignedFiles(schoolWorkNotes.map((item) => ({ ...item })));
        return;
      }

      const urls = await mapWithConcurrency(
        schoolWorkNotes,
        PRESIGN_CONCURRENCY,
        async (item): Promise<SchoolWorkNoteExcuseDocFilePresigned> => {
          try {
            return { ...item, presignedUrl: await getPresignedURL(item.url!, authToken) };
          } catch (error) {
            console.error(`Failed to presign school/work note ${item.url}`, error);
            return { ...item };
          }
        }
      );

      setPresignedFiles(urls);
    };

    void fetch();
  }, [schoolWorkNotes, getAccessTokenSilently]);

  return presignedFiles;
};

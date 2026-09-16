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

      let authToken: string;
      try {
        authToken = await getAccessTokenSilently();
      } catch (error) {
        // Settle with URL-less entries rather than never resolving: a caller waiting on a URL can
        // then tell a failed presign from one that has not arrived yet, instead of waiting forever.
        console.error('Failed to get a token for school/work note presigning', error);
        setPresignedFiles(schoolWorkNotes.map((item) => ({ ...item })));
        return;
      }

      const urls: SchoolWorkNoteExcuseDocFilePresigned[] = [];

      for (const item of schoolWorkNotes) {
        try {
          urls.push({ ...item, presignedUrl: await getPresignedURL(item.url!, authToken) });
        } catch (error) {
          // Per item, so one unreachable note does not cost the others their URL too.
          console.error(`Failed to presign school/work note ${item.url}`, error);
          urls.push({ ...item });
        }
      }

      setPresignedFiles(urls);
    };

    void fetch();
  }, [schoolWorkNotes, getAccessTokenSilently]);

  return presignedFiles;
};

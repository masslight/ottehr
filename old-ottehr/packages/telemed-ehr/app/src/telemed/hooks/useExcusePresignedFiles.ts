import { useEffect, useState } from 'react';
import { getPresignedFileUrl } from '../../helpers/files.helper';
import { useAuth0 } from '@auth0/auth0-react';
import { SchoolWorkNoteExcuseDocFileDTO } from 'ehr-utils';

type schoolWorkNoteExcuseDocFilePresigned = SchoolWorkNoteExcuseDocFileDTO & { presignedUrl?: string };

export const useExcusePresignedFiles = (
  schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[],
): schoolWorkNoteExcuseDocFilePresigned[] => {
  const { getAccessTokenSilently } = useAuth0();
  const [presignedFiles, setPresignedFiles] = useState<schoolWorkNoteExcuseDocFilePresigned[]>([]);

  useEffect(() => {
    const fetch = async (): Promise<void> => {
      if (!schoolWorkNotes) {
        return;
      }

      const authToken = await getAccessTokenSilently();
      const urls = [];

      for (const item of schoolWorkNotes) {
        const presignedUrl = await getPresignedFileUrl(item.url!, authToken);
        urls.push({ ...item, presignedUrl });
      }

      setPresignedFiles(urls);
    };

    void fetch();
  }, [schoolWorkNotes, getAccessTokenSilently]);

  return presignedFiles;
};

import { useEffect, useState } from 'react';
import { getPresignedFileUrl } from '../../helpers/files.helper';
import { useAuth0 } from '@auth0/auth0-react';
import { WorkSchoolNoteExcuseDocFileDTO } from 'ehr-utils';

type WorkSchoolNoteExcuseDocFilePresigned = WorkSchoolNoteExcuseDocFileDTO & { presignedUrl?: string };

export const useExcusePresignedFiles = (
  workSchoolNotes?: WorkSchoolNoteExcuseDocFileDTO[]
): WorkSchoolNoteExcuseDocFilePresigned[] => {
  const { getAccessTokenSilently } = useAuth0();
  const [presignedFiles, setPresignedFiles] = useState<WorkSchoolNoteExcuseDocFilePresigned[]>([]);

  useEffect(() => {
    const fetch = async (): Promise<void> => {
      if (!workSchoolNotes) {
        return;
      }

      const authToken = await getAccessTokenSilently();
      const urls = [];

      for (const item of workSchoolNotes) {
        const presignedUrl = await getPresignedFileUrl(item.url!, authToken);
        urls.push({ ...item, presignedUrl });
      }

      setPresignedFiles(urls);
    };

    void fetch();
  }, [workSchoolNotes, getAccessTokenSilently]);

  return presignedFiles;
};

import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { useAppointmentStore } from '../state';
import { getPresignedFileUrl } from '../../helpers/files.helper';
import { getSelectors } from '../../shared/store/getSelectors';
import { SCHOOL_WORK_NOTE } from 'ehr-utils';

export const usePatientProvidedExcusePresignedFiles = (): {
  patientSchoolPresignedUrl: string | undefined;
  patientWorkPresignedUrl: string | undefined;
} => {
  const { getAccessTokenSilently } = useAuth0();
  const [patientSchoolPresignedUrl, setPatientSchoolPresignedUrl] = useState<string | undefined>(undefined);
  const [patientWorkPresignedUrl, setPatientWorkPresignedUrl] = useState<string | undefined>(undefined);

  const { schoolWorkNoteUrls } = getSelectors(useAppointmentStore, ['schoolWorkNoteUrls']);

  useEffect(() => {
    async function getPresignedTemplateUrls(): Promise<void> {
      try {
        const authToken = await getAccessTokenSilently();

        const schoolZ3Url = schoolWorkNoteUrls.find((name) => name.includes(`${SCHOOL_WORK_NOTE}-template-school`));
        if (schoolZ3Url) {
          const schoolPresignedUrl = await getPresignedFileUrl(schoolZ3Url, authToken);
          setPatientSchoolPresignedUrl(schoolPresignedUrl);
        }
        const workZ3Url = schoolWorkNoteUrls.find((name) => name.includes(`${SCHOOL_WORK_NOTE}-template-work`));
        if (workZ3Url) {
          const workPresignedUrl = await getPresignedFileUrl(workZ3Url, authToken);
          setPatientWorkPresignedUrl(workPresignedUrl);
        }
      } catch {
        console.error('Error while trying to get template presigned urls');
      }
    }

    if (schoolWorkNoteUrls?.length > 0) {
      void getPresignedTemplateUrls();
    }
  }, [getAccessTokenSilently, schoolWorkNoteUrls]);

  return { patientSchoolPresignedUrl, patientWorkPresignedUrl };
};

import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { getPresignedURL, SCHOOL_WORK_NOTE } from 'utils';
import { useAppointmentData } from '../state';

export const usePatientProvidedExcusePresignedFiles = (): {
  patientSchoolPresignedUrl: string | undefined;
  patientWorkPresignedUrl: string | undefined;
} => {
  const { getAccessTokenSilently } = useAuth0();
  const [patientSchoolPresignedUrl, setPatientSchoolPresignedUrl] = useState<string | undefined>(undefined);
  const [patientWorkPresignedUrl, setPatientWorkPresignedUrl] = useState<string | undefined>(undefined);
  const { schoolWorkNoteUrls } = useAppointmentData();

  useEffect(() => {
    async function getPresignedTemplateUrls(): Promise<void> {
      try {
        const authToken = await getAccessTokenSilently();
        const schoolZ3Url = schoolWorkNoteUrls.find((name) => name.includes(`${SCHOOL_WORK_NOTE}-template-school`));

        if (schoolZ3Url) {
          const schoolPresignedUrl = await getPresignedURL(schoolZ3Url, authToken);
          setPatientSchoolPresignedUrl(schoolPresignedUrl);
        }

        const workZ3Url = schoolWorkNoteUrls.find((name) => name.includes(`${SCHOOL_WORK_NOTE}-template-work`));

        if (workZ3Url) {
          const workPresignedUrl = await getPresignedURL(workZ3Url, authToken);
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

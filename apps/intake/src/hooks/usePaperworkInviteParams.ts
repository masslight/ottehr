import { QuestionnaireResponseItem } from 'fhir/r4b';
import { useMemo } from 'react';
import { InviteParticipantRequestParameters } from 'utils';

export const usePaperworkInviteParams = (
  completedPaperwork: QuestionnaireResponseItem[]
): Omit<InviteParticipantRequestParameters, 'appointmentId'> | null => {
  return useMemo((): null | Omit<InviteParticipantRequestParameters, 'appointmentId'> => {
    const page = completedPaperwork.find((page) => page.linkId === 'invite-participant-page');

    if (!page) {
      // in-person doesn't need invite participant
      return null;
    }

    const answers: { [key: string]: string | undefined } = {};

    page.item?.forEach((item) => {
      const linkId = item.linkId;
      let value: string | undefined;
      if (item?.answer?.[0]?.valueString) {
        value = item.answer[0].valueString;
      }
      answers[linkId] = value;
    });

    if (answers['invite-from-another-device'] !== 'Yes, I will add invite details below') {
      return null;
    }

    if (answers['invite-phone']) {
      answers['invite-phone'] = answers['invite-phone'].replace(/\D/g, '');
    }

    return {
      firstName: answers['invite-first']!,
      lastName: answers['invite-last']!,
      emailAddress: answers['invite-email']!,
      phoneNumber: answers['invite-phone']!,
    };
  }, [completedPaperwork]);
};

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Patient, Person, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getCoding } from 'utils/lib/fhir/helpers';
import { getFirstName, getLastName, getSMSNumberForIndividual } from 'utils/lib/fhir/patient';
import { AppointmentMessaging, SMSRecipient } from 'utils/lib/types/api/messaging.types';
import { CHAT_MESSAGES_QUERY_KEY, QuickTextsContext, useFetchChatMessagesQuery } from './chat.queries';
import { ChatIconButton } from './ChatIconButton';
import ChatModal from './ChatModal';

const VITE_APP_PATIENT_APP_URL = import.meta.env.VITE_APP_PATIENT_APP_URL;

const isUserRelatedPerson = (rp: RelatedPerson): boolean =>
  getCoding(rp.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code === 'user-relatedperson';

const getPersonPhone = (person: Person): string | undefined =>
  person.telecom?.find((tel) => tel.system === 'phone')?.value;

interface PatientChatButtonProps {
  patient: Patient | undefined;
  latestVisitId?: string;
}

/**
 * Opens the same two-way SMS chat as the tracking board, for a patient rather than a visit.
 * Recipients are built the way the tracking board builds them: every user RelatedPerson of the patient
 * with an SMS number, plus the phone of any Person linked to those RelatedPersons.
 */
export function PatientChatButton({ patient, latestVisitId }: PatientChatButtonProps): ReactElement | null {
  const { oystehr } = useApiClients();
  const patientId = patient?.id;
  const timezone = DateTime.now().zoneName;
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: recipients } = useQuery({
    queryKey: ['patient-chat-recipients', patientId],
    queryFn: async (): Promise<SMSRecipient[]> => {
      const resources = (
        await oystehr!.fhir.search<RelatedPerson | Person>({
          resourceType: 'RelatedPerson',
          params: [
            { name: 'patient', value: `Patient/${patientId}` },
            { name: 'relationship', value: 'user-relatedperson' },
            { name: '_revinclude', value: 'Person:link' },
          ],
        })
      ).unbundle();

      const map = new Map<string, SMSRecipient>();
      const add = (recipientResourceUri: string, smsNumber: string | undefined): void => {
        if (!smsNumber) return;
        const key = `${recipientResourceUri}|${smsNumber}`;
        if (!map.has(key)) map.set(key, { recipientResourceUri, smsNumber });
      };

      const ownRelatedPersonRefs = new Set<string>();
      resources.forEach((resource) => {
        if (resource.resourceType === 'RelatedPerson' && resource.id && isUserRelatedPerson(resource)) {
          ownRelatedPersonRefs.add(`RelatedPerson/${resource.id}`);
          add(`RelatedPerson/${resource.id}`, getSMSNumberForIndividual(resource));
        }
      });
      resources.forEach((resource) => {
        if (resource.resourceType !== 'Person') return;
        const phone = getPersonPhone(resource);
        resource.link?.forEach((link) => {
          const ref = link.target?.reference;
          if (ref && ownRelatedPersonRefs.has(ref)) add(ref, phone);
        });
      });
      return Array.from(map.values());
    },
    enabled: Boolean(oystehr && patientId),
  });

  const numbersToSendTo = useMemo(() => {
    const unique = Array.from(new Set((recipients ?? []).map((r) => r.smsNumber)));
    return unique.length > 0 ? unique : undefined;
  }, [recipients]);

  const { data: messages } = useFetchChatMessagesQuery(timezone, patientId ?? '', numbersToSendTo);
  const hasUnread = (messages ?? []).some((m) => !m.isRead);

  const onClose = useCallback(() => setOpen(false), []);
  const onMarkAllRead = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, patientId] });
  }, [queryClient, patientId]);

  const appointmentMessaging: AppointmentMessaging | undefined = useMemo(() => {
    if (!patient?.id || !recipients?.length) return undefined;
    return {
      id: patient.id,
      encounterId: patient.id,
      smsModel: { recipients, hasUnreadMessages: hasUnread },
      patient: {
        id: patient.id,
        firstName: getFirstName(patient),
        lastName: getLastName(patient),
        dateOfBirth: patient.birthDate ?? '',
      },
    };
  }, [patient, recipients, hasUnread]);

  const quickTextsContext: QuickTextsContext = useMemo(
    () => ({
      patientAppUrl: VITE_APP_PATIENT_APP_URL,
      patientFirstName: patient ? getFirstName(patient) : undefined,
      patientLastName: patient ? getLastName(patient) : undefined,
      visitId: latestVisitId,
    }),
    [patient, latestVisitId]
  );

  // Like the tracking board, show no chat when no number on the account can receive texts.
  if (!appointmentMessaging) return null;

  return (
    <>
      <ChatIconButton hasUnread={hasUnread} onClick={() => setOpen(true)} />
      {open && (
        <ChatModal
          appointment={appointmentMessaging}
          onClose={onClose}
          onMarkAllRead={onMarkAllRead}
          quickTextsContext={quickTextsContext}
        />
      )}
    </>
  );
}

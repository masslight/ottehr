import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { getChatData } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { TRACKING_BOARD_REFRESH_MS } from 'src/hooks/useGetTrackingBoard';
import { getFirstName, getLastName } from 'utils/lib/fhir/patient';
import { AppointmentMessaging } from 'utils/lib/types/api/messaging.types';
import {
  CHAT_MESSAGES_QUERY_KEY,
  PATIENT_CHAT_DATA_QUERY_KEY,
  QuickTextsContext,
  useFetchChatMessagesQuery,
} from './chat.queries';
import { ChatIconButton } from './ChatIconButton';
import ChatModal from './ChatModal';

const VITE_APP_PATIENT_APP_URL = import.meta.env.VITE_APP_PATIENT_APP_URL;

interface PatientChatButtonProps {
  patient: Patient | undefined;
  latestVisitId?: string;
  latestEncounterId?: string;
}

/**
 * Opens the same two-way SMS chat as the tracking board, for a patient rather than a visit.
 * Recipients are built the way the tracking board builds them: every user RelatedPerson of the patient
 * with an SMS number, plus the phone of any Person linked to those RelatedPersons.
 */
export function PatientChatButton({
  patient,
  latestVisitId,
  latestEncounterId,
}: PatientChatButtonProps): ReactElement | null {
  const { oystehrZambda } = useApiClients();
  const patientId = patient?.id;
  const timezone = DateTime.now().zoneName;
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => setOpen(false), [patientId]);

  const {
    data: chatData,
    isFetching: isChatDataFetching,
    isPlaceholderData: isChatDataPlaceholder,
    isError: isChatDataError,
  } = useQuery({
    queryKey: [PATIENT_CHAT_DATA_QUERY_KEY, patientId, latestEncounterId],
    queryFn: () => getChatData(oystehrZambda!, { patientId: patientId!, encounterId: latestEncounterId }),
    enabled: Boolean(oystehrZambda && patientId),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === patientId ? previousData : undefined,
  });
  const recipients = chatData?.recipients;

  const numbersToSendTo = useMemo(() => {
    const unique = Array.from(new Set((recipients ?? []).map((r) => r.smsNumber)));
    return unique.length > 0 ? unique : undefined;
  }, [recipients]);

  const { data: messages } = useFetchChatMessagesQuery(
    timezone,
    patientId ?? '',
    numbersToSendTo,
    undefined,
    TRACKING_BOARD_REFRESH_MS
  );
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

  const quickTextsContext: QuickTextsContext = useMemo(() => {
    const visit = chatData?.visit;
    return {
      patientAppUrl: VITE_APP_PATIENT_APP_URL,
      patientFirstName: patient ? getFirstName(patient) : undefined,
      patientLastName: patient ? getLastName(patient) : undefined,
      visitId: latestVisitId,
      locationName: visit?.locationName,
      locationReviewLink: visit?.locationReviewLink,
      bookingTime: visit?.bookingTime,
      officePhone: visit?.officePhone,
      supportPhone: visit?.supportPhone,
    };
  }, [patient, latestVisitId, chatData]);

  // A paused request (offline) is neither fetching nor errored, so placeholder data is unreliable too.
  const recipientsUnreliable = isChatDataFetching || isChatDataError || isChatDataPlaceholder;

  if (!appointmentMessaging) return null;

  return (
    <>
      <ChatIconButton hasUnread={hasUnread} onClick={() => setOpen(true)} disabled={recipientsUnreliable} />
      {open && (
        <ChatModal
          appointment={appointmentMessaging}
          onClose={onClose}
          onMarkAllRead={onMarkAllRead}
          quickTextsContext={quickTextsContext}
          sendDisabled={recipientsUnreliable}
        />
      )}
    </>
  );
}

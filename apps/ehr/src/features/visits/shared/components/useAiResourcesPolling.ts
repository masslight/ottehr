import Oystehr from '@oystehr/sdk';
import { Appointment, DocumentReference, Encounter, QuestionnaireResponse } from 'fhir/r4b';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AMBIENT_SCRIBE_RECORDING_PENDING_CODING } from 'utils/lib/fhir/constants';
import { AI_QUESTIONNAIRE_ID } from 'utils/lib/types/constants';
import { getInPersonVisitStatus } from 'utils/lib/utils/visitUtils';
import { useAiResourcesPollingStore } from '../stores/aiResourcesPolling.store';

interface UseAiResourcesPollingParams {
  appointment: Appointment | undefined;
  encounter: Encounter | undefined;
  oystehr: Oystehr | undefined;
  chartDataHasResources: boolean;
  hasPendingRecording: boolean;
  onRefetch: () => Promise<void>;
}

interface UseAiResourcesPollingResult {
  isPolling: boolean;
  hasPendingAiSource: boolean;
  pollingExhausted: boolean;
}

const MIN_ANSWERS_REQUIRED = 4;
const MAX_POLLING_ATTEMPTS = 60;
const POLLING_INTERVAL_MS = 5_000; // 5 seconds

export const useAiResourcesPolling = ({
  appointment,
  encounter,
  oystehr,
  chartDataHasResources,
  hasPendingRecording,
  onRefetch,
}: UseAiResourcesPollingParams): UseAiResourcesPollingResult => {
  const [isPolling, setIsPolling] = useState(false);
  const [hasPendingAiSource, setHasPendingAiSource] = useState(false);

  const pollingAttemptsRef = useRef(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const pollingExhaustedRef = useRef(false);
  const initialCheckDoneRef = useRef(false);
  const previousEncounterIdRef = useRef(encounter?.id);

  // Update polling state on encounter change
  useEffect(() => {
    if (previousEncounterIdRef.current === encounter?.id) return;
    previousEncounterIdRef.current = encounter?.id;
    setIsPolling(false);
    setHasPendingAiSource(false);
    pollingAttemptsRef.current = 0;
    pollingExhaustedRef.current = false;
    initialCheckDoneRef.current = false;
  }, [encounter?.id]);

  // Mirror this instance's state into the shared store so components that don't call this hook directly
  // (e.g. OttehrAi, since this hook is only invoked from the persistently-mounted InPersonLayout) can still
  // read live polling status without starting a second, competing poll loop of their own.
  useEffect(() => {
    useAiResourcesPollingStore.setState({
      isPolling,
      hasPendingAiSource,
      pollingExhausted: pollingExhaustedRef.current,
    });
  }, [isPolling, hasPendingAiSource]);

  // Check if there's an AI interview with sufficient answers but no AI resources
  const checkForInterviewWithoutResources = useCallback(async (): Promise<boolean> => {
    if (!oystehr || !encounter?.id) return false;

    try {
      const qrResult = await oystehr.fhir.search<QuestionnaireResponse>({
        resourceType: 'QuestionnaireResponse',
        params: [
          { name: 'encounter', value: `Encounter/${encounter.id}` },
          { name: 'questionnaire', value: `#${AI_QUESTIONNAIRE_ID}` },
        ],
      });

      const aiInterviewQR = qrResult.unbundle()[0];

      if (!aiInterviewQR) return false;

      const patientAnswers = (aiInterviewQR.item || []).filter((item) => {
        const linkIdNum = parseInt(item.linkId);
        return !isNaN(linkIdNum) && linkIdNum > 0 && linkIdNum % 2 === 1;
      });

      const hasEnoughAnswers = patientAnswers.length > MIN_ANSWERS_REQUIRED;
      return hasEnoughAnswers && !chartDataHasResources;
    } catch (error) {
      console.error('Error checking for interview without resources:', error);
      return false;
    }
  }, [oystehr, encounter?.id, chartDataHasResources]);

  // Check if an in-person recording was uploaded and is awaiting transcription
  const checkForPendingAudioRecording = useCallback(async (): Promise<boolean> => {
    if (!oystehr || !encounter?.id) return false;

    try {
      const drResult = await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'encounter', value: `Encounter/${encounter.id}` },
          {
            name: 'type',
            value: `${AMBIENT_SCRIBE_RECORDING_PENDING_CODING.system}|${AMBIENT_SCRIBE_RECORDING_PENDING_CODING.code}`,
          },
        ],
      });

      return drResult.unbundle().length > 0;
    } catch (error) {
      console.error('Error checking for pending audio recording:', error);
      return false;
    }
  }, [oystehr, encounter?.id]);

  const checkForPendingAiSource = useCallback(async (): Promise<boolean> => {
    const [interviewPending, audioRecordingPending] = await Promise.all([
      checkForInterviewWithoutResources(),
      checkForPendingAudioRecording(),
    ]);
    return interviewPending || audioRecordingPending;
  }, [checkForInterviewWithoutResources, checkForPendingAudioRecording]);

  // Start polling when conditions are met
  useEffect(() => {
    const shouldPoll = async (): Promise<void> => {
      if (!appointment || !encounter) return;

      const visitStatus = getInPersonVisitStatus(appointment, encounter);
      const isRelevantStatus =
        visitStatus === 'pending' ||
        visitStatus === 'arrived' ||
        visitStatus === 'intake' ||
        visitStatus === 'ready' ||
        visitStatus === 'ready for provider' ||
        visitStatus === 'provider';
      if (!hasPendingRecording && !isRelevantStatus) {
        setHasPendingAiSource(false);
        setIsPolling(false);
        pollingAttemptsRef.current = 0;
        pollingExhaustedRef.current = false;
        initialCheckDoneRef.current = false;
        return;
      }

      // Only check and start polling if we haven't done initial check yet, if we know resources are
      // missing, or there is a pending recording
      if (!initialCheckDoneRef.current || !chartDataHasResources || hasPendingRecording) {
        const needsPolling = await checkForPendingAiSource();
        setHasPendingAiSource(needsPolling);
        initialCheckDoneRef.current = true;

        if (needsPolling && !isPolling && pollingAttemptsRef.current < MAX_POLLING_ATTEMPTS) {
          setIsPolling(true);
          pollingExhaustedRef.current = false;
        } else if (!needsPolling && isPolling) {
          // Stop polling if resources appeared
          setIsPolling(false);
          pollingAttemptsRef.current = 0;
          pollingExhaustedRef.current = false;
        }
      }
    };

    void shouldPoll();
  }, [appointment, encounter, chartDataHasResources, hasPendingRecording, isPolling, checkForPendingAiSource]);

  // Handle polling interval
  useEffect(() => {
    if (!isPolling || pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = undefined;
      }

      if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
        pollingExhaustedRef.current = true;
      }

      return;
    }

    pollingIntervalRef.current = setInterval(async () => {
      pollingAttemptsRef.current += 1;
      await onRefetch();

      // Check if resources appeared
      const stillNeedsPolling = await checkForPendingAiSource();

      if (!stillNeedsPolling) {
        setIsPolling(false);
        setHasPendingAiSource(false);
        pollingAttemptsRef.current = 0;
        pollingExhaustedRef.current = false;
      } else if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
        setIsPolling(false);
        pollingExhaustedRef.current = true;
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isPolling, onRefetch, checkForPendingAiSource]);

  return {
    isPolling,
    hasPendingAiSource,
    pollingExhausted: pollingExhaustedRef.current,
  };
};

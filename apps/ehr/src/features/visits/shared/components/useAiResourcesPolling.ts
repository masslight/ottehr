import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, QuestionnaireResponse } from 'fhir/r4b';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AI_QUESTIONNAIRE_ID, getInPersonVisitStatus } from 'utils';

interface UseAiResourcesPollingParams {
  appointment: Appointment | undefined;
  encounter: Encounter | undefined;
  oystehr: Oystehr | undefined;
  chartDataHasResources: boolean;
  onRefetch: () => Promise<void>;
}

interface UseAiResourcesPollingResult {
  isPolling: boolean;
  hasInterviewWithoutResources: boolean;
  pollingExhausted: boolean;
}

const MIN_ANSWERS_REQUIRED = 4;
const MAX_POLLING_ATTEMPTS = 10;
const POLLING_INTERVAL_MS = 10_000; // 10 seconds

export const useAiResourcesPolling = ({
  appointment,
  encounter,
  oystehr,
  chartDataHasResources,
  onRefetch,
}: UseAiResourcesPollingParams): UseAiResourcesPollingResult => {
  const [isPolling, setIsPolling] = useState(false);
  const [hasInterviewWithoutResources, setHasInterviewWithoutResources] = useState(false);

  const pollingAttemptsRef = useRef(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const pollingExhaustedRef = useRef(false);

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

  // Start polling when conditions are met
  useEffect(() => {
    const shouldPoll = async (): Promise<void> => {
      if (!appointment || !encounter) return;

      const visitStatus = getInPersonVisitStatus(appointment, encounter);
      const isRelevantStatus = visitStatus === 'ready for provider' || visitStatus === 'provider';

      if (!isRelevantStatus) {
        setHasInterviewWithoutResources(false);
        setIsPolling(false);
        pollingAttemptsRef.current = 0;
        pollingExhaustedRef.current = false;
        return;
      }

      const needsPolling = await checkForInterviewWithoutResources();
      setHasInterviewWithoutResources(needsPolling);

      if (needsPolling && !isPolling && pollingAttemptsRef.current < MAX_POLLING_ATTEMPTS) {
        setIsPolling(true);
        pollingExhaustedRef.current = false;
      }
    };

    void shouldPoll();
  }, [appointment, encounter, chartDataHasResources, isPolling, checkForInterviewWithoutResources]);

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
      const stillNeedsPolling = await checkForInterviewWithoutResources();

      if (!stillNeedsPolling) {
        setIsPolling(false);
        setHasInterviewWithoutResources(false);
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
  }, [isPolling, onRefetch, checkForInterviewWithoutResources]);

  return {
    isPolling,
    hasInterviewWithoutResources,
    pollingExhausted: pollingExhaustedRef.current,
  };
};

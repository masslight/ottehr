import React, { useState } from 'react';
import { LoadingButton } from '@mui/lab';
import { FormHelperText, Stack } from '@mui/material';
import { AOECard } from './AOECard';
import { SampleCollectionInstructionsCard } from './SampleCollectionInstructionsCard';
import { SampleInformationCard, CollectionDateTime, OptionalCollectionDateTimeChanges } from './SampleInformationCard';
// import { OrderHistoryCard } from './OrderHistoryCard';
import { DateTime } from 'luxon';
import { MockServiceRequest } from '../pages/OrderDetails';
// import { useAppointmentStore } from '../../../telemed';
// import { getSelectors } from '../../../shared/store/getSelectors';
// import { DiagnosisDTO } from 'utils';
// import { useApiClients } from '../../../hooks/useAppClients';
// import { FhirClient } from '@zapehr/sdk';

interface CollectionInstructions {
  container: string;
  volume: string;
  minimumVolume: string;
  storageRequirements: string;
  collectionInstructions: string;
}

interface SampleCollectionProps {
  aoe: Question[];
  collectionInstructions: CollectionInstructions;
  specimen: any;
  serviceRequest: MockServiceRequest;
  onCollectionSubmit: () => void;
}

interface Question {
  questionCode: string;
  originalQuestionCode: string;
  question: string;
  answers?: string[];
  verboseAnswers?: string[];
  questionType: 'List' | 'Free Text' | 'Formatted Input' | 'Multi-Select List';
  answerRequired: boolean;
}

export type UserProvidedAnswerType = string | string[] | DateTime | undefined;

export interface UserProvidedAnswer {
  answer: UserProvidedAnswerType;
  isValid: boolean;
}

export interface AOEQuestionWithAnswer extends Question {
  idx: number;
  userProvidedAnswer: UserProvidedAnswer;
}

export const SampleCollection: React.FC<SampleCollectionProps> = ({
  aoe,
  collectionInstructions,
  specimen: _2,
  serviceRequest,
  onCollectionSubmit,
}) => {
  // ATHENA TODO: unclear how the service request will be passed here, and whether or not
  // the orderable item info will be included on it or if it will need to be queried via oystehr api based on a lab + code.

  // need to iterate through the passed aoe and format it into state so we can collect the answer
  // TODO: might want to do this in a useMemo for perf
  const [aoeWithAnswer, setAOEWithAnswer] = useState<AOEQuestionWithAnswer[]>(
    aoe.map((question, idx) => ({
      ...question,
      idx,
      userProvidedAnswer: {
        answer: undefined,
        isValid: question.answerRequired ? false : true,
      },
    }))
  );
  const [sampleCollectionDateTime, setSampleCollectionDateTime] = useState<CollectionDateTime>({
    value: DateTime.now(),
    isValidDate: true,
    isValidTime: true,
  });
  const [showInPatientPortal, setShowInPatientPortal] = useState(true);

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const setAOEAnswerAtIndex = React.useCallback(
    (answer: UserProvidedAnswerType, isValid: boolean, index: number) => {
      setAOEWithAnswer((aoe) => {
        if (index === aoe.length - 1) {
          return [
            ...aoe.slice(0, index),
            {
              ...aoe[index],
              userProvidedAnswer: {
                answer,
                isValid,
              },
            },
          ];
        } else {
          return [
            ...aoe.slice(0, index),
            {
              ...aoe[index],
              userProvidedAnswer: {
                answer,
                isValid,
              },
            },
            ...aoe.slice(index + 1),
          ];
        }
      });
    },
    [setAOEWithAnswer]
  );

  const handleCollectionDateTimeChange = React.useCallback(
    ({ value, isValidDate, isValidTime }: OptionalCollectionDateTimeChanges) => {
      setSampleCollectionDateTime((prev) => {
        return {
          value: value ?? prev.value,
          isValidDate: isValidDate ?? prev.isValidDate,
          isValidTime: isValidTime ?? prev.isValidTime,
        };
      });
    },
    [setSampleCollectionDateTime]
  );

  const handleShowInPatientPortalChange = React.useCallback(
    (value: boolean) => {
      setShowInPatientPortal(value);
    },
    [setShowInPatientPortal]
  );

  const handleSubmit = React.useCallback(() => {
    // also needs to make sure any validation-related state is set to show errors on the forms
    setSubmitAttempted(true);
    setSubmitLoading(true);

    const aoeResponseIsValid = aoeWithAnswer.every((question) => {
      return question.userProvidedAnswer.isValid;
    });

    if (!aoeResponseIsValid) {
      setSubmitFailed(true);
      setSubmitLoading(false);
      console.log('>>>Tried to submit faulty aoeWithAnswer', aoeWithAnswer);
      return;
    }

    if (!(sampleCollectionDateTime.isValidDate && sampleCollectionDateTime.isValidTime)) {
      setSubmitFailed(true);
      setSubmitLoading(false);
      console.log('>>>Tried to submit faulty sampleCollectionDateTime', sampleCollectionDateTime);
      return;
    }

    // for the moment just grab the responses and log them
    setSubmitFailed(false);
    onCollectionSubmit();
    console.log('>>>In Submit. Submitting aoeWithAnswer', aoeWithAnswer);
    console.log('>>>In Submit. Submitting sampleCollectionDateTime', sampleCollectionDateTime);
    console.log('>>>In Submit. Submitting showInPatientPortal', showInPatientPortal);
  }, [aoeWithAnswer, sampleCollectionDateTime, showInPatientPortal, onCollectionSubmit]);

  return (
    <>
      <AOECard questions={aoeWithAnswer} onAnswer={setAOEAnswerAtIndex} submitAttempted={submitAttempted} />
      <SampleCollectionInstructionsCard instructions={collectionInstructions} />
      <SampleInformationCard
        orderAddedDateTime={serviceRequest?.orderDateTime || DateTime.now()}
        orderingPhysician={serviceRequest?.orderingPhysician || ''}
        individualCollectingSample={'The best nurse'}
        collectionDateTime={sampleCollectionDateTime}
        showInPatientPortal={showInPatientPortal}
        onDateTimeChange={handleCollectionDateTimeChange}
        onShowInPatientPortalChange={handleShowInPatientPortalChange}
      />
      {/* <OrderHistoryCard /> */}
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <LoadingButton variant="outlined" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}>
          Back
        </LoadingButton>
        <Stack>
          <LoadingButton
            loading={submitLoading}
            variant="contained"
            sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
            onClick={handleSubmit}
          >
            Submit & Print
          </LoadingButton>
          {submitFailed && <FormHelperText error>Please address errors</FormHelperText>}
        </Stack>
      </Stack>
    </>
  );
};

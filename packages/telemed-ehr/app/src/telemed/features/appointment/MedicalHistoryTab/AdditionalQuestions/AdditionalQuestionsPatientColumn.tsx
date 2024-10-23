import React, { FC } from 'react';
import { Box, Divider, Skeleton, Typography } from '@mui/material';
import { FhirResource, Questionnaire, QuestionnaireItem, QuestionnaireResponse } from 'fhir/r4';
import { QuestionnaireLinkIds } from 'ehr-utils';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore, useGetQuestionnaireDetails } from '../../../../state';

const omitKnownQuestions = Object.values(QuestionnaireLinkIds) as string[];

export const AdditionalQuestionsPatientColumn: FC = () => {
  const { questionnaire, questionnaireResponse, isAppointmentLoading } = getSelectors(useAppointmentStore, [
    'questionnaire',
    'questionnaireResponse',
    'isAppointmentLoading',
  ]);

  const { isFetching: isFetchingQuestionnaire } = useGetQuestionnaireDetails(
    {
      questionnaireName: questionnaireResponse?.questionnaire,
    },
    (data) => {
      const questionnaire = data?.find(
        (resource: FhirResource) => resource.resourceType === 'Questionnaire',
      ) as unknown as Questionnaire;
      useAppointmentStore.setState({
        questionnaire: questionnaire,
      });
    },
  );

  const getQuestionBlock = (
    questionStructure: QuestionnaireItem,
    questionnaireResponse: QuestionnaireResponse | undefined,
  ): JSX.Element | null => {
    if (questionStructure.type == 'group') {
      const answerBlocks = questionStructure.item?.map((question) => getQuestionBlock(question, questionnaireResponse));
      return answerBlocks && answerBlocks.length > 0 ? (
        <Box key={questionStructure.linkId} sx={{ paddingBottom: 2 }}>
          <Typography variant="body1" sx={{ opacity: 0.6 }}>
            {questionStructure.text}
          </Typography>
          {questionStructure.item?.map((question) => getQuestionBlock(question, questionnaireResponse))}
        </Box>
      ) : null;
    }
    const answer = questionnaireResponse?.item?.find((q) => q.linkId === questionStructure.linkId)?.answer?.[0]
      ?.valueString;
    return answer ? (
      <Box key={questionStructure.linkId} sx={{ paddingTop: 2 }}>
        <Typography variant="overline" sx={{ opacity: 0.6 }}>
          {questionStructure.text}
        </Typography>
        <Typography>{answer}</Typography>
      </Box>
    ) : null;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {isFetchingQuestionnaire || isAppointmentLoading ? (
        <Skeleton />
      ) : (
        questionnaire?.item
          ?.filter((question) => !omitKnownQuestions.includes(question.linkId))
          .map((question, index, array) => (
            <>
              {getQuestionBlock(question, questionnaireResponse)}
              {index < array.length - 1 && <Divider />}
            </>
          ))
      )}
    </Box>
  );
};

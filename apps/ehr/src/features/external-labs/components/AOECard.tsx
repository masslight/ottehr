import { CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { QuestionnaireItem } from 'fhir/r4b';
import React, { useState } from 'react';
import { LabQuestionnaireResponse } from 'utils';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import { AOEQuestion } from './AOEQuestion';

interface AOEProps {
  questions: QuestionnaireItem[];
  labQuestionnaireResponses: LabQuestionnaireResponse[] | undefined;
  isReadOnly?: boolean;
  isCollapsed?: boolean;
}

export const AOECard: React.FC<AOEProps> = ({
  questions,
  labQuestionnaireResponses,
  isReadOnly,
  isCollapsed = false,
}) => {
  const [collapsed, setCollapsed] = useState(isCollapsed);
  const [isLoading, _setLoading] = useState(false);

  return (
    <>
      <AccordionCard
        label={!labQuestionnaireResponses ? 'AOE Questions' : 'AOE Answers'}
        collapsed={collapsed}
        withBorder={false}
        onSwitch={() => {
          setCollapsed((prevState) => !prevState);
        }}
      >
        {isLoading ? (
          <CircularProgress />
        ) : (
          <Paper sx={{ p: 3 }}>
            <Grid container sx={{ width: '100%' }} spacing={1}>
              {questions?.length ? (
                questions.map((question, index) => {
                  return (
                    <AOEQuestion
                      key={index}
                      question={question}
                      isReadOnly={isReadOnly}
                      answer={
                        labQuestionnaireResponses?.find((response) => response.linkId === question.linkId)?.response
                      }
                    />
                  );
                })
              ) : (
                <Typography>No questions</Typography>
              )}
            </Grid>
          </Paper>
        )}
      </AccordionCard>
    </>
  );
};

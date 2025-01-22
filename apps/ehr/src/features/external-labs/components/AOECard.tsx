import { Paper, Grid, CircularProgress, Typography } from '@mui/material';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import React, { useState } from 'react';
import { AOEQuestion } from './AOEQuestion';
import { AOEQuestionWithAnswer, UserProvidedAnswerType } from './SampleCollection';

interface AOEProps {
  questions: AOEQuestionWithAnswer[];
  onAnswer: (answer: UserProvidedAnswerType, isValid: boolean, index: number) => void;
  submitAttempted: boolean;
}

export const AOECard: React.FC<AOEProps> = ({ questions, onAnswer, submitAttempted }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isLoading, _setLoading] = useState(false);

  return (
    <>
      <AccordionCard
        label={'AOE Questions'}
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
                  // not using a React callBack here lets me generate this function per question
                  return (
                    <AOEQuestion
                      key={index}
                      onChange={(answer: UserProvidedAnswerType, isValid: boolean) => {
                        onAnswer(answer, isValid, index);
                      }}
                      question={question}
                      submitAttempted={submitAttempted}
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

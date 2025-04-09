import { Paper, Grid, CircularProgress, Typography } from '@mui/material';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import React, { useState } from 'react';
import { AOEQuestion } from './AOEQuestion';
import { QuestionnaireItem } from 'fhir/r4b';

interface AOEProps {
  questions: QuestionnaireItem[];
  isCollapsed?: boolean;
}

export const AOECard: React.FC<AOEProps> = ({ questions, isCollapsed = false }) => {
  const [collapsed, setCollapsed] = useState(isCollapsed);
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
                  return <AOEQuestion key={index} question={question} />;
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

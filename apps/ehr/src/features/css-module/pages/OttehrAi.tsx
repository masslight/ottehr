import { ottehrAiIcon } from '@ehrTheme/icons';
import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { AccordionCard, useAppointmentData, useChartData } from 'src/telemed';
import { AiObservationField, ObservationTextFieldDTO } from 'utils';
import { AiChatHistory } from '../../../components/AiChatHistory';
import AiSuggestion from '../../../components/AiSuggestion';
import { CSSLoader } from '../components/CSSLoader';
const AI_OBSERVATION_FIELDS = [
  [AiObservationField.HistoryOfPresentIllness, 'History of Present Illness (HPI)'],
  [AiObservationField.PastMedicalHistory, 'Past Medical History (PMH)'],
  [AiObservationField.PastSurgicalHistory, 'Past Surgical History (PSH)'],
  [AiObservationField.MedicationsHistory, 'Medications'],
  [AiObservationField.Allergies, 'Allergies'],
  [AiObservationField.SocialHistory, 'Social history'],
  [AiObservationField.FamilyHistory, 'Family history'],
  [AiObservationField.HospitalizationsHistory, 'Hospitalization'],
];

interface OttehrAiProps {
  appointmentId?: string;
}

export const OttehrAi: React.FC<OttehrAiProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError, chartData } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  const aiPotentialDiagnoses = chartData?.aiPotentialDiagnosis ?? [];

  return (
    <Stack spacing={1}>
      <AccordionCard>
        <Box style={{ padding: '16px', height: '350px', overflowY: 'auto' }}>
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingBottom: '8px',
            }}
          >
            <img src={ottehrAiIcon} style={{ width: '30px', marginRight: '8px' }} />
            <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
              CHAT WITH OYSTEHR AI
            </Typography>
          </Box>
          <AiChatHistory questionnaireResponse={chartData?.aiChat} />
        </Box>
      </AccordionCard>
      <AccordionCard>
        <Stack style={{ padding: '16px' }} spacing={1}>
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <img src={ottehrAiIcon} style={{ width: '30px', marginRight: '8px' }} />
            <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
              OYSTEHR AI SUGGESTIONS
            </Typography>
          </Box>
          {AI_OBSERVATION_FIELDS.map(([filed, title]) => {
            const dto = chartData?.observations?.find(
              (observation) => observation.field === filed
            ) as ObservationTextFieldDTO;
            if (dto == null) {
              return undefined;
            }
            return <AiSuggestion key={filed} title={title} content={dto.value} hideHeader={true} />;
          })}
          {aiPotentialDiagnoses.length > 0 ? (
            <Box
              style={{
                background: '#FFF9EF',
                borderRadius: '8px',
                padding: '8px',
              }}
            >
              <Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
                Potential Diagnoses with ICD-10 Codes
              </Typography>
              <ul>
                {aiPotentialDiagnoses.map((diagnosis) => {
                  return (
                    <li key={diagnosis.code}>
                      <Typography variant="body1">{diagnosis.code + ': ' + diagnosis.display}</Typography>
                    </li>
                  );
                })}
              </ul>
            </Box>
          ) : undefined}
        </Stack>
      </AccordionCard>
    </Stack>
  );
};

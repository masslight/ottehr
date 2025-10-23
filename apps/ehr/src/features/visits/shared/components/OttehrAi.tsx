import { ottehrAiIcon } from '@ehrTheme/icons';
import { Box, Container, Stack, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { DocumentReference, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { AiObservationField, ObservationTextFieldDTO, PUBLIC_EXTENSION_BASE_URL } from 'utils';
import AiSuggestion from '../../in-person/components/AiSuggestion';
import { PlayRecord } from '../../in-person/components/progress-note/PlayRecord';
import { useAppointmentData, useChartData } from '../stores/appointment/appointment.store';
import { Loader } from './Loader';

const AI_OBSERVATION_FIELDS = {
  [AiObservationField.HistoryOfPresentIllness]: 'History of Present Illness (HPI)',
  [AiObservationField.PastMedicalHistory]: 'Past Medical History (PMH)',
  [AiObservationField.PastSurgicalHistory]: 'Past Surgical History (PSH)',
  [AiObservationField.MedicationsHistory]: 'Medications',
  [AiObservationField.Allergies]: 'Allergies',
  [AiObservationField.SocialHistory]: 'Social history',
  [AiObservationField.FamilyHistory]: 'Family history',
  [AiObservationField.HospitalizationsHistory]: 'Hospitalization',
  [AiObservationField.Labs]: 'Labs',
  [AiObservationField.eRX]: 'eRX',
  [AiObservationField.Procedures]: 'Procedures',
};

interface OttehrAiProps {
  appointmentId?: string;
}
const DATE_TIME_FORMAT = 'MM/dd/yyyy hh:mm a';

export function getDocumentReferenceSource(documentReference: DocumentReference): 'audio' | 'chat' | undefined {
  if (documentReference.description === 'Summary of visit from audio recording') {
    return 'audio';
  } else if (documentReference.description === 'Summary of visit from chat') {
    return 'chat';
  }
  return undefined;
}

export function getSource(
  documentReference: DocumentReference,
  oystehr: Oystehr | undefined,
  providers: Practitioner[] | undefined
): string {
  let source = undefined;
  const date = DateTime.fromISO(documentReference?.date || '');
  const documentReferenceSource = getDocumentReferenceSource(documentReference);
  if (documentReferenceSource === 'audio') {
    const providerID = documentReference?.extension
      ?.find((extension) => extension.url === `${PUBLIC_EXTENSION_BASE_URL}/provider`)
      ?.valueReference?.reference?.split('/')?.[1];
    const provider = providers?.find((providerTemp) => providerID === providerTemp.id);
    source = provider?.name?.[0] ? oystehr?.fhir.formatHumanName(provider.name?.[0]) : 'Unknown';
  } else if (documentReferenceSource === 'chat') {
    source = 'AI Chat';
  }
  return getSourceFormat(source, date);
}

export function getSourceFormat(providerName: string | undefined, date: DateTime | undefined): string {
  return `${providerName || 'Unknown'} ${date?.toFormat(DATE_TIME_FORMAT)}`;
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

  if (isLoading || isChartDataLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  const aiPotentialDiagnoses = chartData?.aiPotentialDiagnosis ?? [];

  const observations: { [key: string]: ObservationTextFieldDTO[] } = {};
  chartData?.observations?.forEach((observation) => {
    observation = observation as ObservationTextFieldDTO;
    if (!observation.derivedFrom) {
      return;
    }
    const resourceID = observation.derivedFrom.split('/')?.[1];
    if (!(resourceID in observations)) {
      observations[resourceID] = [];
    }
    observations[resourceID].push(observation);
  });

  return (
    <Stack spacing={1}>
      <>
        <AccordionCard>
          <Box style={{ padding: '16px', height: '350px', overflowY: 'auto' }}>
            {chartData?.aiChat?.documents.map((aiChat) => {
              return <PlayRecord documentReference={aiChat} providers={chartData?.aiChat?.providers} />;
            })}
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
            {Object.entries(AI_OBSERVATION_FIELDS).map(([observationField, title]) => {
              const observationsForField = chartData?.observations?.filter(
                (observation) => observation.field === observationField
              );
              return (
                <Container
                  style={{
                    background: '#E1F5FECC',
                    borderRadius: '8px',
                    padding: '4px 8px 4px 8px',
                    marginBottom: '5px',
                  }}
                >
                  <Typography variant="body1" style={{ fontWeight: 700 }}>
                    {title}
                  </Typography>
                  {observationsForField?.map((observation) => (
                    <AiSuggestion
                      key={observation.resourceId}
                      title={title || 'Unknown'}
                      // source={documentReference ? getSource(documentReference) : 'unknown'}
                      chartData={chartData}
                      content={[observation as ObservationTextFieldDTO]}
                      hideHeader={true}
                    />
                  ))}
                </Container>
              );
            })}
            {aiPotentialDiagnoses.length > 0 ? (
              <Box
                style={{
                  background: '#E1F5FECC',
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
      </>
    </Stack>
  );
};

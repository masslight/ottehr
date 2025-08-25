import { ottehrAiIcon } from '@ehrTheme/icons';
import { Box, Stack, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { DocumentReference, Practitioner, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React from 'react';
import { useParams } from 'react-router-dom';
import { getContentOfDocumentReference } from 'src/helpers/documentReferences';
import { useApiClients } from 'src/hooks/useAppClients';
import { AiObservationField, ObservationTextFieldDTO, PUBLIC_EXTENSION_BASE_URL } from 'utils';
import { AiChatHistory } from '../../../components/AiChatHistory';
import AiSuggestion from '../../../components/AiSuggestion';
import { getSelectors } from '../../../shared/store/getSelectors';
import { AccordionCard, useAppointmentStore } from '../../../telemed';
import { CSSLoader } from '../components/CSSLoader';
import { useAppointment } from '../hooks/useAppointment';

const AI_OBSERVATION_FIELDS = [
  [AiObservationField.HistoryOfPresentIllness, 'History of Present Illness (HPI)'],
  [AiObservationField.PastMedicalHistory, 'Past Medical History (PMH)'],
  [AiObservationField.PastSurgicalHistory, 'Past Surgical History (PSH)'],
  [AiObservationField.MedicationsHistory, 'Medications'],
  [AiObservationField.Allergies, 'Allergies'],
  [AiObservationField.SocialHistory, 'Social history'],
  [AiObservationField.FamilyHistory, 'Family history'],
  [AiObservationField.HospitalizationsHistory, 'Hospitalization'],
  [AiObservationField.Labs, 'Labs'],
  [AiObservationField.eRX, 'eRX'],
  [AiObservationField.Procedures, 'Procedures'],
];

interface OttehrAiProps {
  appointmentId?: string;
}
const DATE_TIME_FORMAT = 'MM/dd/yyyy hh:mm a';

export function getSource(
  source: DocumentReference | QuestionnaireResponse,
  oystehr: Oystehr | undefined,
  providers: Practitioner[] | undefined
): string {
  let providerName = undefined;
  let date = undefined;
  if (source?.resourceType === 'DocumentReference') {
    const providerID = source.extension
      ?.find((extension) => extension.url === `${PUBLIC_EXTENSION_BASE_URL}/provider`)
      ?.valueReference?.reference?.split('/')?.[1];
    const provider = providers?.find((providerTemp) => providerID === providerTemp.id);
    providerName = provider?.name?.[0] ? oystehr?.fhir.formatHumanName(provider.name?.[0]) : 'Unknown';
    date = DateTime.fromISO(source?.date || '').toFormat(DATE_TIME_FORMAT);
  }
  return source?.resourceType === 'DocumentReference'
    ? `Audio recording of visit by ${providerName || 'Unknown'} on ${date}`
    : `AI Chat`;
}

export const OttehrAi: React.FC<OttehrAiProps> = () => {
  const { id: appointmentId } = useParams();
  const { oystehr } = useApiClients();
  const {
    resources: { appointment },
    isLoading,
    error,
  } = useAppointment(appointmentId);

  const { chartData, isChartDataLoading } = getSelectors(useAppointmentStore, ['chartData', 'isChartDataLoading']);

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  const aiPotentialDiagnoses = chartData?.aiPotentialDiagnosis ?? [];

  const observations: { [key: string]: ObservationTextFieldDTO[] } = {};
  const providers = chartData?.aiChat?.providers;
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
              return (
                <>
                  <Box
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      paddingBottom: '8px',
                    }}
                  >
                    <img src={ottehrAiIcon} style={{ width: '30px', marginRight: '8px' }} />
                    <Typography variant="body1" style={{ fontWeight: 700, fontSize: '14px' }}>
                      {aiChat?.resourceType === 'DocumentReference'
                        ? 'TRANSCRIPT AND SUMMARY OF VISIT BY OYSTEHR AI'
                        : 'CHAT WITH OYSTEHR AI'}
                    </Typography>
                    <Typography variant="body2" style={{ fontWeight: 700, fontSize: '14px', marginLeft: '8px' }}>
                      Source: {getSource(aiChat, oystehr, providers)}
                    </Typography>
                  </Box>
                  <Box sx={{ marginLeft: '50px' }}>
                    <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
                      TRANSCRIPT
                    </Typography>
                    {aiChat?.resourceType === 'DocumentReference' ? (
                      <AiChatHistory documentReference={aiChat} />
                    ) : (
                      <AiChatHistory questionnaireResponse={aiChat} />
                    )}

                    {aiChat?.resourceType === 'DocumentReference' && (
                      <>
                        <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
                          SUMMARY
                        </Typography>
                        <Typography variant="body1">
                          {getContentOfDocumentReference(aiChat, 'Summary') || 'No summary available'}
                        </Typography>
                      </>
                    )}
                    {/* <AiChatHistory questionnaireResponse={aiChat} /> */}
                  </Box>
                </>
              );
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
            {Object.entries(observations)?.map(([observationDocumentRefence, observationItems]) => {
              // let date = undefined;
              // if (aiChat?.resourceType === 'DocumentReference') {
              //   date = DateTime.fromISO(aiChat?.date ?? '').toFormat('MM/dd/yyyy hh:mm a');
              // }
              // observation = observation as ObservationTextFieldDTO;

              // if (observation == null) {
              //   return undefined;
              // }
              const documentReference = chartData?.aiChat?.documents.find(
                (resource) => resource.id === observationDocumentRefence
              );

              if (!documentReference) {
                return;
              }

              return (
                <>
                  <Typography variant="body1">Source: {getSource(documentReference, oystehr, providers)}</Typography>
                  <Box sx={{ paddingLeft: '15px' }}>
                    {observationItems.map((observationItem) => {
                      const title = AI_OBSERVATION_FIELDS.find(([field]) => field === observationItem.field)?.[1];

                      return (
                        <AiSuggestion
                          key={observationItem.resourceId}
                          title={title || 'Unknown'}
                          // source={documentReference ? getSource(documentReference) : 'unknown'}
                          chartData={chartData}
                          content={[observationItem]}
                          hideHeader={true}
                        />
                      );
                    })}
                  </Box>
                </>
              );
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
      </>
    </Stack>
  );
};

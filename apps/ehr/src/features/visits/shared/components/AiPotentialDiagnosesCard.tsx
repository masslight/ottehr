import { otherColors } from '@ehrTheme/colors';
import { aiIcon } from '@ehrTheme/icons';
import { InfoOutlined } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Grid, IconButton, Link, Tooltip, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import React from 'react';
import { usePatientLabOrders } from 'src/features/external-labs/components/labs-orders/usePatientLabOrders';
import { useInHouseLabOrders } from 'src/features/in-house-labs/components/orders/useInHouseLabOrders';
import { usePatientRadiologyOrders } from 'src/features/radiology/components/usePatientRadiologyOrders';
import {
  CPTCodeDTO,
  DiagnosisDTO,
  PATIENT_INFO_META_DATA_RETURNING_PATIENT_CODE,
  PATIENT_INFO_META_DATA_SYSTEM,
} from 'utils';
import { useChartFields } from '../hooks/useChartFields';
import { useRecommendBillingSuggestions } from '../stores/appointment/appointment.queries';
import { useAppointmentData, useChartData } from '../stores/appointment/appointment.store';
import { useAddCptCode } from './assessment-tab/BillingCodesContainer';
import { useAddDiagnosis } from './assessment-tab/DiagnosesContainer';

export const AiPotentialDiagnosesCard: FC = () => {
  const theme = useTheme();
  const [visible, setVisible] = useState<boolean>(true);
  const { chartData, isLoading: chartDataLoading } = useChartData();
  const { appointment, encounter } = useAppointmentData();
  const encounterId = encounter.id;

  const { data: chartDataFields, isLoading: chartDataFieldsLoading } = useChartFields({
    requestedFields: {
      chiefComplaint: {
        _tag: 'chief-complaint',
      },
      medicalDecision: {
        _tag: 'medical-decision',
      },
    },
  });

  const { onAdd: onAddDiagnosis } = useAddDiagnosis();
  const { onAdd: onAddCptCode } = useAddCptCode();

  const { groupedLabOrdersForChartTable } = usePatientLabOrders({
    searchBy: { field: 'encounterId', value: encounterId || '' },
  });

  const { labOrders } = useInHouseLabOrders({ searchBy: { field: 'encounterId', value: encounterId || '' } });

  const { orders: radiologyOrders } = usePatientRadiologyOrders({
    encounterIds: encounterId,
  });

  const { mutateAsync: recommendBillingSuggestions } = useRecommendBillingSuggestions();
  const [icdCodes, setIcdCodes] = useState<{ code: string; description: string; reason: string }[] | undefined>(
    undefined
  );
  const [cptCodes, setCptCodes] = useState<{ code: string; description: string; reason: string }[] | undefined>(
    undefined
  );
  const [emCode, setEmCode] = useState<{ code: string; description: string; suggestion: string }[] | undefined>(
    undefined
  );
  const [codingSuggestions, setCodingSuggestions] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    console.log(JSON.stringify(chartData?.diagnosis));
    const fetchRecommendedBillingSuggestions = async (): Promise<void> => {
      if (chartDataLoading) {
        return;
      }
      if (chartDataFieldsLoading) {
        return;
      }
      const diagnoses: DiagnosisDTO[] | undefined = chartData?.diagnosis;
      const cptCodes: CPTCodeDTO[] | undefined = [];

      if (chartData?.cptCodes) {
        cptCodes.push(...chartData.cptCodes);
      }
      if (chartData?.emCode) {
        cptCodes.push(chartData.emCode);
      }

      const externalLabOrders = Object.entries(groupedLabOrdersForChartTable?.hasResults || [])
        .concat(Object.entries(groupedLabOrdersForChartTable?.pendingActionOrResults || []))
        .flatMap(([_requisitionNumber, orderBundle]) => orderBundle.orders.map((order) => order.testItem))
        .join(', ');

      const inHouseLabOrders = labOrders?.map((order) => order.testItemName).join(', ');

      const radiologyOrdersString = radiologyOrders?.map((order) => order.studyType).join(', ');

      const proceduresString = chartData?.procedures?.map((procedure) => procedure.procedureType).join(', ');

      let newPatient = undefined;
      const newPatientFromChart = chartData?.observations?.find(
        (observation) => observation.field === 'seen-in-last-three-years'
      );
      const newPatientFromAppointmentCreation = appointment?.meta?.tag?.some(
        (tag) =>
          tag.system === PATIENT_INFO_META_DATA_SYSTEM && tag.code !== PATIENT_INFO_META_DATA_RETURNING_PATIENT_CODE
      );

      if (newPatientFromChart) {
        newPatient = newPatientFromChart?.value === 'no';
      } else if (newPatientFromAppointmentCreation) {
        newPatient = newPatientFromAppointmentCreation;
      }

      console.log(chartData, newPatient);

      const billingSuggestionTemp = await recommendBillingSuggestions({
        newPatient,
        hpi: chartDataFields?.chiefComplaint?.text ?? '',
        mdm: chartDataFields?.medicalDecision?.text ?? '',
        diagnoses: diagnoses,
        billing: cptCodes,
        externalLabOrders: externalLabOrders,
        internalLabOrders: inHouseLabOrders,
        radiologyOrders: radiologyOrdersString,
        procedures: proceduresString,
      });
      setIcdCodes(billingSuggestionTemp.icdCodes);
      setCptCodes(billingSuggestionTemp.cptCodes);
      setEmCode(billingSuggestionTemp.emCode);
      setCodingSuggestions(billingSuggestionTemp.codingSuggestions);
    };
    fetchRecommendedBillingSuggestions().catch((error) => console.log(error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chartData?.diagnosis,
    chartData?.cptCodes,
    chartData?.emCode,
    recommendBillingSuggestions,
    // chartDataFields?.chiefComplaint,
    chartDataFields?.medicalDecision,
    // chartData?.procedures,
    // groupedLabOrdersForChartTable?.hasResults,
    // groupedLabOrdersForChartTable?.pendingActionOrResults,
    // labOrders,
    // radiologyOrders,
    // chartData,
    // chartDataLoading,
    // chartDataFieldsLoading,
  ]);

  const handleClose = (): void => {
    setVisible(false);
  };

  const addIcdCode = (icdCode: { code: string; description: string; reason: string }): void => {
    onAddDiagnosis({ code: icdCode.code, display: icdCode.description });
  };

  const addCptCode = (cptCode: { code: string; description: string; reason: string }): void => {
    onAddCptCode({ code: cptCode.code, display: cptCode.description });
  };

  return visible &&
    ((icdCodes && icdCodes.length > 0) ||
      (cptCodes && cptCodes.length > 0) ||
      (emCode && emCode.length > 0) ||
      codingSuggestions) ? (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${otherColors.solidLine}`,
        borderRadius: 1,
        marginBottom: '16px',
        padding: '16px',
      }}
    >
      <Box
        style={{
          display: 'flex',
          borderRadius: '8px',
          marginBottom: '8px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <img src={aiIcon} style={{ width: '30px', marginRight: '8px' }} />
          <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
            OYSTEHR AI
          </Typography>
        </Box>
        <IconButton onClick={handleClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Box>
      {icdCodes && icdCodes.length > 0 && (
        <Box
          style={{
            background: '#E1F5FECC',
            borderRadius: '8px',
            padding: '8px',
            marginBottom: '10px',
          }}
        >
          <Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
            Potential Diagnoses with ICD-10 Codes
          </Typography>
          <ul>
            {icdCodes.map((icdCode) => {
              return (
                <li key={icdCode.code}>
                  <Grid container alignItems="center">
                    <Grid item sx={{ cursor: 'pointer' }}>
                      <Link onClick={(_event) => addIcdCode(icdCode)}>
                        <Typography variant="body1">{icdCode.code + ': ' + icdCode.description}</Typography>
                      </Link>
                    </Grid>
                    <Grid item>
                      <Tooltip title={icdCode.reason}>
                        <IconButton size="small">
                          <InfoOutlined sx={{ fontSize: '17px' }} />
                        </IconButton>
                      </Tooltip>
                    </Grid>
                  </Grid>
                </li>
              );
            })}
          </ul>
        </Box>
      )}
      {cptCodes && cptCodes.length > 0 && (
        <Box
          style={{
            background: '#E1F5FECC',
            borderRadius: '8px',
            padding: '8px',
            marginBottom: '10px',
          }}
        >
          <Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
            CPT Codes
          </Typography>
          <ul>
            {cptCodes.map((cptCode) => {
              return (
                <li key={cptCode.code}>
                  <Grid container alignItems="center">
                    <Grid item sx={{ cursor: 'pointer' }}>
                      <Link onClick={(_event) => addCptCode(cptCode)}>
                        <Typography variant="body1">{cptCode.code + ': ' + cptCode.description}</Typography>
                      </Link>
                    </Grid>
                    <Grid item>
                      <Tooltip title={cptCode.reason}>
                        <IconButton size="small">
                          <InfoOutlined sx={{ fontSize: '17px' }} />
                        </IconButton>
                      </Tooltip>
                    </Grid>
                  </Grid>
                </li>
              );
            })}
          </ul>
        </Box>
      )}
      {emCode && emCode.length > 0 && (
        <Box
          style={{
            background: '#E1F5FECC',
            borderRadius: '8px',
            padding: '8px',
            marginBottom: '10px',
          }}
        >
          <Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
            EM Code
          </Typography>
          <ul>
            {emCode.map((code) => (
              <li key={code.code}>
                <Typography variant="body1">{code.code + ': ' + code.description}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Suggestion: {code.suggestion}
                </Typography>
              </li>
            ))}
          </ul>
        </Box>
      )}
      {codingSuggestions && (
        <Box
          style={{
            background: '#E1F5FECC',
            borderRadius: '8px',
            padding: '8px',
          }}
        >
          <Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
            Coding Suggestions
          </Typography>
          <Typography variant="body1">{codingSuggestions}</Typography>
        </Box>
      )}
    </Box>
  ) : (
    <></>
  );
};

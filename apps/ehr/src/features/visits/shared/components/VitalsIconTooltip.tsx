import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, Stack, Typography, useTheme } from '@mui/material';
import { Link } from 'react-router-dom';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { GetVitalsResponseData, InPersonAppointmentInformation, VitalFieldNames, VitalsObservationDTO } from 'utils';
import { GenericToolTip } from '../../../../components/GenericToolTip';
import { ROUTER_PATH } from '../../in-person/routing/routesInPerson';
import { getObservationValueElements } from './vitals/components/VitalsHistoryEntry';

interface VitalsIconTooltipProps {
  appointment: InPersonAppointmentInformation;
  abnormalVitals: GetVitalsResponseData;
}

const getLabelForVitalField = (field: VitalFieldNames): string => {
  switch (field) {
    case VitalFieldNames.VitalTemperature:
      return 'Temperature';
    case VitalFieldNames.VitalHeartbeat:
      return 'Heartbeat';
    case VitalFieldNames.VitalRespirationRate:
      return 'Respiration Rate';
    case VitalFieldNames.VitalBloodPressure:
      return 'Blood Pressure';
    case VitalFieldNames.VitalOxygenSaturation:
      return 'Oxygen Saturation';
    case VitalFieldNames.VitalWeight:
      return 'Weight';
    case VitalFieldNames.VitalHeight:
      return 'Height';
    case VitalFieldNames.VitalVision:
      return 'Vision';
    default:
      return '';
  }
};

export const VitalsIconTooltip: React.FC<VitalsIconTooltipProps> = ({ appointment, abnormalVitals }) => {
  const theme = useTheme();

  const hasAbnormals = Object.keys(abnormalVitals).length > 0;
  if (!hasAbnormals) return null;

  const abnormals: {
    [K in keyof typeof VitalFieldNames]: { data: VitalsObservationDTO[]; label: string };
  } = Object.entries(abnormalVitals).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key as keyof typeof VitalFieldNames]: {
        data: value,
        label: getLabelForVitalField(key as VitalFieldNames),
      },
    }),
    {} as { [K in keyof typeof VitalFieldNames]: { data: VitalsObservationDTO[]; label: string } }
  );

  return (
    <GenericToolTip
      title={
        <>
          <AssessmentTitle>Abnormal vitals</AssessmentTitle>
          <Stack spacing={1}>
            {Object.values(abnormals).map((abnormal) => {
              return (
                <>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {abnormal.data.length > 0 &&
                      abnormal.data.map((item) => (
                        <Box key={item.resourceId || item.lastUpdated} sx={{ display: 'flex', alignItems: 'center' }}>
                          {abnormal.label} -&nbsp;
                          <Typography
                            component="span"
                            sx={{ fontSize: '14px', fontWeight: 'bold', color: theme.palette.warning.light }}
                          >
                            {getObservationValueElements(item, theme.palette.warning.light)}
                          </Typography>
                          {item.alertCriticality === 'abnormal' && (
                            <WarningAmberOutlinedIcon
                              fontSize="small"
                              sx={{ ml: '4px', verticalAlign: 'middle', color: theme.palette.warning.light }}
                            />
                          )}
                        </Box>
                      ))}
                  </Box>
                </>
              );
            })}
          </Stack>
        </>
      }
      customWidth="none"
      placement="top"
    >
      <Box sx={{ display: 'flex', width: '100%' }}>
        <Link
          to={`/in-person/${appointment.id}/${ROUTER_PATH.VITALS}`}
          style={{ textDecoration: 'none' }}
          key={'vitals-link-' + appointment.id}
        >
          <WarningAmberOutlinedIcon
            fontSize="medium"
            sx={{ ml: '4px', verticalAlign: 'middle', color: theme.palette.warning.light }}
          />
        </Link>
      </Box>
    </GenericToolTip>
  );
};

import { EditOutlined } from '@mui/icons-material';
import { IconButton, Table, TableBody, TableCell, TableRow, Tooltip, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import mixpanel from 'mixpanel-browser';
import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useZambdaClient, PageForm } from 'ui-components';
import { IntakeFlowPageRoute } from '../App';
import { CustomContainer } from '../components';
import { DATETIME_FULL_NO_YEAR } from '../helpers';
import { createAppointmentAndUpdateState } from '../helpers/createAppointmentAndUpdateState';
import { safelyCaptureException } from '../helpers/sentry';
import { IntakeDataContext } from '../store';
import { updatePatient } from '../store/IntakeActions';

const Review = (): JSX.Element => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { state, dispatch } = useContext(IntakeDataContext);
  const zambdaClient = useZambdaClient({ tokenless: false });
  const selectedSlotTimezoneAdjusted = useMemo(() => {
    const selectedAppointmentStart = state.appointmentSlot;
    if (selectedAppointmentStart && state.selectedLocation?.timezone) {
      return DateTime.fromISO(selectedAppointmentStart).setZone(state.selectedLocation?.timezone).setLocale('en-us');
    }

    return undefined;
  }, [state.appointmentSlot, state.selectedLocation?.timezone]);

  useEffect(() => {
    mixpanel.track('Review');
  }, []);

  const onSubmit = async (): Promise<void> => {
    setLoading(true);
    // if (!state.appointmentSlot || !state.appointmentSlot.id) {
    //   throw new Error('todo');
    // }

    if (!zambdaClient) {
      throw new Error('zambdaClient is not defined');
    }

    let appointment;
    try {
      appointment = await createAppointmentAndUpdateState(zambdaClient, state.patientInfo, state, dispatch);
    } catch (err) {
      safelyCaptureException(err);
      setLoading(false);
      throw err;
    }

    navigate(`/appointment/${appointment}`);
  };

  const reviewItems = [
    {
      name: 'Patient',
      valueString: `${state.patientInfo?.firstName} ${state.patientInfo?.lastName}`,
    },
    {
      name: 'Office',
      valueString: state.selectedLocation ? `${state.selectedLocation?.name}` : 'Unknown',
    },
    {
      name: 'Check-in time',
      valueString: selectedSlotTimezoneAdjusted?.toFormat(DATETIME_FULL_NO_YEAR),
      path: `/location/${state.selectedLocation?.slug}/${state.visitType}`,
    },
  ];
  const checkIfNew = (): void => {
    if (state.patientInfo?.newPatient) {
      updatePatient({ ...state.patientInfo, id: 'new-patient' }, dispatch);
    }
  };

  return (
    <CustomContainer
      title="Review and submit"
      description="Review and confirm all details below."
      bgVariant={IntakeFlowPageRoute.Review.path}
    >
      <Typography variant="h3" color="primary.main" marginTop={2} marginBottom={0}>
        Visit details
      </Typography>
      <Table
        sx={{
          marginBottom: 2,
          tr: {
            td: {
              borderBottom: '1px solid #E3E6EF',
            },
            '&:last-child': {
              td: {
                borderBottom: 'none',
              },
            },
          },
        }}
      >
        <TableBody>
          {reviewItems.map((item) => (
            <TableRow key={item.name}>
              <TableCell sx={{ paddingTop: 2, paddingBottom: 2, paddingLeft: 0, paddingRight: 0 }}>
                <Typography color="secondary.main">{item.name}</Typography>
              </TableCell>
              <TableCell padding="none" align="right">
                {item.valueString !== undefined && item.valueString}
              </TableCell>
              <TableCell padding="none" sx={{ paddingLeft: 1 }}>
                {item.path && (
                  <Tooltip title="Edit" placement="right">
                    <Link to={item.path} onClick={checkIfNew}>
                      <IconButton aria-label="edit" color="primary">
                        <EditOutlined />
                      </IconButton>
                    </Link>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageForm controlButtons={{ submitLabel: 'Reserve this check-in time', loading: loading }} onSubmit={onSubmit} />
    </CustomContainer>
  );
};

export default Review;

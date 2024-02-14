import { CheckCircle, EditOutlined } from '@mui/icons-material';
import CancelIcon from '@mui/icons-material/Cancel';
import { Chip, IconButton, Table, TableBody, TableCell, TableRow, Tooltip, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import mixpanel from 'mixpanel-browser';
import { ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useZambdaClient, PageForm } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import zapehrApi from '../api/zapehrApi';
import { CustomContainer } from '../components';
import { DATETIME_FULL_NO_YEAR } from '../helpers';
import { isPaperworkComplete, isPaperworkPageComplete } from '../helpers/paperworkCompleted';
import { safelyCaptureException } from '../helpers/sentry';
import { IntakeDataContext } from '../store';
import { VisitType } from '../store/types';
import { yupFHIRDateRegex } from 'ottehr-utils';

interface ReviewItem {
  name: string;
  path?: string;
  hidden?: boolean;
  valueString?: string;
  valueBoolean?: boolean;
}

const ReviewPaperwork = (): JSX.Element => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { state, dispatch } = useContext(IntakeDataContext);
  const zambdaClient = useZambdaClient({ tokenless: true });
  const selectedSlotTimezoneAdjusted = useMemo(() => {
    const selectedAppointmentStart = state.appointmentSlot;
    if (selectedAppointmentStart) {
      return DateTime.fromISO(selectedAppointmentStart).setZone(state.selectedLocation?.timezone).setLocale('en-us');
    }

    return undefined;
  }, [state.appointmentSlot, state.selectedLocation?.timezone]);

  useEffect(() => {
    mixpanel.track('Review Paperwork');
  }, []);

  const onSubmit = async (): Promise<void> => {
    // will set reviewPaperwork boolean field when click on edit paperwork button in thank you screen.
    // const { editPaperwork } = location.state ?? {};

    if (!zambdaClient) {
      throw new Error('zambdaClient is not defined');
    }
    if (!state.appointmentID) {
      throw new Error('state.appointmentID is not defined');
    }
    if (!state.paperworkQuestions) {
      throw new Error('paperworkQuestions is not defined');
    }

    if (!completedPaperwork) {
      throw new Error('paperwork is not undefined');
    }

    setLoading(true);

    // remove characters that are not numbers from phone numbers
    Object.keys(completedPaperwork).forEach((attribute) => {
      let phoneNumber = false;
      let date = false;
      state.paperworkQuestions?.forEach((questionPage) => {
        questionPage.questions
          .filter((itemTemp) => completedPaperwork[itemTemp.id] !== '')
          .forEach((itemTemp) => {
            if (itemTemp.id === attribute) {
              if (itemTemp.format === 'Phone Number') {
                phoneNumber = true;
                return;
              }
              if (itemTemp.type === 'Date') {
                date = true;
                return;
              }
            }
          });
      });
      if (phoneNumber) {
        completedPaperwork[attribute] = completedPaperwork[attribute].replace(/\D/g, '');
      }

      if (date) {
        if (!yupFHIRDateRegex.test(completedPaperwork[attribute])) {
          completedPaperwork[attribute] = completedPaperwork[attribute].toISO().split('T')[0];
        }
      }
    });

    try {
      await zapehrApi.updatePaperwork(
        zambdaClient,
        {
          appointmentID: state.appointmentID,
          paperwork: completedPaperwork,
          files: state.fileURLs,
        },
        dispatch,
      );
      setLoading(false);
      if (state.visitType === VisitType.WalkIn) {
        navigate(`/appointment/${state.appointmentID}/check-in`);
      } else {
        navigate(`/appointment/${state.appointmentID}`);
      }
    } catch (error) {
      safelyCaptureException(error);
      setLoading(false);
    }
  };

  if (!state.paperworkQuestions) {
    throw new Error('paperworkQuestions is not defined');
  }
  const completedPaperwork = state.completedPaperwork;
  if (!completedPaperwork) {
    throw new Error('completedPaperwork is not defined');
  }

  const reviewItems: ReviewItem[] = [
    {
      name: 'Patient',
      valueString: `${state.patientInfo?.firstName} ${state.patientInfo?.lastName}`,
      hidden: !state.patientInfo?.firstName, // users who are not logged in will not see name
    },
    {
      name: 'Office',
      valueString: state.selectedLocation ? `${state.selectedLocation?.name}` : 'Unknown',
    },
    {
      name: 'Check-in time',
      valueString: selectedSlotTimezoneAdjusted?.toFormat(DATETIME_FULL_NO_YEAR),
      hidden: state.visitType === VisitType.WalkIn,
    },
    ...state.paperworkQuestions.map((paperworkPage) => ({
      name: paperworkPage.reviewPageName || paperworkPage.page,
      path: `/paperwork/${paperworkPage.slug}`,
      valueBoolean: isPaperworkPageComplete(completedPaperwork, paperworkPage, state.fileURLs),
    })),
  ];

  return (
    <CustomContainer
      title="Review and submit"
      description="Review and confirm all details below."
      bgVariant={IntakeFlowPageRoute.ReviewPaperwork.path}
    >
      <Typography variant="h3" color="primary" marginTop={2} marginBottom={0}>
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
          {reviewItems
            .filter((reviewItem) => !reviewItem.hidden)
            .map((reviewItem) => (
              <TableRow key={reviewItem.name}>
                <TableCell
                  sx={{
                    paddingTop: 2,
                    paddingBottom: 2,
                    paddingLeft: 0,
                    paddingRight: 0,
                    color: otherColors.darkPurple,
                  }}
                >
                  {reviewItem.name}
                </TableCell>
                <TableCell padding="none" align="right">
                  {reviewItem.valueString !== undefined && reviewItem.valueString}
                  {reviewItem.valueBoolean !== undefined && getValueBoolean(reviewItem.valueBoolean)}
                </TableCell>
                <TableCell padding="none" sx={{ paddingLeft: 1 }}>
                  {reviewItem.path && (
                    <Tooltip title="Edit" placement="right">
                      <Link to={reviewItem.path}>
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
      <PageForm
        controlButtons={{
          submitLabel: isPaperworkComplete(state.completedPaperwork, state.paperworkQuestions, state.fileURLs)
            ? 'Finish'
            : 'Save and finish later',
          loading: loading,
        }}
        onSubmit={onSubmit}
      />
    </CustomContainer>
  );
};

function getValueBoolean(value: boolean): ReactNode {
  if (value) {
    return (
      <Chip
        icon={<CheckCircle />}
        size="small"
        color="info"
        sx={{
          fontSize: '14px',
          padding: '4px',
          '.MuiChip-icon': { color: otherColors.darkGreen, margin: 0 },
          '.MuiChip-label': { display: 'none' },
        }}
      />
    );
  } else {
    return (
      <Chip
        icon={<CancelIcon />}
        label="Not complete"
        size="small"
        sx={{
          fontSize: '14px',
          backgroundColor: otherColors.lightCancel,
          padding: '4px 5px',
          '.MuiChip-icon, .MuiChip-label': { color: otherColors.cancel },
        }}
      />
    );
  }
}

export default ReviewPaperwork;

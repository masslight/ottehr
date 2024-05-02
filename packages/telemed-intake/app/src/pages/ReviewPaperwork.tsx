import { EditOutlined } from '@mui/icons-material';
import { IconButton, Table, TableBody, TableCell, TableRow, Tooltip, Typography } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { getValueBoolean, PageForm, ReviewItem, safelyCaptureException } from 'ottehr-components';
import { deepCopy, getSelectors, yupDateTransform, yupFHIRDateRegex } from 'ottehr-utils';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { useAppointmentStore } from '../features/appointments';
import { useFilesStore } from '../features/files';
import { usePaperworkStore, useUpdatePaperworkMutation } from '../features/paperwork';
import { usePatientInfoStore } from '../features/patient-info';
import { CustomContainer } from '../features/common';
import { isPaperworkPageComplete } from '../utils/paperworkCompleted';
import { useZapEHRAPIClient } from '../utils';

const ReviewPaperwork = (): JSX.Element => {
  const navigate = useNavigate();
  const { appointmentID } = getSelectors(useAppointmentStore, ['appointmentID']);
  const fileURLs = useFilesStore((state) => state.fileURLs);
  const { completedPaperwork, paperworkQuestions } = getSelectors(usePaperworkStore, [
    'completedPaperwork',
    'paperworkQuestions',
  ]);
  const { patientInfo } = usePatientInfoStore.getState();
  const updatePaperwork = useUpdatePaperworkMutation();
  const apiClient = useZapEHRAPIClient();

  const onSubmit = async (): Promise<void> => {
    if (!apiClient) {
      throw new Error('apiClient is not defined');
    }
    if (!appointmentID) {
      throw new Error('appointmentID is not defined');
    }
    if (!paperworkQuestions) {
      throw new Error('paperworkQuestions is not defined');
    }
    if (!completedPaperwork) {
      throw new Error('paperwork is not defined');
    }

    const normalizedData = deepCopy(completedPaperwork);

    // remove characters that are not numbers from phone numbers
    Object.keys(normalizedData).forEach((attribute) => {
      let phoneNumber = false;
      let date = false;
      paperworkQuestions?.forEach((questionPage) => {
        questionPage.questions
          .filter((itemTemp) => normalizedData[itemTemp.id] !== '')
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
        normalizedData[attribute] = normalizedData[attribute].replace(/\D/g, '');
      }

      if (date) {
        if (!yupFHIRDateRegex.test(normalizedData[attribute])) {
          if (typeof normalizedData[attribute] === 'object') {
            normalizedData[attribute] = yupDateTransform(normalizedData[attribute]);
          }
        }
      }
    });

    updatePaperwork.mutate(
      {
        apiClient,
        appointmentID,
        paperwork: completedPaperwork,
        files: fileURLs,
      },
      {
        onSuccess: async () => {
          navigate(IntakeFlowPageRoute.WaitingRoom.path);
        },
        onError: (error) => {
          safelyCaptureException(error);
        },
      },
    );
  };

  if (!paperworkQuestions) {
    throw new Error('paperworkQuestions is not defined');
  }

  if (!completedPaperwork) {
    throw new Error('completedPaperwork is not defined');
  }

  const reviewItems: ReviewItem[] = [
    {
      name: 'Patient',
      valueString: `${patientInfo?.firstName} ${patientInfo?.lastName}`,
      hidden: !patientInfo?.firstName, // users who are not logged in will not see name
    },
    ...paperworkQuestions.map((paperworkPage) => ({
      name: paperworkPage.reviewPageName || paperworkPage.page,
      path: `/paperwork/${paperworkPage.slug}`,
      valueBoolean: isPaperworkPageComplete(completedPaperwork, paperworkPage, fileURLs),
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
          submitLabel: 'Save',
          loading: updatePaperwork.isLoading,
        }}
        onSubmit={onSubmit}
      />
    </CustomContainer>
  );
};

export default ReviewPaperwork;

import { Box, FormControl, FormGroup, FormLabel, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { getAllPractitionerCredentials, getQuestionnaireResponseByLinkId, PATIENT_SUPPORT_PHONE_NUMBER } from 'utils';
import useEvolveUser from '../../../../../hooks/useEvolveUser';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore, useSaveChartData } from '../../../../state';
import {
  ExcuseFormValues,
  getDefaultExcuseFormValues,
  getPatientName,
  mapExcuseTypeToFields,
  mapValuesToExcuse,
} from '../../../../utils';
import { mapExcuseFieldsToLabels } from '../../../../utils/school-work-excuse.helper';
import { ControlledExcuseCheckbox } from './ControlledExcuseCheckbox';
import { ControlledExcuseDatePicker } from './ControlledExcuseDatePicker';
import { ControlledExcuseTextField } from './ControlledExcuseTextField';
import { GenerateExcuseDialogContainer } from './GenerateExcuseDialogContainer';

type GenerateExcuseDialogExtendedProps = {
  open: boolean;
  onClose: () => void;
  type: keyof typeof mapExcuseTypeToFields;
  generate: ReturnType<typeof useSaveChartData>['mutate'];
};

export const GenerateExcuseDialog: FC<GenerateExcuseDialogExtendedProps> = (props) => {
  const { open, onClose, type, generate } = props;

  const fields = mapExcuseTypeToFields[type];
  const isSchool = ['schoolTemplate', 'schoolFree'].includes(type);
  const isTemplate = ['schoolTemplate', 'workTemplate'].includes(type);

  const { patient, chartData, setPartialChartData, questionnaireResponse } = getSelectors(useAppointmentStore, [
    'patient',
    'chartData',
    'setPartialChartData',
    'questionnaireResponse',
  ]);
  const user = useEvolveUser();

  const responsibleParty = {
    firstName: getQuestionnaireResponseByLinkId('responsible-party-first-name', questionnaireResponse)?.answer?.[0]
      ?.valueString,
    lastName: getQuestionnaireResponseByLinkId('responsible-party-last-name', questionnaireResponse)?.answer?.[0]
      ?.valueString,
    relationship: getQuestionnaireResponseByLinkId('responsible-party-relationship', questionnaireResponse)?.answer?.[0]
      ?.valueString,
  };
  const fullParentName =
    responsibleParty.firstName &&
    responsibleParty.lastName &&
    ['Parent', 'Legal Guardian'].includes(responsibleParty.relationship ?? '')
      ? `${responsibleParty.firstName} ${responsibleParty.lastName}`
      : '';
  const methods = useForm<ExcuseFormValues>({
    defaultValues: getDefaultExcuseFormValues({
      isSchool,
      isTemplate,
      patientName: getPatientName(patient?.name).firstLastName,
      parentName: fullParentName,
      providerName: user?.userName,
      suffix: user?.profileResource?.name?.[0]?.suffix?.join(' '),
      phoneNumber: PATIENT_SUPPORT_PHONE_NUMBER,
    }),
  });
  const { handleSubmit, getValues, setValue } = methods;

  const onSubmit = (values: ExcuseFormValues): void => {
    const excuse = mapValuesToExcuse(values, {
      type,
      isSchool,
      isTemplate,
      patientName: getPatientName(patient?.name).firstLastName,
      providerName: user?.userName,
      suffix: user?.profileResource ? getAllPractitionerCredentials(user?.profileResource).join(' ') : undefined,
    });
    generate(
      { newSchoolWorkNote: excuse },
      {
        onSuccess: (data) => {
          const savedExcuses = data?.chartData?.schoolWorkNotes;
          if (savedExcuses) {
            setPartialChartData({
              schoolWorkNotes: [...(chartData?.schoolWorkNotes || []), ...savedExcuses],
            });
          }
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while generating excuse. Please try again.', {
            variant: 'error',
          });
        },
      }
    );
    onClose();
  };

  return (
    <GenerateExcuseDialogContainer
      open={open}
      onSubmit={handleSubmit(onSubmit)}
      onClose={onClose}
      label={isSchool ? 'School Excuse' : 'Work excuse'}
    >
      <FormProvider {...methods}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {fields.includes('headerNote') && (
            <ControlledExcuseTextField name="headerNote" label="Note" fullWidth multiline required />
          )}

          {isTemplate && (
            <FormControl>
              <FormLabel>
                <Typography variant="subtitle2">Select whatever applies</Typography>
              </FormLabel>
              <FormGroup>
                {fields.includes('workFields') && (
                  <>
                    <ControlledExcuseCheckbox
                      name="wereWithThePatientAtTheTimeOfTheVisit"
                      label={mapExcuseFieldsToLabels['wereWithThePatientAtTheTimeOfTheVisit']}
                    />
                    <ControlledExcuseCheckbox
                      name="areNeededAtHomeToCareForChildDuringThisIllness"
                      label={mapExcuseFieldsToLabels['areNeededAtHomeToCareForChildDuringThisIllness']}
                    />
                    <Box sx={{ display: 'flex' }}>
                      <ControlledExcuseCheckbox
                        name="workExcusedFromWorkFromTo"
                        label={mapExcuseFieldsToLabels['workExcusedFromWorkFromTo']}
                      />

                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <ControlledExcuseDatePicker
                          name="workExcusedFromWorkFromDate"
                          validate={(value) => {
                            if (getValues('workExcusedFromWorkFromTo') && !value) {
                              return 'Field is required';
                            }
                            return;
                          }}
                        />
                        <ControlledExcuseDatePicker
                          name="workExcusedFromWorkToDate"
                          validate={(value) => {
                            if (getValues('workExcusedFromWorkFromTo') && !value) {
                              return 'Field is required';
                            }
                            return;
                          }}
                        />
                      </Box>
                    </Box>

                    <Box>
                      <ControlledExcuseCheckbox
                        name="workExcusedFromWorkOn"
                        label={mapExcuseFieldsToLabels['workExcusedFromWorkOn']}
                      />

                      <ControlledExcuseDatePicker
                        name="workExcusedFromWorkOnDate"
                        validate={(value) => {
                          if (getValues('workExcusedFromWorkOn') && !value) {
                            return 'Field is required';
                          }
                          return;
                        }}
                      />
                    </Box>
                  </>
                )}

                {fields.includes('schoolFields') && (
                  <>
                    <Box sx={{ display: 'flex' }}>
                      <ControlledExcuseCheckbox
                        name="excusedFromSchoolFromTo"
                        label={mapExcuseFieldsToLabels['excusedFromSchoolFromTo']}
                      />
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <ControlledExcuseDatePicker
                          name="excusedFromSchoolFromDate"
                          validate={(value) => {
                            if (getValues('excusedFromSchoolFromTo') && !value) {
                              return 'Field is required';
                            }
                            return;
                          }}
                        />
                        <ControlledExcuseDatePicker
                          name="excusedFromSchoolToDate"
                          validate={(value) => {
                            if (getValues('excusedFromSchoolFromTo') && !value) {
                              return 'Field is required';
                            }
                            return;
                          }}
                        />
                      </Box>
                    </Box>

                    <Box>
                      <ControlledExcuseCheckbox
                        name="excusedFromSchoolOn"
                        label={mapExcuseFieldsToLabels['excusedFromSchoolOn']}
                      />
                      <ControlledExcuseDatePicker
                        name="excusedFromSchoolOnDate"
                        validate={(value) => {
                          if (getValues('excusedFromSchoolOn') && !value) {
                            return 'Field is required';
                          }
                          return;
                        }}
                      />
                    </Box>

                    <ControlledExcuseCheckbox
                      name="excusedFromSchoolUntilFeverFreeFor24Hours"
                      label={mapExcuseFieldsToLabels['excusedFromSchoolUntilFeverFreeFor24Hours']}
                    />
                    <ControlledExcuseCheckbox
                      name="excusedFromSchoolUntilOnAntibioticsFor24Hours"
                      label={mapExcuseFieldsToLabels['excusedFromSchoolUntilOnAntibioticsFor24Hours']}
                    />
                    <ControlledExcuseCheckbox
                      name="ableToReturnToSchoolWithoutRestriction"
                      label={mapExcuseFieldsToLabels['ableToReturnToSchoolWithoutRestriction']}
                    />
                    <ControlledExcuseCheckbox
                      name="ableToReturnToGymActivitiesWithoutRestriction"
                      label={mapExcuseFieldsToLabels['ableToReturnToGymActivitiesWithoutRestriction']}
                    />
                    <ControlledExcuseCheckbox
                      name="ableToReturnToSchoolWhenThereNoLongerIsAnyEyeDischarge"
                      label={mapExcuseFieldsToLabels['ableToReturnToSchoolWhenThereNoLongerIsAnyEyeDischarge']}
                    />

                    <Box sx={{ display: 'flex' }}>
                      <ControlledExcuseCheckbox
                        name="excusedFromGymActivitiesFromTo"
                        label={mapExcuseFieldsToLabels['excusedFromGymActivitiesFromTo']}
                      />

                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <ControlledExcuseDatePicker
                          name="excusedFromGymActivitiesFromDate"
                          validate={(value) => {
                            if (getValues('excusedFromGymActivitiesFromTo') && !value) {
                              return 'Field is required';
                            }
                            return;
                          }}
                        />
                        <ControlledExcuseDatePicker
                          name="excusedFromGymActivitiesToDate"
                          validate={(value) => {
                            if (getValues('excusedFromGymActivitiesFromTo') && !value) {
                              return 'Field is required';
                            }
                            return;
                          }}
                        />
                      </Box>
                    </Box>

                    <ControlledExcuseCheckbox
                      name="ableToReturnToSchoolWithTheFollowingRestrictions"
                      label={mapExcuseFieldsToLabels['ableToReturnToSchoolWithTheFollowingRestrictions']}
                    />

                    <Box sx={{ display: 'flex', flexDirection: 'column', ml: 5 }}>
                      <ControlledExcuseCheckbox
                        name="dominantHandIsInjuredPleaseAllowAccommodations"
                        label={mapExcuseFieldsToLabels['dominantHandIsInjuredPleaseAllowAccommodations']}
                        onChange={(newValue) =>
                          newValue && setValue('ableToReturnToSchoolWithTheFollowingRestrictions', true)
                        }
                      />
                      <ControlledExcuseCheckbox
                        name="needsExtraTimeBetweenClassesAssistantOrBookBuddy"
                        label={mapExcuseFieldsToLabels['needsExtraTimeBetweenClassesAssistantOrBookBuddy']}
                        onChange={(newValue) =>
                          newValue && setValue('ableToReturnToSchoolWithTheFollowingRestrictions', true)
                        }
                      />

                      <Box>
                        <ControlledExcuseCheckbox
                          name="otherRestrictions"
                          label={mapExcuseFieldsToLabels['otherRestrictions']}
                          onChange={(newValue) =>
                            newValue && setValue('ableToReturnToSchoolWithTheFollowingRestrictions', true)
                          }
                        />

                        <ControlledExcuseTextField
                          name="otherRestrictionsNote"
                          placeholder="Please specify"
                          validate={(value) => {
                            if (getValues('otherRestrictions') && !value) {
                              return 'Field is required';
                            }
                            return;
                          }}
                        />
                      </Box>
                    </Box>

                    <ControlledExcuseCheckbox
                      name="allowedUseOfCrutchesAceWrapSplintAndElevatorAsNecessary"
                      label={mapExcuseFieldsToLabels['allowedUseOfCrutchesAceWrapSplintAndElevatorAsNecessary']}
                    />
                    <ControlledExcuseCheckbox
                      name="allowedUseOfElevatorAsNecessary"
                      label={mapExcuseFieldsToLabels['allowedUseOfElevatorAsNecessary']}
                    />
                    <ControlledExcuseCheckbox
                      name="unableToParticipateInGymActivitiesUntilClearedByAPhysician"
                      label={mapExcuseFieldsToLabels['unableToParticipateInGymActivitiesUntilClearedByAPhysician']}
                    />

                    <Box sx={{ display: 'flex' }}>
                      <ControlledExcuseCheckbox
                        name="schoolExcusedFromWorkFromTo"
                        label={mapExcuseFieldsToLabels['schoolExcusedFromWorkFromTo']}
                      />

                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <ControlledExcuseDatePicker
                          name="schoolExcusedFromWorkFromDate"
                          validate={(value) => {
                            if (getValues('schoolExcusedFromWorkFromTo') && !value) {
                              return 'Field is required';
                            }
                            return;
                          }}
                        />
                        <ControlledExcuseDatePicker
                          name="schoolExcusedFromWorkToDate"
                          validate={(value) => {
                            if (getValues('schoolExcusedFromWorkFromTo') && !value) {
                              return 'Field is required';
                            }
                            return;
                          }}
                        />
                      </Box>
                    </Box>

                    <Box>
                      <ControlledExcuseCheckbox
                        name="schoolExcusedFromWorkOn"
                        label={mapExcuseFieldsToLabels['schoolExcusedFromWorkOn']}
                      />

                      <ControlledExcuseDatePicker
                        name="schoolExcusedFromWorkOnDate"
                        validate={(value) => {
                          if (getValues('schoolExcusedFromWorkOn') && !value) {
                            return 'Field is required';
                          }
                          return;
                        }}
                      />
                    </Box>

                    <Box>
                      <ControlledExcuseCheckbox
                        name="ableToReturnToWorkWithTheFollowingRestrictions"
                        label={mapExcuseFieldsToLabels['ableToReturnToWorkWithTheFollowingRestrictions']}
                      />

                      <ControlledExcuseTextField
                        name="ableToReturnToWorkWithTheFollowingRestrictionsNote"
                        placeholder="Please specify"
                        validate={(value) => {
                          if (getValues('ableToReturnToWorkWithTheFollowingRestrictions') && !value) {
                            return 'Field is required';
                          }
                          return;
                        }}
                      />
                    </Box>
                    <Box>
                      <ControlledExcuseCheckbox name="other" label={mapExcuseFieldsToLabels['other']} />

                      <ControlledExcuseTextField
                        name="otherNote"
                        placeholder="Please specify"
                        validate={(value) => {
                          if (getValues('other') && !value) {
                            return 'Field is required';
                          }
                          return;
                        }}
                      />
                    </Box>
                  </>
                )}
              </FormGroup>
            </FormControl>
          )}

          {fields.includes('footerNote') && (
            <ControlledExcuseTextField name="footerNote" label="Note" fullWidth multiline required />
          )}
        </Box>
      </FormProvider>
    </GenerateExcuseDialogContainer>
  );
};

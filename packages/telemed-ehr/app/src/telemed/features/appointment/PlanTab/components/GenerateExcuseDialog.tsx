import React, { FC } from 'react';
import { Box, FormControl, FormGroup, FormLabel, Typography } from '@mui/material';
import { FormProvider, useForm } from 'react-hook-form';
import { useAppointmentStore, useSaveChartData } from '../../../../state';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import useOttehrUser from '../../../../../hooks/useOttehrUser';
import {
  ExcuseFormValues,
  getDefaultExcuseFormValues,
  getPatientName,
  mapExcuseTypeToFields,
  mapValuesToExcuse,
} from '../../../../utils';
import { GenerateExcuseDialogContainer } from './GenerateExcuseDialogContainer';
import { ControlledExcuseDatePicker } from './ControlledExcuseDatePicker';
import { ControlledExcuseCheckbox } from './ControlledExcuseCheckbox';
import { ControlledExcuseTextField } from './ControlledExcuseTextField';
import { mapExcuseFieldsToLabels } from '../../../../utils/school-work-excuse.helper';

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
  const isTemplate = ['workTemplate', 'schoolTemplate'].includes(type);

  const { patient, chartData, setPartialChartData } = getSelectors(useAppointmentStore, [
    'patient',
    'chartData',
    'setPartialChartData',
  ]);
  const user = useOttehrUser();
  const methods = useForm<ExcuseFormValues>({
    defaultValues: getDefaultExcuseFormValues({
      isSchool,
      isTemplate,
      patientName: getPatientName(patient?.name).firstLastName,
      providerName: user?.userName,
      suffix: user?.profileResource?.name?.[0]?.suffix?.join(' '),
      phoneNumber: user?.phoneNumber,
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
      suffix: user?.profileResource?.name?.[0]?.suffix?.join(' '),
    });
    generate(
      { newSchoolWorkNote: excuse },
      {
        onSuccess: (data) => {
          const savedExcuses = data?.schoolWorkNotes;
          if (savedExcuses) {
            setPartialChartData({
              schoolWorkNotes: [...(chartData?.schoolWorkNotes || []), ...savedExcuses],
            });
          }
        },
      },
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
          {fields.includes('parentName') && (
            <ControlledExcuseTextField name="parentName" label="Parent/Guardian name" fullWidth required />
          )}
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
                  </>
                )}

                {(fields.includes('workFields') || fields.includes('schoolFields')) && (
                  <>
                    <Box sx={{ display: 'flex' }}>
                      <ControlledExcuseCheckbox
                        name="excusedFromWorkFromTo"
                        label={mapExcuseFieldsToLabels['excusedFromWorkFromTo']}
                      />

                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <ControlledExcuseDatePicker
                          name="excusedFromWorkFromDate"
                          validate={(value) => {
                            if (getValues('excusedFromWorkFromTo') && !value) {
                              return 'Field is required';
                            }
                            return;
                          }}
                        />
                        <ControlledExcuseDatePicker
                          name="excusedFromWorkToDate"
                          validate={(value) => {
                            if (getValues('excusedFromWorkFromTo') && !value) {
                              return 'Field is required';
                            }
                            return;
                          }}
                        />
                      </Box>
                    </Box>

                    <Box>
                      <ControlledExcuseCheckbox
                        name="excusedFromWorkOn"
                        label={mapExcuseFieldsToLabels['excusedFromWorkOn']}
                      />

                      <ControlledExcuseDatePicker
                        name="excusedFromWorkOnDate"
                        validate={(value) => {
                          if (getValues('excusedFromWorkOn') && !value) {
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

import { Box, Button, Dialog, Paper, Typography } from '@mui/material';
import { FC, ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DateComponents, getDateComponentsFromISOString, PatientInfoInProgress } from 'utils';
import { FormInputType } from '../types';
import PageForm from './PageForm';

interface ConfirmDateOfBirthFormProps {
  patientInfo: PatientInfoInProgress | undefined;
  description?: ReactElement;
  defaultValue?: string | undefined;
  required: boolean;
  loading?: boolean;
  dobConfirmed?: boolean | undefined;
  onConfirmedSubmit: (confirmedDateOfBirth: string) => Promise<void>;
  onUnconfirmedSubmit?: (unconfirmedDateOfBirth: string) => void;
  wrongDateOfBirthModal: {
    buttonText: string;
    message: ReactElement;
    onSubmit: () => void;
  };
}

const FORM_ELEMENTS_FIELDS = {
  challengeDay: { label: 'Date of birth day', name: 'challengeDay' },
  challengeMonth: { label: 'Date of birth month', name: 'challengeMonth' },
  challengeYear: { label: 'Date of birth year', name: 'challengeYear' },
};

const { challengeDay, challengeMonth, challengeYear } = FORM_ELEMENTS_FIELDS;

const ConfirmDateOfBirthForm: FC<ConfirmDateOfBirthFormProps> = ({
  patientInfo,
  description,
  defaultValue,
  required,
  loading,
  dobConfirmed,
  onConfirmedSubmit,
  onUnconfirmedSubmit,
  wrongDateOfBirthModal,
}): JSX.Element => {
  const [openModal, setOpenModal] = useState<boolean>(false);
  const [formValuesCopy, setFormValuesCopy] = useState<FieldValues | undefined>();
  const { t } = useTranslation();

  const defaultDateComponents: DateComponents = useMemo(() => {
    return getDateComponentsFromISOString(defaultValue);
  }, [defaultValue]);

  const formElements: FormInputType[] = [
    {
      type: 'Date',
      name: 'challengeDateOfBirth',
      required: required,
      fieldMap: {
        day: challengeDay.name,
        month: challengeMonth.name,
        year: challengeYear.name,
      },
      fields: [
        {
          type: 'Date Year',
          name: challengeYear.name,
          label: t('aboutPatient.birthDate.labelYear'),
          defaultValue: defaultDateComponents?.year,
        },
        {
          type: 'Date Month',
          name: challengeMonth.name,
          label: t('aboutPatient.birthDate.labelMonth'),
          defaultValue: defaultDateComponents?.month,
        },
        {
          type: 'Date Day',
          name: challengeDay.name,
          label: t('aboutPatient.birthDate.labelDay'),
          defaultValue: defaultDateComponents?.day,
        },
      ],
    },
    {
      type: 'Description',
      name: 'description',
      description: description,
    },
  ];

  useEffect(() => {
    if (dobConfirmed === false) {
      setOpenModal(true);
    }
  }, [dobConfirmed]);

  const handleSubmit = async (data: FieldValues): Promise<void> => {
    const day1 = data[challengeDay.name];
    const month1 = data[challengeMonth.name];
    const year1 = data[challengeYear.name];

    let shouldConfirm = false;

    if (patientInfo) {
      const day2 = patientInfo.dobDay;
      const month2 = patientInfo.dobMonth;
      const year2 = patientInfo.dobYear;
      shouldConfirm = day1 == day2 && year1 === year2 && month1 === month2;
    } else {
      shouldConfirm = true;
    }

    // Check if birth dates match
    if (shouldConfirm) {
      await onConfirmedSubmit(`${year1}-${month1}-${day1}`);
    } else {
      onUnconfirmedSubmit && onUnconfirmedSubmit(`${year1}-${month1}-${day1}`);
      setOpenModal(true);
    }
  };

  const onFormValuesChange = useCallback((formValues: FieldValues): void => {
    setFormValuesCopy(formValues);
  }, []);

  const formattedDOB: string | undefined = useMemo(() => {
    const month1 = formValuesCopy?.[challengeMonth.name];
    const day1 = formValuesCopy?.[challengeDay.name];
    const year1 = formValuesCopy?.[challengeYear.name];

    if (month1 && day1 && year1) {
      return `${month1}/${day1}/${year1}`;
    }
    return undefined;
  }, [formValuesCopy]);

  return (
    <>
      <PageForm
        formElements={formElements}
        controlButtons={{
          submitLabel: t('general.button.continue'),
          loading: loading,
        }}
        onSubmit={handleSubmit}
        onFormValuesChange={onFormValuesChange}
      />
      {/* Modal for incorrect birthday input */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Paper>
          <Box margin={5} maxWidth="sm">
            <Typography sx={{ width: '100%' }} variant="h2" color="primary.main">
              {t('confirmDob.notConfirmed.title')}
            </Typography>
            <Typography data-testid="dob-not-confirmed-body" marginTop={2}>
              {t('confirmDob.notConfirmed.body1')}
              {formattedDOB ? ` (${formattedDOB})` : ''} {t('confirmDob.notConfirmed.body2')}{' '}
              {patientInfo?.firstName ? ` (${patientInfo?.firstName}).` : '.'}
            </Typography>
            {wrongDateOfBirthModal.message}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', md: 'row' }}
              sx={{ justifyContent: 'space-between', mt: 4.125 }}
            >
              <Button
                variant="outlined"
                onClick={wrongDateOfBirthModal.onSubmit}
                color="secondary"
                size="large"
                type="submit"
              >
                {wrongDateOfBirthModal.buttonText}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => setOpenModal(false)}
                size="large"
                type="button"
              >
                {t('confirmDob.notConfirmed.tryAgain')}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Dialog>
    </>
  );
};

export default ConfirmDateOfBirthForm;

import { DateTime } from 'luxon';
import { useCallback, useMemo, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useBeforeUnload, useNavigate } from 'react-router-dom';
import {
  DateComponents,
  getDateComponentsFromISOString,
  isoStringFromDateComponents,
  PatientInfo,
  PersonSex,
  REASON_ADDITIONAL_DISPLAY_CHAR,
  REASON_ADDITIONAL_MAX_CHAR,
  ServiceMode,
} from 'utils';
import { bookingBasePath } from '../App';
import { PageContainer } from '../components';
import { ErrorDialog } from '../components/ErrorDialog';
import PageForm from '../components/PageForm';
import {
  PatientInfoInProgress,
  PatientInformationKnownPatientFieldsDisplay,
  PatientSexOptions,
  ReasonForVisitOptions,
} from '../features/patients';
import { getPatientAgeDependentDataWithPatientData } from '../helpers/validation';
import { useNavigateInFlow } from '../hooks/useNavigateInFlow';
import { FormInputType } from '../types';
import { useBookingContext } from './BookingHome';

interface PatientInformation {
  dobYear: string | undefined;
  dobMonth: string | undefined;
  dobDay: string | undefined;
}

interface ErrorDialogConfig {
  title: string;
  description: string;
  closeButtonText: string;
  handleClose: () => void;
  handleContinue?: () => void;
}

const PatientInformation = (): JSX.Element => {
  const navigateInFlow = useNavigateInFlow();
  const [errorDialog, setErrorDialog] = useState<ErrorDialogConfig | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { patients, slotId, patientInfo, unconfirmedDateOfBirth, serviceMode, setPatientInfo } = useBookingContext();
  const selectPatientPageUrl = `${bookingBasePath}/${slotId}/patients`;

  // console.log('patient info', patientInfo);

  // compensating for this form design taking away direct access to the form state in order to persist on reload <man-shrugging-emoji>
  const [formValuesCopy, setFormValuesCopy] = useState<FieldValues | undefined>();
  // we don't need to select state from the store, we just need it one time on rerender
  // cause when the patient comes to the PatientInformation component - they will already have
  // everything needed in the patients state
  const { defaultEmail } = useMemo(() => {
    const { dobDay, dobMonth, dobYear, dateOfBirth } = formValuesCopy || {};
    let formDob: string | undefined = dateOfBirth;
    if (dobDay && dobMonth && dobYear) {
      formDob = isoStringFromDateComponents({
        day: dobDay as string,
        month: dobMonth as string,
        year: dobYear as string,
      });
    }
    return getPatientAgeDependentDataWithPatientData(patientInfo, unconfirmedDateOfBirth, formDob);
  }, [patientInfo, unconfirmedDateOfBirth, formValuesCopy]);

  const middleNameStored = useMemo(() => {
    const patientInfoStored = patients.find((patient) => patient.id === patientInfo?.id);
    return !!patientInfoStored?.middleName;
  }, [patients, patientInfo]);

  const defaultDateComponents: DateComponents = useMemo(() => {
    return getDateComponentsFromISOString(patientInfo?.dateOfBirth);
  }, [patientInfo?.dateOfBirth]);

  const formElements: FormInputType[] = useMemo(() => {
    if (serviceMode === ServiceMode.virtual) {
      return [
        {
          type: 'Text',
          name: 'firstName',
          label: 'First name (legal)',
          placeholder: 'First name',
          defaultValue: patientInfo?.firstName,
          required: patientInfo?.newPatient,
          hidden: !patientInfo?.newPatient,
        },
        {
          type: 'Text',
          name: 'middleName',
          label: 'Middle name (legal)',
          placeholder: 'Middle name',
          defaultValue: patientInfo?.middleName,
          hidden: !patientInfo?.newPatient,
        },
        {
          type: 'Text',
          name: 'lastName',
          label: 'Last name (legal)',
          placeholder: 'Last name',
          defaultValue: patientInfo?.lastName,
          required: patientInfo?.newPatient,
          hidden: !patientInfo?.newPatient,
        },
        {
          type: 'Text',
          name: 'chosenName',
          label: 'Chosen or preferred name (optional)',
          placeholder: 'Chosen name',
          defaultValue: patientInfo?.chosenName,
        },
        {
          type: 'Date',
          name: 'dateOfBirth',
          label: t('aboutPatient.birthDate.label'),
          required: patientInfo?.newPatient,
          hidden: !patientInfo?.newPatient,
          fieldMap: {
            day: 'dobDay',
            month: 'dobMonth',
            year: 'dobYear',
          },
          fields: [
            {
              type: 'Date Year',
              name: 'dobYear',
              label: t('aboutPatient.birthDate.labelYear'),
              defaultValue: patientInfo?.dobYear ?? defaultDateComponents.year,
              required: patientInfo?.newPatient,
              hidden: !patientInfo?.newPatient,
            },
            {
              type: 'Date Month',
              name: 'dobMonth',
              label: t('aboutPatient.birthDate.labelMonth'),
              defaultValue: patientInfo?.dobMonth ?? defaultDateComponents.month,
              required: patientInfo?.newPatient,
              hidden: !patientInfo?.newPatient,
            },
            {
              type: 'Date Day',
              name: 'dobDay',
              label: t('aboutPatient.birthDate.labelDay'),
              defaultValue: patientInfo?.dobDay ?? defaultDateComponents.day,
              required: patientInfo?.newPatient,
              hidden: !patientInfo?.newPatient,
            },
          ],
        },
        {
          type: 'Select',
          name: 'sex',
          label: "Patient's birth sex",
          defaultValue: patientInfo?.sex,
          required: true,
          hidden: !patientInfo?.newPatient,
          infoTextSecondary:
            'Our care team uses this to inform treatment recommendations and share helpful information regarding potential medication side effects, as necessary.',
          selectOptions: Object.entries(PersonSex).map(([key, value]) => {
            return {
              label: key,
              value: value,
            };
          }),
        },
        {
          type: 'Text',
          format: 'Decimal',
          name: 'weight',
          label: 'Patient weight (lbs)',
          infoTextSecondary: 'Entering correct information in this box will help us with prescription dosing.',
          defaultValue: patientInfo?.weight,
          helperText: patientInfo?.newPatient
            ? undefined
            : `Weight last updated: ${
                patientInfo?.weightLastUpdated
                  ? DateTime.fromFormat(patientInfo.weightLastUpdated, 'yyyy-LL-dd').toFormat('MM/dd/yyyy')
                  : 'N/A'
              }`,
          showHelperTextIcon: false,
        },
        {
          type: 'Text',
          name: 'email',
          label: 'Email',
          format: 'Email',
          defaultValue: patientInfo?.email,
          required: true,
        },
        {
          type: 'Select',
          name: 'reasonForVisit',
          label: t('aboutPatient.reasonForVisit.label'),
          defaultValue: patientInfo?.reasonForVisit,
          selectOptions: ReasonForVisitOptions.map((reason) => {
            return { value: reason, label: t(`paperworkPages.${reason}`) };
          }),
          required: true,
        },
        {
          type: 'Text',
          name: 'authorizedNonLegalGuardians',
          label: 'Full name(s) of authorized non-legal guardian(s)',
          defaultValue: patientInfo?.authorizedNonLegalGuardians,
          multiline: true,
          maxRows: 2,
        },
      ];
    } else {
      return [
        {
          type: 'Text',
          name: 'firstName',
          label: t('aboutPatient.patientName.legalFirstName'),
          placeholder: t('aboutPatient.patientName.placeholderFirstName'),
          defaultValue: patientInfo?.firstName,
          required: patientInfo?.newPatient,
          hidden: !patientInfo?.newPatient,
        },
        {
          type: 'Text',
          name: 'middleName',
          label: t('aboutPatient.patientName.legalMiddleName'),
          placeholder: t('aboutPatient.patientName.placeholderMiddleName'),
          defaultValue: patientInfo?.middleName,
          required: false,
          hidden: middleNameStored,
        },
        {
          type: 'Text',
          name: 'lastName',
          label: t('aboutPatient.patientName.legalLastName'),
          placeholder: t('aboutPatient.patientName.placeholderLastName'),
          defaultValue: patientInfo?.lastName,
          required: patientInfo?.newPatient,
          hidden: !patientInfo?.newPatient,
        },
        {
          type: 'Date',
          name: 'dateOfBirth',
          label: t('aboutPatient.birthDate.label'),
          required: patientInfo?.newPatient,
          hidden: !patientInfo?.newPatient,
          fieldMap: {
            day: 'dobDay',
            month: 'dobMonth',
            year: 'dobYear',
          },
          fields: [
            {
              type: 'Date Year',
              name: 'dobYear',
              label: t('aboutPatient.birthDate.labelYear'),
              defaultValue: patientInfo?.dobYear ?? defaultDateComponents.year,
              required: patientInfo?.newPatient,
              hidden: !patientInfo?.newPatient,
            },
            {
              type: 'Date Month',
              name: 'dobMonth',
              label: t('aboutPatient.birthDate.labelMonth'),
              defaultValue: patientInfo?.dobMonth ?? defaultDateComponents.month,
              required: patientInfo?.newPatient,
              hidden: !patientInfo?.newPatient,
            },
            {
              type: 'Date Day',
              name: 'dobDay',
              label: t('aboutPatient.birthDate.labelDay'),
              defaultValue: patientInfo?.dobDay ?? defaultDateComponents.day,
              required: patientInfo?.newPatient,
              hidden: !patientInfo?.newPatient,
            },
          ],
        },
        {
          type: 'Select',
          name: 'sex',
          label: t('aboutPatient.birthSex.label'),
          defaultValue: patientInfo?.sex,
          selectOptions: PatientSexOptions.map((sex) => {
            return { value: sex, label: t(`paperworkPages.${sex}`) };
          }),
          required: true,
          infoTextSecondary: t('aboutPatient.birthSex.whyAskDescription'),
        },
        {
          type: 'Text',
          name: 'email',
          label: t('aboutPatient.email.label'),
          format: 'Email',
          defaultValue: defaultEmail,
          required: true,
        },
        {
          type: 'Select',
          name: 'reasonForVisit',
          label: t('aboutPatient.reasonForVisit.label'),
          defaultValue: patientInfo?.reasonForVisit,
          selectOptions: ReasonForVisitOptions.map((reason) => {
            return { value: reason, label: t(`paperworkPages.${reason}`) };
          }),
          required: true,
        },
        {
          type: 'Text',
          name: 'reasonAdditional',
          label: 'Tell us more (optional)',
          defaultValue: patientInfo?.reasonAdditional,
          multiline: true,
          maxRows: 2,
          maxCharacters: {
            totalCharacters: REASON_ADDITIONAL_MAX_CHAR,
            displayCharCount: REASON_ADDITIONAL_DISPLAY_CHAR,
          },
        },
        {
          type: 'Text',
          name: 'authorizedNonLegalGuardians',
          label: 'Full name(s) of authorized non-legal guardian(s)',
          defaultValue: patientInfo?.authorizedNonLegalGuardians,
          multiline: true,
          maxRows: 2,
        },
      ];
    }
  }, [
    serviceMode,
    patientInfo,
    t,
    middleNameStored,
    defaultDateComponents.year,
    defaultDateComponents.month,
    defaultDateComponents.day,
    defaultEmail,
  ]);

  const confirmDuplicate = useCallback(
    (patient: PatientInfo | undefined, reasonForVisit: string | undefined): void => {
      setErrorDialog(undefined);
      // reload page with existing patient data
      const { year: dobYear, month: dobMonth, day: dobDay } = getDateComponentsFromISOString(patient?.dateOfBirth);
      setPatientInfo({
        id: patient?.id,
        newPatient: false,
        firstName: patient?.firstName,
        lastName: patient?.lastName,
        dobYear,
        dobDay,
        dobMonth,
        sex: patient?.sex,
        reasonForVisit: reasonForVisit,
        email: patient?.email,
      });
    },
    [setPatientInfo]
  );

  const onSubmit = useCallback(
    async (data: Partial<PatientInfoInProgress>): Promise<void> => {
      let foundDuplicate: PatientInfo | undefined;
      // check if a patient with the same data already exists for this user
      let idx = patients.length - 1;
      console.log('patient information onSubmit');
      if (patientInfo?.newPatient && data.firstName && data.lastName && data.dobYear && data.dobMonth && data.dobYear) {
        while (!foundDuplicate && idx >= 0) {
          const firstNameMatch = patients[idx].firstName?.toLocaleLowerCase() === data.firstName.toLocaleLowerCase();
          const lastNameMatch = patients[idx].lastName?.toLocaleLowerCase() === data.lastName.toLocaleLowerCase();
          const dobMatch = patients[idx].dateOfBirth === `${data.dobYear}-${data.dobMonth}-${data.dobDay}`;
          if (firstNameMatch && lastNameMatch && dobMatch) {
            foundDuplicate = patients[idx];
            break;
          }
          idx--;
        }
      }
      if (foundDuplicate) {
        setErrorDialog({
          title: `${t('aboutPatient.errors.foundDuplicate.title')} ${data.firstName}`,
          description: `${t('aboutPatient.errors.foundDuplicate.description1')} ${data.firstName} ${data.lastName}, 
           ${data.dobMonth}/${data.dobDay}/${data.dobYear}. ${t('aboutPatient.errors.foundDuplicate.description2')}`,
          closeButtonText: t('aboutPatient.errors.foundDuplicate.cancel'),
          handleClose: () => setErrorDialog(undefined),
          handleContinue: () => confirmDuplicate(foundDuplicate, data.reasonForVisit),
        });
      } else {
        // merging form fields and the patientInfo state
        data = {
          ...patientInfo,
          ...data,
        };
        setLoading(true);
        // Store DOB in yyyy-mm-dd format for backend validation
        const dateOfBirth = isoStringFromDateComponents({
          year: data.dobYear ?? '',
          month: data.dobMonth ?? '',
          day: data.dobDay ?? '',
        });
        data.dateOfBirth = dateOfBirth || 'Unknown';
        data.id = data.id === 'new-patient' ? undefined : data.id;

        setPatientInfo(data as PatientInfoInProgress);

        setLoading(false);
        navigateInFlow('review');
      }
    },
    [confirmDuplicate, navigateInFlow, patientInfo, patients, setPatientInfo, t]
  );
  useBeforeUnload(() => {
    setPatientInfo({
      ...patientInfo,
      ...(formValuesCopy as PatientInformation),
      // 'new-patient' apparently isn't getting into form values
      id: patientInfo?.id ?? formValuesCopy?.id ?? 'new-patient',
    });
  });

  const onFormValuesChange = useCallback((formValues: FieldValues): void => {
    setFormValuesCopy({
      ...formValues,
    });
  }, []);
  return (
    <PageContainer title={t('aboutPatient.title')} description={t('aboutPatient.subtitle')}>
      {patientInfo && !patientInfo?.newPatient && (
        <PatientInformationKnownPatientFieldsDisplay
          patientInfo={patientInfo}
          unconfirmedDateOfBirth={unconfirmedDateOfBirth}
          selectPatientPageUrl={selectPatientPageUrl}
        />
      )}
      <PageForm
        formElements={formElements}
        controlButtons={{
          loading: loading,
          submitLabel: t('general.button.continue'),
          onBack: () => {
            // this won't work if browser back button is used but is better than nothing
            setPatientInfo({
              ...patientInfo,
              ...(formValuesCopy as PatientInformation),
              // 'new-patient' apparently isn't getting into form values
              id: patientInfo?.id ?? formValuesCopy?.id ?? 'new-patient',
            });
            navigate(-1);
          },
        }}
        onSubmit={onSubmit}
        onFormValuesChange={onFormValuesChange}
      />
      <ErrorDialog
        open={!!errorDialog}
        title={errorDialog?.title || ''}
        description={errorDialog?.description || ''}
        actionButtonText={t('aboutPatient.actionButtonText')}
        closeButtonText={errorDialog?.closeButtonText || ''}
        handleClose={errorDialog?.handleClose}
        handleContinue={errorDialog?.handleContinue}
      />
    </PageContainer>
  );
};

export default PatientInformation;

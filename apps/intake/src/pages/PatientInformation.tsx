import { useQuery } from '@tanstack/react-query';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useBeforeUnload, useNavigate, useParams } from 'react-router-dom';
import api from 'src/api/ottehrApi';
import { PaperworkContext, usePaperworkContext } from 'src/features/paperwork/context';
import PagedQuestionnaire from 'src/features/paperwork/PagedQuestionnaire';
import { useUCZambdaClient } from 'src/hooks/useUCZambdaClient';
import {
  flattenIntakeQuestionnaireItems,
  getDateComponentsFromISOString,
  PatientInfo,
  QuestionnaireFormFields,
} from 'utils';
import { bookingBasePath } from '../App';
import { PageContainer } from '../components';
import { ErrorDialog } from '../components/ErrorDialog';
import { PatientInformationKnownPatientFieldsDisplay } from '../features/patients';
import { useNavigateInFlow } from '../hooks/useNavigateInFlow';
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

export const PatientInfoCollection: FC = () => {
  const zambdaClient = useUCZambdaClient({ tokenless: true });
  const navigate = useNavigate();

  const { slotId } = useParams<{ slotId: string }>();
  const { patientInfo } = useBookingContext();
  const {
    data: questionnaireData,
    isLoading,
    isSuccess,
  } = useQuery({
    queryKey: ['get-employees', { zambdaClient }],
    queryFn: async () => {
      if (!zambdaClient) throw new Error('Zambda client not initialized');
      const response = await api.getQuestionnaire(
        {
          slotId: slotId,
          patientId: patientInfo?.id,
        },
        zambdaClient
      );
      return response;
    },
    enabled: Boolean(zambdaClient && slotId),
  });

  const { allItems, questionnaireResponse } = questionnaireData || {};

  const pages = useMemo(() => {
    return (allItems ?? []).filter((item) => {
      return item.linkId;
    });
  }, [allItems]);

  const outletContext: PaperworkContext = useMemo(() => {
    return {
      appointment: undefined,
      paperwork: [], // todo
      paperworkInProgress: {}, // todo
      pageItems: allItems || [],
      allItems: flattenIntakeQuestionnaireItems(allItems ?? []),
      pages,
      questionnaireResponse,
      patient: undefined,
      updateTimestamp: undefined,
      saveButtonDisabled: false,
      cardsAreLoading: false,
      paymentMethods: [],
      paymentMethodStateInitializing: false,
      stripeSetupData: undefined,
      refetchPaymentMethods: () => {
        throw new Error('Function not implemented.');
      },
      setSaveButtonDisabled: (_newVal: boolean): void => {
        // todo
      },
      findAnswerWithLinkId: (_linkId: string): QuestionnaireResponseItem | undefined => {
        // todo
        return undefined;
      },
    };
  }, [allItems, pages, questionnaireResponse]);

  useEffect(() => {
    if (isSuccess) {
      navigate('form');
    }
  }, [isSuccess, navigate]);

  console.log('isLoading', isLoading);
  // todo: render something else when loading, only show outlet when loaded

  return <Outlet context={{ ...outletContext }} />;
};

const PatientInformation = (): JSX.Element => {
  const navigateInFlow = useNavigateInFlow();
  const [errorDialog, setErrorDialog] = useState<ErrorDialogConfig | undefined>(undefined);
  // const navigate = useNavigate();
  const { t } = useTranslation();

  const { slotId } = useParams<{ slotId: string }>();

  const { patients, patientInfo, unconfirmedDateOfBirth, setPatientInfo } = useBookingContext();
  const selectPatientPageUrl = `${bookingBasePath}/${slotId}/patients`;

  const { allItems, pages } = usePaperworkContext();

  // we assume a single-page questionnaire for now
  const pageId = pages?.[0]?.linkId;

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
        authorizedNonLegalGuardians: patient?.authorizedNonLegalGuardians,
      });
    },
    [setPatientInfo]
  );

  const onSubmit = useCallback(
    async (data: QuestionnaireFormFields): Promise<void> => {
      console.log('Submitting Patient Information data:', data);
      /*let foundDuplicate: PatientInfo | undefined;
      // check if a patient with the same data already exists for this user
      let idx = patients.length - 1;
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
        // Store DOB in yyyy-mm-dd format for backend validation
        const dateOfBirth = isoStringFromDateComponents({
          year: data.dobYear ?? '',
          month: data.dobMonth ?? '',
          day: data.dobDay ?? '',
        });
        data.dateOfBirth = dateOfBirth || 'Unknown';
        data.id = data.id === 'new-patient' ? undefined : data.id;
        data.authorizedNonLegalGuardians = data.authorizedNonLegalGuardians ?? patientInfo?.authorizedNonLegalGuardians;

        setPatientInfo(data as PatientInfoInProgress);
        navigateInFlow('review');
      }*/
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirmDuplicate, navigateInFlow, patientInfo, patients, setPatientInfo, t]
  );
  useBeforeUnload(() => {
    // store the state of the QR
    console.log('save your data now!');
  });

  const controlButtons = useMemo(
    () => ({
      backButton: false, // this is assumed to be a 1-page Q for now
      loading: false, // todo
    }),
    []
  );

  return (
    <PageContainer title={t('aboutPatient.title')} description={t('aboutPatient.subtitle')}>
      {patientInfo && !patientInfo?.newPatient && (
        <PatientInformationKnownPatientFieldsDisplay
          patientInfo={patientInfo}
          unconfirmedDateOfBirth={unconfirmedDateOfBirth}
          selectPatientPageUrl={selectPatientPageUrl}
        />
      )}
      {pageId && (
        <PagedQuestionnaire
          onSubmit={onSubmit}
          pageId={pageId}
          options={{ controlButtons }}
          items={allItems || []}
          defaultValues={{}}
          isSaving={false}
          saveProgress={(data) => {
            console.log('saving data', data);
          }}
        />
      )}
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

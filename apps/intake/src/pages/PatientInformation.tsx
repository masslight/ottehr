import { CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import api from 'src/api/ottehrApi';
import { PaperworkContext, usePaperworkContext } from 'src/features/paperwork/context';
import PagedQuestionnaire from 'src/features/paperwork/PagedQuestionnaire';
import { useUCZambdaClient } from 'src/hooks/useUCZambdaClient';
import {
  BOOKING_CONFIG,
  convertQRItemToLinkIdMap,
  convertQuestionnaireItemToQRLinkIdMap,
  mdyStringFromISOString,
  PatientInfo,
  QuestionnaireFormFields,
} from 'utils';
import { bookingBasePath, intakeFlowPageRoute } from '../App';
import { PageContainer } from '../components';
import { ErrorDialog } from '../components/ErrorDialog';
import { PatientInformationKnownPatientFieldsDisplay } from '../features/patients';
import { PROGRESS_STORAGE_KEY, useBookingContext } from './BookingHome';

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
  const { t } = useTranslation();
  const [saveButtonDisabled, setSaveButtonDisabled] = useState<boolean>(false);

  const { slotId } = useParams<{ slotId: string }>();
  const bookingContext = useBookingContext();
  const { patientInfo } = bookingContext;
  const {
    data: questionnaireData,
    isLoading,
    isRefetching,
    isSuccess,
  } = useQuery({
    queryKey: ['get-booking-questionnaire', { zambdaClient }],
    queryFn: async () => {
      if (!zambdaClient) throw new Error('Zambda client not initialized');
      if (!slotId) throw new Error('slotId is required');
      const response = await api.getQuestionnaire(
        {
          slotId: slotId,
          patientId: patientInfo?.id === 'new-patient' ? undefined : patientInfo?.id,
        },
        zambdaClient
      );
      return response;
    },
    enabled: Boolean(zambdaClient && slotId),
  });

  const { allItems, questionnaireResponse: prepopulatedQuestionnaire } = questionnaireData || {};

  const pages = useMemo(() => {
    return (allItems ?? []).filter((item) => {
      return item.linkId;
    });
  }, [allItems]);

  // we assume a single-page questionnaire for now
  const currentPageIndex = 0;

  const { contextItems, questionnaireResponse, defaultValues } = useMemo(() => {
    const contextItems = allItems?.[currentPageIndex]?.item ?? [];
    const currentPageEntries = prepopulatedQuestionnaire?.item?.[currentPageIndex]?.item;

    let defaultValues: { [key: string]: QuestionnaireResponseItem } =
      convertQuestionnaireItemToQRLinkIdMap(contextItems);

    if (currentPageEntries) {
      defaultValues = convertQRItemToLinkIdMap(currentPageEntries);
    }

    return {
      contextItems,
      questionnaireResponse: prepopulatedQuestionnaire,
      defaultValues,
    };
  }, [allItems, currentPageIndex, prepopulatedQuestionnaire]);
  const currentPageId = allItems?.[currentPageIndex]?.linkId;

  const outletContext: PaperworkContext = useMemo(() => {
    return {
      paperwork: [], // todo
      paperworkInProgress: currentPageId ? { [currentPageId]: defaultValues } : {},
      pageItems: allItems || [],
      allItems: contextItems,
      pages,
      questionnaireResponse,
      saveButtonDisabled,
      setSaveButtonDisabled,
      findAnswerWithLinkId: (_linkId: string): QuestionnaireResponseItem | undefined => {
        // todo: can this be removed from the context as well?
        return undefined;
      },
      // things we don't need and shouldn't be on the base context
      appointment: undefined,
      patient: undefined,
      updateTimestamp: undefined,
      cardsAreLoading: false,
      paymentMethods: [],
      paymentMethodStateInitializing: false,
      stripeSetupData: undefined,
      refetchPaymentMethods: () => {
        throw new Error('Function not implemented.');
      },
    };
  }, [allItems, contextItems, currentPageId, defaultValues, pages, questionnaireResponse, saveButtonDisabled]);

  useEffect(() => {
    if (isSuccess) {
      navigate('form');
    }
  }, [isSuccess, navigate]);

  return (
    <PageContainer title={t('aboutPatient.title')} description={t('aboutPatient.subtitle')}>
      {isLoading || isRefetching ? <CircularProgress /> : <Outlet context={{ ...outletContext, ...bookingContext }} />}
    </PageContainer>
  );
};

// export const PROGRESS_STORAGE_KEY = 'patient-information-progress';
const PatientInformation = (): JSX.Element => {
  const [errorDialog, setErrorDialog] = useState<ErrorDialogConfig | undefined>(undefined);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { slotId } = useParams<{ slotId: string }>();

  const { patients, patientInfo, unconfirmedDateOfBirth, setPatientInfo } = useBookingContext();
  const selectPatientPageUrl = `${bookingBasePath}/${slotId}/patients`;

  const { allItems, pages, paperworkInProgress } = usePaperworkContext();

  // we assume a single-page questionnaire for now
  const pageId = pages?.[0]?.linkId;

  const confirmDuplicate = useCallback(
    (patient: PatientInfo | undefined, reasonForVisit: string | undefined): void => {
      setErrorDialog(undefined);
      // reload page with existing patient data
      setPatientInfo({
        id: patient?.id,
        newPatient: false,
        firstName: patient?.firstName,
        lastName: patient?.lastName,
        dateOfBirth: patient?.dateOfBirth,
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
      // console.log('Submitting Patient Information data:', data);
      const postedPatientInfo: PatientInfo = BOOKING_CONFIG.mapBookingQRItemToPatientInfo(Object.values(data));
      let foundDuplicate: PatientInfo | undefined;
      // check if a patient with the same data already exists for this user
      let idx = patients?.length ? patients.length - 1 : -1;
      if (
        patientInfo?.newPatient &&
        postedPatientInfo.firstName &&
        postedPatientInfo.lastName &&
        postedPatientInfo.dateOfBirth
      ) {
        while (!foundDuplicate && idx >= 0) {
          const firstNameMatch =
            patients[idx].firstName?.toLocaleLowerCase() === postedPatientInfo.firstName?.toLocaleLowerCase();
          const lastNameMatch =
            patients[idx].lastName?.toLocaleLowerCase() === postedPatientInfo.lastName?.toLocaleLowerCase();
          const dobMatch = patients[idx].dateOfBirth === postedPatientInfo.dateOfBirth && postedPatientInfo.dateOfBirth;
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
           ${postedPatientInfo?.dateOfBirth ? mdyStringFromISOString(postedPatientInfo?.dateOfBirth) : ''}. ${t(
             'aboutPatient.errors.foundDuplicate.description2'
           )}`,
          closeButtonText: t('aboutPatient.errors.foundDuplicate.cancel'),
          handleClose: () => setErrorDialog(undefined),
          handleContinue: () => confirmDuplicate(foundDuplicate, postedPatientInfo.reasonForVisit),
        });
      } else {
        // merging form fields and the patientInfo state
        console.log('No duplicate found, proceeding with patient info:', postedPatientInfo);
        const payload: PatientInfo = {
          ...patientInfo,
          ...postedPatientInfo,
        };
        payload.id = payload.id === 'new-patient' ? undefined : payload.id;

        // todo: we are duplicating state in booking context and session storage here
        // this data shouldn't be needed in booking context
        setPatientInfo(payload);
        sessionStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ [pageId]: data }));
        navigate(window.location.pathname.replace('patient-information/form', 'review'));
      }
    },

    [confirmDuplicate, navigate, pageId, patientInfo, patients, setPatientInfo, t]
  );

  const defaultValues = (() => {
    if (!pageId) return {};
    const storedValueString = sessionStorage.getItem(PROGRESS_STORAGE_KEY);
    let defaults = paperworkInProgress[pageId] || {};
    if (storedValueString) {
      try {
        const storedValues = JSON.parse(storedValueString)[pageId];
        defaults = storedValues;
      } catch (error) {
        console.error('Error parsing stored patient information:', error);
      }
    }
    return defaults;
  })();

  // console.log('defaultValues', defaultValues);
  // console.log('patientInfo', patientInfo);

  return (
    <>
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
          options={{
            controlButtons: {
              backButton: true,
              loading: false,
              onBack: () => {
                if (!slotId) {
                  navigate(intakeFlowPageRoute.Homepage.path);
                  return;
                }
                navigate(intakeFlowPageRoute.ChoosePatient.path.replace(':slotId', slotId));
              },
            },
          }}
          items={allItems || []}
          defaultValues={defaultValues}
          isSaving={false}
          saveProgress={(data) => {
            if (pageId && data) {
              sessionStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ [pageId]: data }));
            }
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
    </>
  );
};

export default PatientInformation;

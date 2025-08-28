import { Medication } from 'fhir/r4b';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MedicationWithTypeDTO, useMedicationHistory } from 'src/features/css-module/hooks/useMedicationHistory';
import { useApiClients } from 'src/hooks/useAppClients';
import { useAppointmentData } from 'src/telemed';
import { ERX, ERXStatus } from 'src/telemed/features/appointment/ERX';
import {
  ExtendedMedicationDataForResponse,
  getMedicationName,
  MedicationData,
  medicationExtendedToMedicationData,
  MedicationInteractions,
  MedicationOrderStatusesType,
  MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM,
  UpdateMedicationOrderInput,
} from 'utils';
import { OrderFieldsSelectsOptions, useFieldsSelectsOptions } from '../../../hooks/useGetFieldOptions';
import { useMedicationManagement } from '../../../hooks/useMedicationManagement';
import { useReactNavigationBlocker } from '../../../hooks/useReactNavigationBlocker';
import { getEditOrderUrl } from '../../../routing/helpers';
import { ROUTER_PATH, routesCSS } from '../../../routing/routesCSS';
import { CSSModal } from '../../CSSModal';
import { InteractionAlertsDialog } from '../InteractionAlertsDialog';
import { interactionsSummary } from '../util';
import { fieldsConfig, MedicationOrderType } from './fieldsConfig';
import { InteractionsMessage, MedicationCardView } from './MedicationCardView';
import {
  ConfirmSaveModalConfig,
  findPrescriptionsForInteractions,
  getConfirmSaveModalConfigs,
  getFieldType,
  getInitialAutoFilledFields,
  getSaveButtonText,
  interactionsUnresolved,
  isUnsavedMedicationData,
  medicationInteractionsFromErxResponse,
  validateAllMedicationFields,
} from './utils';

interface InteractionsCheckState {
  status: 'in-progress' | 'done' | 'error';
  medicationId?: string;
  medicationName?: string;
  interactions?: MedicationInteractions;
}

const INTERACTIONS_CHECK_STATE_ERROR: InteractionsCheckState = {
  status: 'error',
  interactions: undefined,
};

export const EditableMedicationCard: React.FC<{
  medication?: ExtendedMedicationDataForResponse;
  type: MedicationOrderType;
}> = ({ medication, type: typeFromProps }) => {
  const [isOrderUpdating, setIsOrderUpdating] = useState<boolean>(false);
  const { id: appointmentId } = useParams();
  const navigate = useNavigate();
  const autoFilledFieldsRef = useRef<Partial<MedicationData>>({});
  const [isConfirmSaveModalOpen, setIsConfirmSaveModalOpen] = useState(false);
  const confirmedMedicationUpdateRequestRef = useRef<Partial<UpdateMedicationOrderInput>>({});
  const [confirmationModalConfig, setConfirmationModalConfig] = useState<ConfirmSaveModalConfig | null>(null);
  const [isReasonSelected, setIsReasonSelected] = useState(true);
  const { mappedData, resources } = useAppointmentData();
  const selectsOptions = useFieldsSelectsOptions();
  const [erxStatus, setERXStatus] = useState(ERXStatus.LOADING);
  const [interactionsCheckState, setInteractionsCheckState] = useState<InteractionsCheckState>({ status: 'done' });
  const { oystehr } = useApiClients();
  const [showInteractionAlerts, setShowInteractionAlerts] = useState(false);
  const [erxEnabled, setErxEnabled] = useState(false);
  const { isLoading: isMedicationHistoryLoading, medicationHistory, refetchHistory } = useMedicationHistory();

  // There are dynamic form config which depend on what button was clicked:
  // - If "administered" was clicked, then "dispense" form config should be used
  // - If "not-administered" was clicked, then "dispense-not-administered" form config will be used
  // See: https://github.com/masslight/ottehr/issues/2799
  const typeRef = useRef<MedicationOrderType>(typeFromProps);

  const [localValues, setLocalValues] = useState<Partial<MedicationData>>(
    medication
      ? {
          ...medicationExtendedToMedicationData(medication),
          ...getInitialAutoFilledFields(medication, autoFilledFieldsRef),
        }
      : {}
  );

  const { updateMedication, getMedicationFieldValue, getIsMedicationEditable } = useMedicationManagement();
  const [currentStatus, setCurrentStatus] = useState<MedicationOrderStatusesType>(medication?.status || 'pending');
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const isSavedRef = useRef(false);

  const handleStatusChange = async (newStatus: MedicationOrderStatusesType): Promise<void> => {
    isSavedRef.current = false;
    setCurrentStatus(newStatus);
  };

  const handleFieldValueChange = <Field extends keyof MedicationData>(
    field: Field,
    value: MedicationData[Field]
  ): void => {
    isSavedRef.current = false;
    if (field === 'dose') {
      setLocalValues((prev) => ({ ...prev, [field]: Number(value) }));
    } else {
      setLocalValues((prev) => ({ ...prev, [field]: value }));
    }
    if (field === 'medicationId' && value !== '' && (typeFromProps === 'order-new' || typeFromProps === 'order-edit')) {
      setErxEnabled(true);
    }
  };

  const updateOrCreateOrder = async (updatedRequestInput: UpdateMedicationOrderInput): Promise<void> => {
    // set type dynamically after user click corresponding button to use correct form config https://github.com/masslight/ottehr/issues/2799
    if (updatedRequestInput.newStatus === 'administered' || updatedRequestInput.newStatus === 'administered-partly') {
      typeRef.current = 'dispense';
    } else if (updatedRequestInput.newStatus === 'administered-not') {
      typeRef.current = 'dispense-not-administered';
    }

    const { isValid, missingFields } = validateAllMedicationFields(
      localValues,
      medication,
      typeRef.current,
      setFieldErrors
    );

    // we check that have not empty required fields
    if (!isValid) {
      setMissingFields(missingFields);
      setIsModalOpen(true);
      setShowErrors(true);
      return;
    }

    /**
     * Using ref to store data that will be:
     * 1. Displayed in confirmation modal for user review
     * 2. May be changed during confirmation process (the reason will be specified)
     * 3. Used in save callback after user confirmation
     *
     * This approach ensures that the exact data shown to and confirmed by the user
     * will be sent to the endpoint and saved.
     * We can't use async useState value here, because we should save value synchronously after user confirmation.
     */

    confirmedMedicationUpdateRequestRef.current = {
      ...(updatedRequestInput.orderId ? { orderId: updatedRequestInput.orderId } : {}),

      ...(updatedRequestInput.orderId && updatedRequestInput.newStatus && updatedRequestInput.newStatus !== 'pending'
        ? { newStatus: updatedRequestInput.newStatus }
        : {}),

      orderData: {
        ...(medication ? medicationExtendedToMedicationData(medication) : {}),
        ...updatedRequestInput.orderData,
        patient: resources.patient?.id || '',
        encounterId: resources.encounter?.id || '',
      } as MedicationData,
      interactions: interactionsCheckState.interactions,
    };

    // for order creating or editing we don't have to show confirmation modal, so we can save it immediately
    if (typeRef.current === 'order-new' || typeRef.current === 'order-edit') {
      await handleConfirmSave(confirmedMedicationUpdateRequestRef);
      return;
    }

    if (
      (typeRef.current === 'dispense' || typeRef.current === 'dispense-not-administered') &&
      (updatedRequestInput.newStatus === 'administered' ||
        updatedRequestInput.newStatus === 'administered-partly' ||
        updatedRequestInput.newStatus === 'administered-not')
    ) {
      const medicationName = medication?.medicationName ?? '';

      const routeName =
        selectsOptions.route.options.find((option) => option.value === updatedRequestInput?.orderData?.route)?.label ||
        '';

      const confirmSaveModalConfigs = getConfirmSaveModalConfigs({
        medicationName,
        routeName,
        patientName: mappedData.patientName || '',
        newStatus: updatedRequestInput.newStatus,
        updateRequestInputRef: confirmedMedicationUpdateRequestRef,
        setIsReasonSelected,
      });

      setConfirmationModalConfig(confirmSaveModalConfigs[updatedRequestInput.newStatus] as ConfirmSaveModalConfig);
      setIsConfirmSaveModalOpen(true);
    }
  };

  const handleConfirmSave = async (
    medicationUpdateRequestInputRefRef: React.MutableRefObject<UpdateMedicationOrderInput>
  ): Promise<void> => {
    if (!medicationUpdateRequestInputRefRef.current.orderData) return;

    // modal window on close will clear the medicationUpdateRequest ref,
    // so we need to save the new status to make it possible to set
    // the correct state if the user closes the modal during the updating
    const newStatus = medicationUpdateRequestInputRefRef.current?.newStatus;

    try {
      setIsOrderUpdating(true);

      const response = await updateMedication(medicationUpdateRequestInputRefRef.current);
      isSavedRef.current = true;

      // update saved status in the local state
      if (newStatus) {
        await handleStatusChange(newStatus);
      }

      if (typeRef.current === 'order-new') {
        if (response?.id) {
          navigate(getEditOrderUrl(appointmentId!, response.id));
        }
      }

      void refetchHistory();
    } catch (error) {
      console.error(error);
    } finally {
      setIsOrderUpdating(false);
      setShowErrors(false);
      setLocalValues({});
      setFieldErrors({});
      setIsConfirmSaveModalOpen(false);
      medicationUpdateRequestInputRefRef.current = {};
      setConfirmationModalConfig(null);
    }
  };

  const getFieldValue = useCallback(
    <Field extends keyof MedicationData>(field: Field, type = 'text'): MedicationData[Field] | '' | undefined => {
      return localValues[field] ?? (medication ? getMedicationFieldValue(medication || {}, field, type) : undefined);
    },
    [localValues, medication, getMedicationFieldValue]
  );

  const isUnsavedData = isUnsavedMedicationData(
    medication,
    localValues,
    currentStatus,
    getMedicationFieldValue,
    autoFilledFieldsRef,
    interactionsCheckState.interactions
  );

  const isEditOrderPage = location.pathname.includes(
    routesCSS[ROUTER_PATH.IN_HOUSE_ORDER_EDIT].activeCheckPath as string
  );

  const isOrderPage = location.pathname.includes(routesCSS[ROUTER_PATH.IN_HOUSE_ORDER_NEW].activeCheckPath as string);
  const shouldBlockNavigation = (): boolean => !isSavedRef.current && (isEditOrderPage || isOrderPage) && isUnsavedData;
  const { ConfirmationModal: ConfirmationModalForLeavePage } = useReactNavigationBlocker(shouldBlockNavigation);
  const saveButtonText = getSaveButtonText(
    medication?.status || 'pending',
    typeRef.current,
    currentStatus,
    isUnsavedData
  );

  const hasNotEditableStatus = currentStatus !== 'pending';
  const isCreatingOrEditingOrder = typeRef.current === 'order-new' || typeRef.current === 'order-edit';
  const isCreatingOrEditingOrderAndNothingToSave = isCreatingOrEditingOrder && !isUnsavedData;
  const isErxLoading = erxEnabled && erxStatus === ERXStatus.LOADING;
  const hasInprogressOrUnresolvedInteractions =
    interactionsCheckState.status === 'in-progress' || interactionsUnresolved(interactionsCheckState.interactions);

  const isCardSaveButtonDisabled =
    isOrderUpdating ||
    hasNotEditableStatus ||
    isCreatingOrEditingOrderAndNothingToSave ||
    isErxLoading ||
    hasInprogressOrUnresolvedInteractions;
  const isModalSaveButtonDisabled =
    confirmedMedicationUpdateRequestRef.current.newStatus === 'administered' ? false : isReasonSelected;

  useEffect(() => {
    if (typeRef.current === 'order-new') {
      Object.entries(fieldsConfig[typeRef.current]).map(([field]) => {
        const defaultOption = selectsOptions[field as keyof OrderFieldsSelectsOptions]?.defaultOption?.value;
        if (defaultOption) {
          const value = getFieldValue(field as keyof MedicationData);
          if (!value || (typeof value === 'number' && value < 0))
            setLocalValues((prev) => ({ ...prev, [field]: defaultOption }));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultProviderValue = selectsOptions.providerId.defaultOption?.value;
  const currentProviderValue = getFieldValue('providerId');
  const wasProvidedByFieldTouched = useRef(false);
  if (currentProviderValue) wasProvidedByFieldTouched.current = true;
  useEffect(() => {
    if (!wasProvidedByFieldTouched.current && !currentProviderValue && defaultProviderValue) {
      setLocalValues((prev) => ({ ...prev, providerId: defaultProviderValue }));
    }
  }, [defaultProviderValue, currentProviderValue]);

  const runInteractionsCheck = useCallback(
    async (medicationId: string, medicationHistory: MedicationWithTypeDTO[]) => {
      if (oystehr == null) {
        setInteractionsCheckState(INTERACTIONS_CHECK_STATE_ERROR);
        console.error('oystehr is missing');
        return;
      }
      const patientId = resources.patient?.id;
      if (patientId == null) {
        setInteractionsCheckState(INTERACTIONS_CHECK_STATE_ERROR);
        console.error('patientId is missing');
        return;
      }
      setInteractionsCheckState({
        status: 'in-progress',
        medicationId: medicationId,
      });
      try {
        const medication = await oystehr.fhir.get<Medication>({
          resourceType: 'Medication',
          id: medicationId,
        });
        const interactionsCheckResponse = await oystehr.erx.checkPrecheckInteractions({
          patientId,
          drugId:
            medication.code?.coding?.find((coding) => coding.system === MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM)
              ?.code ?? '',
        });
        const prescriptions = await findPrescriptionsForInteractions(
          resources.patient?.id,
          interactionsCheckResponse,
          oystehr
        );
        setInteractionsCheckState({
          status: 'done',
          interactions: medicationInteractionsFromErxResponse(
            interactionsCheckResponse,
            medicationHistory,
            prescriptions
          ),
          medicationId: medicationId,
          medicationName: getMedicationName(medication),
        });
      } catch (e) {
        setInteractionsCheckState(INTERACTIONS_CHECK_STATE_ERROR);
        console.error(e);
      }
    },
    [oystehr, resources.patient?.id]
  );

  const medicationHistoryJson = JSON.stringify(medicationHistory);
  useEffect(() => {
    const medicationId = localValues.medicationId;
    if (medicationId && erxStatus === ERXStatus.READY && !isMedicationHistoryLoading) {
      void runInteractionsCheck(medicationId, JSON.parse(medicationHistoryJson));
    }
  }, [localValues.medicationId, runInteractionsCheck, erxStatus, isMedicationHistoryLoading, medicationHistoryJson]);

  useEffect(() => {
    if (medication) {
      if (medication.interactions != null) {
        setInteractionsCheckState({
          status: 'done',
          interactions: medication.interactions,
          medicationId: medication.medicationId,
          medicationName: medication.medicationName,
        });
      } else {
        setInteractionsCheckState({
          status: 'error',
          medicationId: medication.medicationId,
          medicationName: medication.medicationName,
        });
      }
    }
  }, [medication]);

  const interactionsMessage: InteractionsMessage | undefined = useMemo(() => {
    if (
      (!localValues.medicationId && !medication) ||
      (erxEnabled && erxStatus === ERXStatus.READY && interactionsCheckState.medicationId !== localValues.medicationId)
    ) {
      return undefined;
    }
    if (
      (erxEnabled && erxStatus === ERXStatus.LOADING && (!medication || medication.id !== localValues.medicationId)) ||
      interactionsCheckState.status === 'in-progress' ||
      isMedicationHistoryLoading
    ) {
      return {
        style: 'loading',
        message: 'checking...',
      };
    } else if (erxStatus === ERXStatus.ERROR || interactionsCheckState.status === 'error') {
      return {
        style: 'warning',
        message: 'Drug-to-Drug and Drug-Allergy interaction check failed. Please review manually.',
      };
    } else if (interactionsCheckState.status === 'done') {
      if (
        interactionsCheckState.interactions &&
        (interactionsCheckState.interactions.drugInteractions.length > 0 ||
          interactionsCheckState.interactions.allergyInteractions.length > 0)
      ) {
        return {
          style: 'warning',
          message: interactionsSummary(interactionsCheckState.interactions),
        };
      }
      return {
        style: 'success',
        message: 'not found',
      };
    }
    return undefined;
  }, [erxEnabled, erxStatus, interactionsCheckState, localValues.medicationId, medication, isMedicationHistoryLoading]);

  return (
    <>
      <MedicationCardView
        isEditable={getIsMedicationEditable(typeRef.current, medication)}
        type={typeRef.current}
        onSave={updateOrCreateOrder}
        medication={medication}
        fieldsConfig={fieldsConfig[typeRef.current]}
        localValues={localValues}
        selectedStatus={currentStatus}
        isUpdating={isOrderUpdating}
        onFieldValueChange={handleFieldValueChange}
        onStatusSelect={handleStatusChange}
        getFieldValue={getFieldValue}
        showErrors={showErrors}
        fieldErrors={fieldErrors}
        getFieldType={getFieldType}
        saveButtonText={saveButtonText}
        isSaveButtonDisabled={isCardSaveButtonDisabled}
        selectsOptions={selectsOptions}
        interactionsMessage={interactionsMessage}
        onInteractionsMessageClick={() => {
          if (
            interactionsCheckState.status === 'done' &&
            interactionsCheckState.interactions &&
            (interactionsCheckState.interactions.drugInteractions.length > 0 ||
              interactionsCheckState.interactions.allergyInteractions.length > 0)
          ) {
            setShowInteractionAlerts(true);
          }
        }}
      />
      <CSSModal
        icon={null}
        color="error.main"
        open={isModalOpen}
        handleClose={() => setIsModalOpen(false)}
        title="Missing Required Fields"
        description={`Please fill in the following required fields: ${missingFields.join(', ')}`}
        handleConfirm={() => setIsModalOpen(false)}
        confirmText="OK"
        closeButtonText="Close"
      />
      {confirmationModalConfig ? (
        <CSSModal
          entity={confirmedMedicationUpdateRequestRef}
          showEntityPreview={false}
          disabled={isModalSaveButtonDisabled}
          open={isConfirmSaveModalOpen}
          handleClose={() => {
            setIsConfirmSaveModalOpen(false);
            confirmedMedicationUpdateRequestRef.current = {};
          }}
          handleConfirm={handleConfirmSave}
          description={''}
          {...confirmationModalConfig}
          ContentComponent={confirmationModalConfig.ContentComponent?.({}) as ReactElement}
        />
      ) : null}
      <ConfirmationModalForLeavePage />
      {showInteractionAlerts && interactionsCheckState.interactions ? (
        <InteractionAlertsDialog
          medicationName={interactionsCheckState.medicationName ?? medication?.medicationName ?? ''}
          interactions={interactionsCheckState.interactions}
          onCancel={() => setShowInteractionAlerts(false)}
          onContinue={(interactions: MedicationInteractions) => {
            setShowInteractionAlerts(false);
            setInteractionsCheckState({
              status: 'done',
              medicationId: localValues.medicationId,
              interactions,
            });
          }}
          readonly={typeFromProps !== 'order-new' && typeFromProps !== 'order-edit'}
        />
      ) : null}
      {(typeFromProps === 'order-new' || typeFromProps === 'order-edit') && erxEnabled ? (
        <ERX onStatusChanged={setERXStatus} showDefaultAlert={false} />
      ) : null}
    </>
  );
};

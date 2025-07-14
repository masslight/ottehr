import { Medication } from 'fhir/r4b';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMedicationHistory } from 'src/features/css-module/hooks/useMedicationHistory';
import { useApiClients } from 'src/hooks/useAppClients';
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
import { useAppointment } from '../../../hooks/useAppointment';
import { OrderFieldsSelectsOptions, useFieldsSelectsOptions } from '../../../hooks/useGetFieldOptions';
import { useMedicationManagement } from '../../../hooks/useMedicationManagement';
import { useReactNavigationBlocker } from '../../../hooks/useReactNavigationBlocker';
import { getEditOrderUrl } from '../../../routing/helpers';
import { ROUTER_PATH, routesCSS } from '../../../routing/routesCSS';
import { CSSModal } from '../../CSSModal';
import { InteractionAlertsDialog } from '../InteractionAlertsDialog';
import { fieldsConfig, MedicationOrderType } from './fieldsConfig';
import { MedicationCardView } from './MedicationCardView';
import {
  ConfirmSaveModalConfig,
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
  medicationName?: string;
  interactions?: MedicationInteractions;
}

const INTERACTIONS_CHECK_STATE_ERROR: InteractionsCheckState = {
  status: 'error',
  interactions: undefined,
};

const INTERACTIONS_CHECK_STATE_IN_PROGRESS: InteractionsCheckState = {
  status: 'in-progress',
  interactions: undefined,
};

export const EditableMedicationCard: React.FC<{
  medication?: ExtendedMedicationDataForResponse;
  type: MedicationOrderType;
}> = ({ medication, type: typeFromProps }) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const { id: appointmentId } = useParams();
  const navigate = useNavigate();
  const autoFilledFieldsRef = useRef<Partial<MedicationData>>({});
  const [isConfirmSaveModalOpen, setIsConfirmSaveModalOpen] = useState(false);
  const confirmedMedicationUpdateRequestRef = useRef<Partial<UpdateMedicationOrderInput>>({});
  const [confirmationModalConfig, setConfirmationModalConfig] = useState<ConfirmSaveModalConfig | null>(null);
  const { mappedData, resources } = useAppointment(appointmentId);
  const [isReasonSelected, setIsReasonSelected] = useState(true);
  const selectsOptions = useFieldsSelectsOptions();
  const [erxStatus, setERXStatus] = useState(ERXStatus.LOADING);
  const [interactionsCheckState, setInteractionsCheckState] = useState<InteractionsCheckState>({ status: 'done' });
  const { oystehr } = useApiClients();
  const [showInteractionAlerts, setShowInteractionAlerts] = useState(false);
  const [erxEnabled, setErxEnabled] = useState(false);

  const { refetchHistory } = useMedicationHistory();

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
  const [selectedStatus, setSelectedStatus] = useState<MedicationOrderStatusesType>(medication?.status || 'pending');
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const isSavedRef = useRef(false);

  const handleStatusSelect = async (newStatus: MedicationOrderStatusesType): Promise<void> => {
    isSavedRef.current = false;
    setSelectedStatus(newStatus);
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
    if (field === 'medicationId' && value !== '') {
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

    try {
      setIsUpdating(true);
      const response = await updateMedication(medicationUpdateRequestInputRefRef.current);
      isSavedRef.current = true;

      if (typeRef.current === 'order-new') {
        response?.id && navigate(getEditOrderUrl(appointmentId!, response.id));
        return;
      }

      // upd saved status in the local state
      medicationUpdateRequestInputRefRef.current?.newStatus &&
        void handleStatusSelect(medicationUpdateRequestInputRefRef.current.newStatus);

      void refetchHistory();
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
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
    selectedStatus,
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
    selectedStatus,
    isUnsavedData
  );
  const isCardSaveButtonDisabled =
    (typeRef.current !== 'dispense' && (isUpdating || !isUnsavedData)) ||
    (erxEnabled && erxStatus === ERXStatus.LOADING) ||
    interactionsCheckState.status === 'in-progress' ||
    interactionsUnresolved(interactionsCheckState.interactions);

  const isModalSaveButtonDisabled =
    confirmedMedicationUpdateRequestRef.current.newStatus === 'administered' ? false : isReasonSelected;

  useEffect(() => {
    if (typeRef.current === 'order-new') {
      Object.entries(fieldsConfig[typeRef.current]).map(([field]) => {
        const defaultOption = selectsOptions[field as keyof OrderFieldsSelectsOptions]?.defaultOption?.value;
        if (defaultOption) {
          const value = getFieldValue(field as keyof MedicationData);
          if (!value || value < 0) setLocalValues((prev) => ({ ...prev, [field]: defaultOption }));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runInteractionsCheck = useCallback(
    async (medicationId: string) => {
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
      setInteractionsCheckState(INTERACTIONS_CHECK_STATE_IN_PROGRESS);
      if (erxStatus === ERXStatus.LOADING) {
        return;
      }
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
        setInteractionsCheckState({
          status: 'done',
          interactions: medicationInteractionsFromErxResponse(interactionsCheckResponse),
          medicationName: getMedicationName(medication),
        });
      } catch (e) {
        setInteractionsCheckState(INTERACTIONS_CHECK_STATE_ERROR);
        console.error(e);
      }
    },
    [oystehr, resources.patient?.id, erxStatus]
  );

  useEffect(() => {
    const medicationId = localValues.medicationId;
    if (medicationId) {
      void runInteractionsCheck(medicationId);
    }
  }, [localValues.medicationId, runInteractionsCheck, erxStatus]);

  useEffect(() => {
    if (medication) {
      setInteractionsCheckState({
        status: 'done',
        interactions: medication.interactions,
      });
    }
  }, [medication]);

  const interactionsWarning = useMemo(() => {
    if (
      (!localValues.medicationId && !medication) ||
      (typeFromProps !== 'order-new' && typeFromProps !== 'order-edit')
    ) {
      return undefined;
    }
    if (
      (erxEnabled && erxStatus === ERXStatus.LOADING && (!medication || medication.id !== localValues.medicationId)) ||
      interactionsCheckState.status === 'in-progress'
    ) {
      return 'checking...';
    } else if (erxStatus === ERXStatus.ERROR || interactionsCheckState.status === 'error') {
      return 'Drug-to-Drug and Drug-Allergy interaction check failed. Please review manually.';
    } else if (interactionsCheckState.status === 'done') {
      const names: string[] = [];
      interactionsCheckState.interactions?.drugInteractions
        ?.flatMap((drugInteraction) => {
          return drugInteraction.drugs.map((drug) => drug.name);
        })
        ?.forEach((name) => names.push(name));
      if ((interactionsCheckState.interactions?.allergyInteractions?.length ?? 0) > 0) {
        names.push('Allergy');
      }
      if (names.length > 0) {
        return names.join(', ');
      }
    }
    return undefined;
  }, [erxEnabled, erxStatus, interactionsCheckState, localValues.medicationId, medication, typeFromProps]);

  return (
    <>
      <MedicationCardView
        isEditable={getIsMedicationEditable(typeRef.current, medication)}
        type={typeRef.current}
        onSave={updateOrCreateOrder}
        medication={medication}
        fieldsConfig={fieldsConfig[typeRef.current]}
        localValues={localValues}
        selectedStatus={selectedStatus}
        isUpdating={isUpdating}
        onFieldValueChange={handleFieldValueChange}
        onStatusSelect={handleStatusSelect}
        getFieldValue={getFieldValue}
        showErrors={showErrors}
        fieldErrors={fieldErrors}
        getFieldType={getFieldType}
        saveButtonText={saveButtonText}
        isSaveButtonDisabled={isCardSaveButtonDisabled}
        selectsOptions={selectsOptions}
        interactionsWarning={interactionsWarning}
        onInteractionsWarningClick={() => {
          if (interactionsCheckState.status === 'done') {
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
        />
      ) : null}
      <ConfirmationModalForLeavePage />
      {showInteractionAlerts ? (
        <InteractionAlertsDialog
          medicationName={interactionsCheckState.medicationName ?? medication?.medicationName ?? ''}
          interactions={interactionsCheckState.interactions ?? {}}
          onCancel={() => setShowInteractionAlerts(false)}
          onContinue={(interactions: MedicationInteractions) => {
            setShowInteractionAlerts(false);
            setInteractionsCheckState({
              status: 'done',
              interactions,
            });
          }}
        />
      ) : null}
      {(typeFromProps === 'order-new' || typeFromProps === 'order-edit') && erxEnabled ? (
        <ERX onStatusChanged={setERXStatus} showDefaultAlert={false} />
      ) : null}
    </>
  );
};

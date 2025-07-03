import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMedicationHistory } from 'src/features/css-module/hooks/useMedicationHistory';
import {
  ExtendedMedicationDataForResponse,
  MedicationData,
  medicationExtendedToMedicationData,
  MedicationOrderStatusesType,
  UpdateMedicationOrderInput,
} from 'utils';
import { useAppointment } from '../../../hooks/useAppointment';
import { OrderFieldsSelectsOptions, useFieldsSelectsOptions } from '../../../hooks/useGetFieldOptions';
import { useMedicationManagement } from '../../../hooks/useMedicationManagement';
import { useReactNavigationBlocker } from '../../../hooks/useReactNavigationBlocker';
import { getEditOrderUrl } from '../../../routing/helpers';
import { ROUTER_PATH, routesCSS } from '../../../routing/routesCSS';
import { CSSModal } from '../../CSSModal';
import { fieldsConfig, MedicationOrderType } from './fieldsConfig';
import { MedicationCardView } from './MedicationCardView';
import {
  ConfirmSaveModalConfig,
  getConfirmSaveModalConfigs,
  getFieldType,
  getInitialAutoFilledFields,
  getSaveButtonText,
  isUnsavedMedicationData,
  validateAllMedicationFields,
} from './utils';

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
    autoFilledFieldsRef
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
  const isCardSaveButtonDisabled = typeRef.current !== 'dispense' && (isUpdating || !isUnsavedData);

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
    </>
  );
};

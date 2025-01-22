import React, { useState, useRef } from 'react';
import { MedicationCardView } from './MedicationCardView';
import { useMedicationManagement } from '../../../hooks/useMedicationManagement';
import { getEditOrderUrl } from '../../../routing/helpers';
import { useNavigate, useParams } from 'react-router-dom';
import { CSSModal } from '../../CSSModal';
import { useReactNavigationBlocker } from '../../../hooks/useReactNavigationBlocker';
import { ROUTER_PATH, routesCSS } from '../../../routing/routesCSS';
import { useAppointment } from '../../../hooks/useAppointment';
import { fieldsConfig, MedicationOrderType } from './fieldsConfig';
import {
  ConfirmSaveModalConfig,
  getConfirmSaveModalConfigs,
  getFieldType,
  getInitialAutoFilledFields,
  getSaveButtonText,
  isUnsavedMedicationData,
  validateAllMedicationFields,
} from './utils';
import {
  ExtendedMedicationDataForResponse,
  MedicationData,
  medicationExtendedToMedicationData,
  MedicationOrderStatusesType,
  UpdateMedicationOrderInput,
} from 'utils';
import { useFieldsSelectsOptions } from '../../../hooks/useGetFieldOptions';

export const EditableMedicationCard: React.FC<{
  medication?: ExtendedMedicationDataForResponse;
  type: MedicationOrderType;
}> = ({ medication, type }) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const { id: encounterId } = useParams();
  const navigate = useNavigate();
  const autoFilledFieldsRef = useRef<Partial<MedicationData>>({});
  const [isConfirmSaveModalOpen, setIsConfirmSaveModalOpen] = useState(false);
  const confirmedMedicationUpdateRequestRef = useRef<Partial<UpdateMedicationOrderInput>>({});
  const [confirmationModalConfig, setConfirmationModalConfig] = useState<ConfirmSaveModalConfig | null>(null);
  const { processedData, sourceData } = useAppointment(encounterId);
  const [isReasonSelected, setIsReasonSelected] = useState(true);
  const selectsOptions = useFieldsSelectsOptions();

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
    const { isValid, missingFields } = validateAllMedicationFields(localValues, medication, type, setFieldErrors);

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
     * We can't use async useState value here, becuse we should save value synchronously after user confirmation.
     */
    confirmedMedicationUpdateRequestRef.current = {
      ...(updatedRequestInput.orderId ? { orderId: updatedRequestInput.orderId } : {}),

      ...(updatedRequestInput.orderId && updatedRequestInput.newStatus && updatedRequestInput.newStatus !== 'pending'
        ? { newStatus: updatedRequestInput.newStatus }
        : {}),

      orderData: {
        ...(medication ? medicationExtendedToMedicationData(medication) : {}),
        ...updatedRequestInput.orderData,
        patient: sourceData?.patient?.id || '',
        encounter: encounterId,
      } as MedicationData,
    };

    // for order creating or editing we don't have to show confirmation modal, so we can save it immediately
    if (type === 'order-new' || type === 'order-edit') {
      await handleConfirmSave(confirmedMedicationUpdateRequestRef);
      return;
    }

    if (
      type === 'dispense' &&
      (updatedRequestInput.newStatus === 'administered' ||
        updatedRequestInput.newStatus === 'administered-partly' ||
        updatedRequestInput.newStatus === 'administered-not')
    ) {
      const medicationName = getFieldValue('medicationId');

      const confirmSaveModalConfigs = getConfirmSaveModalConfigs({
        patientName: processedData.patientName || '',
        newStatus: updatedRequestInput.newStatus,
        medicationName,
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

      if (type === 'order-new') {
        response?.id && navigate(getEditOrderUrl(encounterId!, response.id));
        return;
      }

      // upd saved status in the local state
      medicationUpdateRequestInputRefRef.current?.newStatus &&
        void handleStatusSelect(medicationUpdateRequestInputRefRef.current.newStatus);
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

  const getFieldValue = <Field extends keyof MedicationData>(
    field: Field,
    type = 'text'
  ): MedicationData[Field] | '' => {
    return localValues[field] ?? (medication ? getMedicationFieldValue(medication || {}, field, type) : '');
  };

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
  const saveButtonText = getSaveButtonText(medication?.status || 'pending', type, selectedStatus, isUnsavedData);
  const isCardSaveButtonDisabled = type !== 'dispense' && (isUpdating || !isUnsavedData);

  const isModalSaveButtonDisabled =
    confirmedMedicationUpdateRequestRef.current.newStatus === 'administered' ? false : isReasonSelected;

  return (
    <>
      <MedicationCardView
        isEditable={getIsMedicationEditable(type, medication)}
        type={type}
        onSave={updateOrCreateOrder}
        medication={medication}
        fieldsConfig={fieldsConfig[type]}
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

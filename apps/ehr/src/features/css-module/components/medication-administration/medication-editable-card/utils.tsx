import { Box, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import {
  ExtendedMedicationDataForResponse,
  MedicationData,
  MedicationOrderStatusesType,
  UpdateMedicationOrderInput,
} from 'utils';
import { fieldsConfig, MedicationOrderType } from './fieldsConfig';
import { ReasonSelect } from './ReasonSelect';

export const medicationOrderFieldsWithOptions: Partial<keyof ExtendedMedicationDataForResponse>[] = [
  'medicationId',
  'associatedDx',
  'route',
  'location',
  'units',
];

export type MedicationOrderFieldWithOptionsType = (typeof medicationOrderFieldsWithOptions)[number];

export type InHouseMedicationFieldType = 'text' | 'number' | 'select' | 'date' | 'time' | 'month' | 'autocomplete';

export const getFieldType = (field: keyof MedicationData): InHouseMedicationFieldType => {
  if (field === 'dose') return 'number';
  if (field === 'expDate') return 'month';
  if (field === 'dateGiven') return 'date';
  if (field === 'timeGiven') return 'time';
  if (field === 'medicationId') return 'autocomplete';
  if (medicationOrderFieldsWithOptions.includes(field)) return 'select';
  return 'text';
};

export const validateMedicationField = (field: string, value: string | number, type: MedicationOrderType): boolean => {
  const config = fieldsConfig[type][field as keyof (typeof fieldsConfig)[typeof type]];
  return config?.isRequired ? value.toString().trim() !== '' : true;
};

export const validateAllMedicationFields = (
  localValues: Partial<MedicationData>,
  medication: MedicationData | undefined = undefined,
  type: MedicationOrderType,
  setFieldErrors: (errors: Record<string, boolean>) => void
): { isValid: boolean; missingFields: string[] } => {
  const currentFieldsConfig = fieldsConfig[type];
  const errors: Record<string, boolean> = {};
  const missingFields: string[] = [];

  Object.entries(currentFieldsConfig).forEach(([field, config]) => {
    if (config.isRequired) {
      const fieldKey = field as keyof MedicationData;
      const value = localValues[fieldKey] ?? medication?.[fieldKey] ?? '';
      const isValid = validateMedicationField(field, value as string, type);
      errors[field] = !isValid;
      if (!isValid) {
        missingFields.push(field);
      }
    }
  });

  setFieldErrors(errors);
  return { isValid: missingFields.length === 0, missingFields };
};

export const medicationStatusDisplayLabelMap: Record<MedicationOrderStatusesType, string> = {
  pending: 'Pending',
  administered: 'Administered',
  'administered-partly': 'Partly Administered',
  'administered-not': 'Not Administered',
  cancelled: 'Cancelled',
};

// this check is used in order-new and order-edit to prevent user from exit page and lose unsaved data
export const isUnsavedMedicationData = (
  savedMedication: ExtendedMedicationDataForResponse | undefined,
  localValues: Partial<MedicationData>,
  selectedStatus: MedicationOrderStatusesType | undefined,
  getMedicationFieldValue: <Field extends keyof MedicationData>(
    medication: MedicationData,
    field: Field,
    type?: string
  ) => MedicationData[Field] | '',
  autoFilledFieldsRef: React.MutableRefObject<Partial<MedicationData>>
): boolean => {
  if (!savedMedication) {
    return Object.values(localValues).some((value) => value !== '');
  }

  return (
    selectedStatus !== savedMedication?.status ||
    Object.entries(localValues).some(([field, value]) => {
      const isAutofilledField = Object.keys(autoFilledFieldsRef.current).includes(field);
      const savedValue = getMedicationFieldValue(savedMedication, field as keyof MedicationData);
      const isChangedField = (value || savedValue) && value !== savedValue;

      // we don't have autofilled fields in the order-edit or order-edit, so we don't have to check them
      return isAutofilledField ? false : isChangedField;
    })
  );
};

export const getSaveButtonText = (
  currentStatus: MedicationOrderStatusesType,
  type: MedicationOrderType,
  selectedStatus: MedicationOrderStatusesType | undefined,
  isUnsavedData: boolean
): string => {
  if ((type === 'dispense' || type === 'dispense-not-administered') && currentStatus === 'pending' && selectedStatus) {
    return `Mark as ${selectedStatus
      .toLocaleLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')}`;
  }
  if (type === 'order-new') {
    return isUnsavedData ? 'Order Medication' : 'Fill Order to Save';
  }
  if (type === 'order-edit' && currentStatus === 'pending') {
    return isUnsavedData ? 'Save' : 'Saved';
  }
  return '';
};

export interface ConfirmSaveModalConfig {
  title: string;
  confirmText: string;
  closeButtonText: string;
  color?: string;
  icon?: React.ReactNode;
  showCloseButton?: boolean;
  showConfirmButton?: boolean;
  ContentComponent?: React.FC;
}

export const getConfirmSaveModalConfigs = ({
  patientName,
  medicationName,
  newStatus,
  updateRequestInputRef,
  setIsReasonSelected,
  routeName,
}: {
  patientName: string;
  medicationName: string;
  newStatus: MedicationOrderStatusesType;
  updateRequestInputRef: React.MutableRefObject<UpdateMedicationOrderInput | null>;
  setIsReasonSelected: React.Dispatch<React.SetStateAction<boolean>>;
  routeName: string;
}): Partial<Record<MedicationOrderStatusesType, ConfirmSaveModalConfig>> => {
  const confirmationModalContentJSX = (
    <Box display="flex" flexDirection="column" gap={1}>
      <Typography>
        <strong>Patient:</strong> {patientName}
      </Typography>
      <Typography>
        <strong>Medication:</strong> {medicationName} / {updateRequestInputRef.current?.orderData?.dose}
        {updateRequestInputRef.current?.orderData?.units} / {routeName}
      </Typography>
      <Typography>
        Please confirm that you want to mark this medication order as{' '}
        {<strong>{medicationStatusDisplayLabelMap[newStatus] || newStatus}</strong>}
        {newStatus !== 'administered' ? ' and select the reason.' : '.'}
      </Typography>
    </Box>
  );

  const ReasonSelectField = (): React.ReactElement => (
    <ReasonSelect updateRequestInputRef={updateRequestInputRef} setIsReasonSelected={setIsReasonSelected} />
  );

  return {
    administered: {
      icon: null,
      color: 'primary.main',
      title: 'Medication Administered',
      confirmText: 'Mark as Administered',
      closeButtonText: 'Cancel',
      showCloseButton: true,
      showConfirmButton: true,
      ContentComponent: () => {
        return confirmationModalContentJSX;
      },
    },
    'administered-partly': {
      icon: null,
      color: 'primary.main',
      title: 'Medication Partly Administered',
      confirmText: 'Mark as Partly Administered',
      closeButtonText: 'Cancel',
      showCloseButton: true,
      showConfirmButton: true,
      ContentComponent: () => (
        <>
          {confirmationModalContentJSX}
          <ReasonSelectField />
        </>
      ),
    },
    'administered-not': {
      icon: null,
      color: 'primary.main',
      title: 'Medication Not Administered',
      confirmText: 'Mark as Not Administered',
      closeButtonText: 'Cancel',
      showCloseButton: true,
      showConfirmButton: true,
      ContentComponent: () => (
        <>
          {confirmationModalContentJSX}
          <ReasonSelectField />
        </>
      ),
    },
  };
};

export const getInitialAutoFilledFields = (
  medication: ExtendedMedicationDataForResponse | undefined,
  autoFilledFieldsRef: React.MutableRefObject<Partial<MedicationData>>
): Partial<Record<'dateGiven' | 'timeGiven', string>> => {
  const shouldSetDefaultTime = medication?.status === 'pending' && !medication?.dateGiven && !medication?.timeGiven;

  if (shouldSetDefaultTime) {
    autoFilledFieldsRef.current = {
      dateGiven: DateTime.now().toFormat('yyyy-MM-dd'),
      timeGiven: DateTime.now().toFormat('HH:mm:ss'),
    };
    return autoFilledFieldsRef.current;
  }

  return {};
};

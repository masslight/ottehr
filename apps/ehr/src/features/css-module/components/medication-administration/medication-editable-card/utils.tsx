import { Box, Typography } from '@mui/material';
import Oystehr, { ErxCheckPrecheckInteractionsResponse } from '@oystehr/sdk';
import { MedicationRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { MedicationWithTypeDTO } from 'src/features/css-module/hooks/useMedicationHistory';
import {
  AllergyInteraction,
  DrugInteraction,
  ExtendedMedicationDataForResponse,
  MedicationData,
  MedicationInteractions,
  MedicationOrderStatusesType,
  medicationStatusDisplayLabelMap,
  MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM,
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
  'providerId',
];

export type MedicationOrderFieldWithOptionsType = (typeof medicationOrderFieldsWithOptions)[number];

export type InHouseMedicationFieldType = 'text' | 'number' | 'select' | 'datetime' | 'date' | 'autocomplete';

export const getFieldType = (field: keyof MedicationData): InHouseMedicationFieldType => {
  if (field === 'dose') return 'number';
  if (field === 'expDate') return 'date';
  if (field === 'effectiveDateTime') return 'datetime';
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
  autoFilledFieldsRef: React.MutableRefObject<Partial<MedicationData>>,
  interactions: MedicationInteractions | undefined
): boolean => {
  if (!savedMedication) {
    return Object.values(localValues).some((value) => value !== '' && value !== undefined);
  }

  return (
    selectedStatus !== savedMedication?.status ||
    JSON.stringify(interactions) !== JSON.stringify(savedMedication.interactions) ||
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
        <strong>Medication:</strong> {medicationName} / {updateRequestInputRef.current?.orderData?.dose}{' '}
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
): Partial<Record<'effectiveDateTime', string>> => {
  const shouldSetDefaultTime = medication?.status === 'pending' && !medication?.effectiveDateTime;

  if (shouldSetDefaultTime) {
    const currentDateTime = DateTime.now().toISO();

    autoFilledFieldsRef.current = {
      effectiveDateTime: currentDateTime,
    };

    return autoFilledFieldsRef.current;
  }

  return {};
};

const SEVERITY_LEVEL_TO_SEVERITY: Record<string, 'high' | 'moderate' | 'low' | undefined> = {
  MinorInteraction: 'low',
  ModerateInteraction: 'moderate',
  MajorInteraction: 'high',
  Unknown: undefined,
};

export const medicationInteractionsFromErxResponse = (
  response: ErxCheckPrecheckInteractionsResponse,
  medicationHistory: MedicationWithTypeDTO[],
  prescriptions: MedicationRequest[]
): MedicationInteractions => {
  const drugInteractions: DrugInteraction[] = (response.medications ?? []).map((medication) => {
    return {
      drugs: (medication.medications ?? []).map((nestedMedication) => ({
        id: nestedMedication.id.toString(),
        name: nestedMedication.name,
      })),
      severity: SEVERITY_LEVEL_TO_SEVERITY[medication.severityLevel],
      message: medication.message,
    };
  });
  drugInteractions.forEach((drugInteraction) => {
    const drugIds = drugInteraction.drugs.map((drug) => drug.id);
    const sourceMedication = medicationHistory.find((medication) => medication.id && drugIds.includes(medication.id));
    let display: string | undefined = undefined;
    if (sourceMedication && sourceMedication.resourceId && sourceMedication?.chartDataField && sourceMedication?.type) {
      display = sourceMedication.chartDataField === 'medications' ? 'Patient' : 'In-house';
      display += sourceMedication.type == 'scheduled' ? ' - Scheduled' : ' - As needed';
      if (sourceMedication?.intakeInfo?.date) {
        display += '\nlast taken\n' + DateTime.fromISO(sourceMedication.intakeInfo.date).toFormat('MM/dd/yyyy');
      }
      drugInteraction.source = {
        reference: 'Medication/' + sourceMedication.resourceId,
        display: display,
      };
      return;
    }
    const sourcePrescription = prescriptions.find((prescription) => {
      const code = prescription.medicationCodeableConcept?.coding?.find(
        (coding) => coding.system === MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM
      )?.code;
      return code && drugIds.includes(code);
    });
    const dateString = sourcePrescription?.extension?.find(
      (extension) => extension.url === 'http://api.zapehr.com/photon-event-time'
    )?.valueDateTime;
    if (sourcePrescription && sourcePrescription.id && dateString) {
      drugInteraction.source = {
        reference: 'MedicationRequest/' + sourcePrescription.id,
        display: 'Prescription\norder added\n' + DateTime.fromISO(dateString).toFormat('MM/dd/yyyy'),
      };
    }
  });
  const allergyInteractions: AllergyInteraction[] = (response.allergies ?? []).map((allergy) => {
    return {
      message: allergy.message,
    };
  });
  return {
    drugInteractions,
    allergyInteractions,
  };
};

export const findPrescriptionsForInteractions = async (
  patientId: string | undefined,
  interationsResponse: ErxCheckPrecheckInteractionsResponse,
  oystehr: Oystehr
): Promise<MedicationRequest[]> => {
  const interactingDrugIds = interationsResponse.medications.flatMap(
    (medication) => medication.medications?.map((nestedMedication) => nestedMedication.id.toString()) ?? []
  );
  if (interactingDrugIds.length === 0) {
    return [];
  }
  return (
    await oystehr.fhir.search<MedicationRequest>({
      resourceType: 'MedicationRequest',
      params: [
        {
          name: 'status',
          value: 'active',
        },
        {
          name: 'subject',
          value: 'Patient/' + patientId,
        },
        {
          name: '_tag',
          value: 'erx-medication',
        },
        {
          name: 'code',
          value: interactingDrugIds.map((drugId) => MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM + '|' + drugId).join(','),
        },
      ],
    })
  ).unbundle();
};

export const interactionsUnresolved = (interactions: MedicationInteractions | undefined): boolean => {
  const unresolvedInteraction = [
    ...(interactions?.drugInteractions ?? []),
    ...(interactions?.allergyInteractions ?? []),
  ].find((interaction) => interaction.overrideReason == null);
  return unresolvedInteraction != null;
};

import { CodeableConcept } from 'fhir/r4b';
import { ERX_MEDICATION_META_TAG_CODE } from '../../../fhir/constants';
import { SCHOOL_WORK_NOTE } from '../../data';
import { CSS_NOTE_ID, NOTHING_TO_EAT_OR_DRINK_ID } from './chart-data.types';

export type ProviderChartDataFieldsNames =
  | 'chief-complaint'
  | 'ros'
  | 'current-medication'
  | 'in-house-medication'
  | 'prescribed-medication'
  | 'known-allergy'
  | 'medical-condition'
  | 'surgical-history'
  | 'surgical-history-note'
  | 'hospitalization'
  | 'additional-question'
  | 'medical-decision'
  | 'cpt-code'
  | 'em-code'
  | 'patient-instruction'
  | 'diagnosis'
  | typeof SCHOOL_WORK_NOTE
  | 'patient-info-confirmed'
  | 'addendum-note'
  | typeof NOTHING_TO_EAT_OR_DRINK_ID
  | typeof CSS_NOTE_ID
  | 'birth-history'
  | 'ai-potential-diagnosis'
  | 'procedure'
  | typeof ERX_MEDICATION_META_TAG_CODE;

export type DispositionMetaFieldsNames = 'disposition-follow-up' | 'sub-follow-up';

export const SCHOOL_WORK_NOTE_TYPE_META_SYSTEM = `${SCHOOL_WORK_NOTE}/type`;

export const PATIENT_SUPPORT_PHONE_NUMBER = '202-555-1212';

export const ASQ_FIELD = 'asq';

export enum ASQKeys {
  Negative = 'Negative',
  Positive = 'Positive',
  Declined = 'Declined',
  NotOffered = 'NotOffered',
}

export const asqLabels: Record<ASQKeys, string> = {
  [ASQKeys.Negative]: 'Negative',
  [ASQKeys.Positive]: 'Positive',
  [ASQKeys.Declined]: 'Patient/Caregiver Declined',
  [ASQKeys.NotOffered]: 'Not offered',
};

export enum VitalFieldNames {
  VitalTemperature = 'vital-temperature',
  VitalHeartbeat = 'vital-heartbeat',
  VitalBloodPressure = 'vital-blood-pressure',
  VitalOxygenSaturation = 'vital-oxygen-sat',
  VitalRespirationRate = 'vital-respiration-rate',
  VitalWeight = 'vital-weight',
  VitalHeight = 'vital-height',
  VitalVision = 'vital-vision',
}

export enum VitalVisionComponents {
  LeftEye = 'left-eye',
  RightEye = 'right-eye',
}

export enum VitalBloodPressureComponents {
  SystolicPressure = 'systolic-pressure',
  DiastolicPressure = 'diastolic-pressure',
}

export enum VitalAlertCriticality {
  Critical = 'critical',
  Abnormal = 'abnormal',
}

export const FHIRObservationInterpretationSystem = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';

// subset taken from full expansion: https://hl7.org/fhir/R4B/valueset-observation-interpretation.html
export enum FHIRObservationInterpretation {
  CriticalHigh = 'HH',
  CriticalLow = 'LL',
  AbnormalHigh = 'HX',
  AbnormalLow = 'LX',
  Normal = 'N',
}

export const FHIRObservationInterpretationCodesMap: Record<FHIRObservationInterpretation, CodeableConcept> =
  Object.freeze({
    HH: {
      coding: [
        {
          system: FHIRObservationInterpretationSystem,
          code: FHIRObservationInterpretation.CriticalHigh,
          display: 'Critical high',
        },
      ],
    },
    LL: {
      coding: [
        {
          system: FHIRObservationInterpretationSystem,
          code: FHIRObservationInterpretation.CriticalLow,
          display: 'Critical low',
        },
      ],
    },
    HX: {
      coding: [
        {
          system: FHIRObservationInterpretationSystem,
          code: FHIRObservationInterpretation.AbnormalHigh,
          display: 'Abnormal high',
        },
      ],
    },
    LX: {
      coding: [
        {
          system: FHIRObservationInterpretationSystem,
          code: FHIRObservationInterpretation.AbnormalLow,
          display: 'Abnormal low',
        },
      ],
    },
    N: {
      coding: [
        {
          system: FHIRObservationInterpretationSystem,
          code: FHIRObservationInterpretation.Normal,
          display: 'Normal',
        },
      ],
    },
  });

export enum VitalTemperatureObservationMethod {
  Axillary = 'Axillary',
  Oral = 'Oral',
  Rectal = 'Rectal',
  Temporal = 'Temporal',
}

export enum VitalHeartbeatObservationMethod {
  Sitting = 'Sitting',
  Standing = 'Standing',
  Supine = 'Supine',
}

export enum VitalBloodPressureObservationMethod {
  Sitting = 'Sitting',
  Standing = 'Standing',
  Supine = 'Supine',
}

export enum VitalsOxygenSatObservationMethod {
  OnRoomAir = 'On room air',
  OnSupplementalO2 = 'On supplemental O2',
}

export enum AiObservationField {
  HistoryOfPresentIllness = 'ai-history-of-present-illness',
  PastMedicalHistory = 'ai-past-medical-history',
  PastSurgicalHistory = 'ai-past-surgical-history',
  MedicationsHistory = 'ai-medications-history',
  SocialHistory = 'ai-social-history',
  FamilyHistory = 'ai-family-history',
  HospitalizationsHistory = 'ai-hospitalizations-history',
  Allergies = 'ai-allergies',
}

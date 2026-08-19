import { DateTime } from 'luxon';
import { ChangeEvent } from 'react';
import {
  VitalsBloodPressureObservationDTO,
  VitalsHeartbeatObservationDTO,
  VitalsHeightObservationDTO,
  VitalsLastMenstrualPeriodObservationDTO,
  VitalsObservationDTO,
  VitalsOxygenSatObservationDTO,
  VitalsRespirationRateObservationDTO,
  VitalsTemperatureObservationDTO,
  VitalsVisionObservationDTO,
  VitalsVisionOption,
  VitalsWeightObservationDTO,
  VitalsWeightOption,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { VitalField } from './hooks/useVitalsManagement';

export interface VitalsCardProps<TypeObsDTO extends VitalsObservationDTO> {
  field: VitalField<TypeObsDTO>;
  historyElementSkeletonText?: string;
  /**
   * `input` renders ONLY the entry row — no accordion header, no history column.
   *
   * For a surface that already states the charted readings itself and only needs somewhere to type the
   * next one, like the Easy Chart note. It is the same inputs, the same unit pairing, the same qualifier
   * and the same save; what it drops is the chrome that would otherwise duplicate the note around it.
   */
  variant?: 'card' | 'input';
}

export interface TemperatureLocalState {
  valueCelsius: string;
  valueFahrenheit: string;
  observationQualifier: string;
  validationError: boolean;
  isCelsiusInvalid: boolean;
  isFahrenheitInvalid: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleCelsiusChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleFahrenheitChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleQualifierChange: (qualifier: string) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsTemperatureObservationDTO | null;
}

export interface BloodPressureLocalState {
  systolicValue: string;
  diastolicValue: string;
  observationQualifier: string;
  validationError: boolean;
  validationErrorMessage?: string;
  isSystolicInvalid: boolean;
  isDiastolicInvalid: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleSystolicChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleDiastolicChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleQualifierChange: (qualifier: string) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsBloodPressureObservationDTO | null;
}

export interface WeightLocalState {
  weightKg: number | undefined;
  isPatientRefusedSelected: boolean;
  validationError: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleKgInput: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleLbsInput: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handlePatientRefusedChange: (isChecked: boolean, weightOption: VitalsWeightOption) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsWeightObservationDTO | null;
}

export interface HeartbeatLocalState {
  value: string;
  observationQualifier: string;
  validationError: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleValueChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleQualifierChange: (qualifier: string) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsHeartbeatObservationDTO | null;
}

export interface RespirationRateLocalState {
  value: string;
  validationError: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleValueChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsRespirationRateObservationDTO | null;
}

export interface OxygenSatLocalState {
  value: string;
  observationQualifier: string;
  validationError: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleValueChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleQualifierChange: (qualifier: string) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsOxygenSatObservationDTO | null;
}

export interface HeightLocalState {
  valueCm: string;
  valueInches: string;
  valueFeet: string;
  valueInchRemainder: string;
  validationError: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleCmChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleInchesChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleFeetChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleInchRemainderChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsHeightObservationDTO | null;
}

export interface VisionLocalState {
  leftEyeSelection: string;
  rightEyeSelection: string;
  bothEyesSelection: string;
  isChildTooYoungSelected: boolean;
  isWithGlassesSelected: boolean;
  isWithoutGlassesSelected: boolean;
  validationError: boolean;
  isLeftEyeInvalid: boolean;
  isRightEyeInvalid: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleLeftEyeChange: (event: { target: { value: string } }) => void;
  handleRightEyeChange: (event: { target: { value: string } }) => void;
  handleBothEyesChange: (event: { target: { value: string } }) => void;
  handleVisionOptionChange: (isChecked: boolean, visionOption: VitalsVisionOption) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsVisionObservationDTO | null;
}

export interface LMPLocalState {
  selectedDate: DateTime | null;
  isUnsureSelected: boolean;
  validationError: boolean;
  isDateInvalid: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleDateChange: (date: DateTime | null) => void;
  handleUnsureChange: (isChecked: boolean) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsLastMenstrualPeriodObservationDTO | null;
}

export type VitalLocalState =
  | TemperatureLocalState
  | HeartbeatLocalState
  | RespirationRateLocalState
  | BloodPressureLocalState
  | OxygenSatLocalState
  | WeightLocalState
  | HeightLocalState
  | VisionLocalState
  | LMPLocalState;

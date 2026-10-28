import {
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from '../../types/api/chart-data/chart-data.constants';
import {
  VitalsOxygenSatObservationDTO,
  VitalsSupplementalO2Details,
} from '../../types/api/chart-data/chart-data.types';

export const SUPPLEMENTAL_O2_FLOW_RATE_UNIT = 'L/min';
export const SUPPLEMENTAL_O2_DELIVERY_TYPE_OTHER_MAX_LENGTH = 200;

export const isValidSupplementalO2FlowRate = (flowRate: number): boolean => Number.isFinite(flowRate) && flowRate >= 0;

export function toVitalsSupplementalO2DeliveryType(
  value: string | undefined
): VitalsSupplementalO2DeliveryType | undefined {
  return Object.values(VitalsSupplementalO2DeliveryType).find((deliveryType) => deliveryType === value);
}

export const getActiveSupplementalO2Details = (
  observationMethod: VitalsOxygenSatObservationMethod | undefined,
  details: VitalsSupplementalO2Details | undefined
): VitalsSupplementalO2Details | undefined => {
  if (observationMethod !== VitalsOxygenSatObservationMethod.OnSupplementalO2 || !details) return undefined;
  const { flowRate } = details;
  const deliveryType = toVitalsSupplementalO2DeliveryType(details.deliveryType);
  const deliveryTypeOther =
    deliveryType === VitalsSupplementalO2DeliveryType.Other
      ? details.deliveryTypeOther?.replace(/\s+/g, ' ').trim()
      : undefined;
  const active: VitalsSupplementalO2Details = {
    ...(flowRate !== undefined && isValidSupplementalO2FlowRate(flowRate) && { flowRate }),
    ...(deliveryType && { deliveryType }),
    ...(deliveryTypeOther && { deliveryTypeOther }),
  };
  return Object.keys(active).length > 0 ? active : undefined;
};

export const formatOxygenSatObservationMethod = ({
  observationMethod,
  supplementalO2,
}: Pick<VitalsOxygenSatObservationDTO, 'observationMethod' | 'supplementalO2'>): string | undefined => {
  if (!observationMethod) return undefined;
  const details = getActiveSupplementalO2Details(observationMethod, supplementalO2);
  const deliveryType = details?.deliveryTypeOther
    ? `${details.deliveryType}: ${details.deliveryTypeOther}`
    : details?.deliveryType;
  return [
    observationMethod,
    details?.flowRate !== undefined ? `${details.flowRate} ${SUPPLEMENTAL_O2_FLOW_RATE_UNIT}` : undefined,
    deliveryType,
  ]
    .filter(Boolean)
    .join(' - ');
};

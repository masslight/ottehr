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

// Only values that cannot be a flow rate are rejected; there is no clinical upper limit.
export const isValidSupplementalO2FlowRate = (flowRate: number): boolean => Number.isFinite(flowRate) && flowRate >= 0;

export function toVitalsSupplementalO2DeliveryType(
  value: string | undefined
): VitalsSupplementalO2DeliveryType | undefined {
  return Object.values(VitalsSupplementalO2DeliveryType).find((deliveryType) => deliveryType === value);
}

/**
 * The supplemental O2 details a saved reading carries: none unless the qualifier is supplemental O2, only a known type
 * and a valid flow rate, and the Other text (on one line) only while the type is Other. Applied wherever readings are
 * built, saved, read or shown, so stale or malformed values never surface.
 */
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

/** The qualifier followed by whichever supplemental O2 details were recorded, e.g. "On supplemental O2 - 4.5 L/min". */
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

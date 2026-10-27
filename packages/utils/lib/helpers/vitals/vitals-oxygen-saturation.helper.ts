import {
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from '../../types/api/chart-data/chart-data.constants';
import {
  VitalsOxygenSatObservationDTO,
  VitalsSupplementalO2Details,
} from '../../types/api/chart-data/chart-data.types';

export const SUPPLEMENTAL_O2_FLOW_RATE_UNIT = 'L/min';

// Only values that cannot be a flow rate are rejected; there is no clinical upper limit.
export const isValidSupplementalO2FlowRate = (flowRate: number): boolean => Number.isFinite(flowRate) && flowRate >= 0;

/**
 * The supplemental O2 details that apply to a reading: none unless the qualifier is supplemental O2, and the Other
 * text only while the type is Other. Applied wherever details are built, saved, read or shown, so values left behind
 * by a qualifier or type change never surface.
 */
export const getActiveSupplementalO2Details = (
  observationMethod: VitalsOxygenSatObservationMethod | undefined,
  details: VitalsSupplementalO2Details | undefined
): VitalsSupplementalO2Details | undefined => {
  if (observationMethod !== VitalsOxygenSatObservationMethod.OnSupplementalO2 || !details) return undefined;
  const { flowRate, deliveryType } = details;
  const deliveryTypeOther =
    deliveryType === VitalsSupplementalO2DeliveryType.Other ? details.deliveryTypeOther?.trim() : undefined;
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

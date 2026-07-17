import { INVALID_INPUT_ERROR, MedicationInteractions, MISSING_REQUEST_BODY, UpdateMedicationOrderInput } from 'utils';
import { safeJsonParse, ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): UpdateMedicationOrderInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  let parsedBody;
  try {
    parsedBody = safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body must be valid JSON');
  }
  const { orderId, newStatus, orderData, interactions } = parsedBody;

  if (newStatus) {
    if (newStatus === 'administered' && !orderData) {
      throw INVALID_INPUT_ERROR(`With status 'administered' order data should be provided.`);
    }
    if (newStatus === 'pending') {
      throw INVALID_INPUT_ERROR('Cannot change status back to pending.');
    }
    if (orderId && newStatus !== 'administered' && newStatus !== 'cancelled' && !orderData?.reason) {
      throw INVALID_INPUT_ERROR(
        `Reason should be provided if you are changing status to anything except 'administered'`
      );
    }
    if (newStatus === 'administered') {
      if (!orderData.effectiveDateTime)
        throw INVALID_INPUT_ERROR(
          'On status change to "administered" effectiveDateTime field should be present in zambda input'
        );
    }

    const missedFields: string[] = [];
    if (orderData && !orderId) {
      if (!orderData.patient) missedFields.push('patient');
      if (!orderData.encounter) missedFields.push('encounter');
      if (!orderData.medicationId) missedFields.push('medicationId');
      if (!orderData.units) missedFields.push('units');
      if (!orderData.dose) missedFields.push('dose');
      if (!orderData.route) missedFields.push('route');
    }
    if (missedFields.length > 0) throw INVALID_INPUT_ERROR(`Missing fields in orderData: ${missedFields.join(', ')}`);
  }

  validateInteractions(interactions);

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    orderId,
    newStatus,
    orderData,
    secrets: input.secrets,
    interactions: interactions,
  };
}

function validateInteractions(interactions?: MedicationInteractions): void {
  const missingOverrideReason: string[] = [];
  interactions?.drugInteractions?.forEach((interaction, index) => {
    if (!interaction.overrideReason) {
      missingOverrideReason.push(`interactions.drugInteractions[${index}]`);
    }
  });
  interactions?.allergyInteractions?.forEach((interaction, index) => {
    if (!interaction.overrideReason) {
      missingOverrideReason.push(`interactions.allergyInteractions[${index}]`);
    }
  });
  if (missingOverrideReason.length > 0) {
    throw INVALID_INPUT_ERROR(`overrideReason is missing for ${missingOverrideReason.join(', ')}`);
  }
}

import { MISSING_REQUEST_BODY } from 'utils';
import {
  SendReceiptByEmailZambdaInput,
  SendReceiptByEmailZambdaInputSchema,
} from 'utils/lib/types/api/send-receipt-by-email.types';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): SendReceiptByEmailZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;

  const data = JSON.parse(input.body);
  const { recipientFullName, email, receiptDocRefId } = SendReceiptByEmailZambdaInputSchema.parse(data);

  return { recipientFullName, email, receiptDocRefId, secrets: input.secrets };
}

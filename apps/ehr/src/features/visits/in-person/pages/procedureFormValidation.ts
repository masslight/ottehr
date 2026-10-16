import { Resolver, ResolverResult } from 'react-hook-form';
import { FHIR_CODE_REGEX } from 'utils/lib/types/constants';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';

export interface ProcedureFormValues {
  procedureType?: string;
}

/** Validation stays registered while a sentence blank's editor is closed. */
export const procedureFormResolver: Resolver<ProcedureFormValues> = (values): ResolverResult<ProcedureFormValues> => {
  if (!values.procedureType) {
    return { values: {}, errors: { procedureType: { type: 'required', message: REQUIRED_FIELD_ERROR_MESSAGE } } };
  }
  if (!FHIR_CODE_REGEX.test(values.procedureType)) {
    return {
      values: {},
      errors: {
        procedureType: {
          type: 'validate',
          message: 'No leading, trailing, or consecutive spaces allowed',
        },
      },
    };
  }
  return { values, errors: {} };
};

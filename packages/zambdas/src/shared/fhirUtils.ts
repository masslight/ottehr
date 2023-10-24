import { CodeableConcept, Identifier, Period } from 'fhir/r4';
interface CodeableConceptInput {
  code: string;
  system: string;
  display?: string;
}

export const createCodableConcept = (
  input: CodeableConceptInput | CodeableConceptInput[],
  text?: string
): CodeableConcept => {
  const inputs: CodeableConceptInput[] = Array.isArray(input) ? input : [input];
  const concept: { coding: CodeableConceptInput[]; text?: string } = {
    coding: inputs.map((ip) => {
      const { code, system, display } = ip;
      return {
        code,
        display,
        system,
      };
    }),
  };
  if (text != null) {
    concept.text = text;
  }
  return concept;
};

// placeholder - prevent passing raw string vals to makeIdentifier
export enum IdentifierSystem {}

export enum IdentifierAssigner {
  cardpointe = 'CardPointe',
}

export interface IdentifierInput {
  value: string;
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: CodeableConcept | CodeableConceptInput;
  system?: IdentifierSystem;
  period?: Period;
  assignerDisplay?: IdentifierAssigner;
}

export const makeIdentifier = (input: IdentifierInput): Identifier => {
  const { value, use, type, system, period, assignerDisplay } = input;

  if (system === undefined && assignerDisplay === undefined) {
    throw new Error('Assigner display is required if system is undefined and vice versa');
  }

  const identifierToReturn: Identifier = {
    value,
  };

  if (use) {
    identifierToReturn.use = use;
  }

  if (period) {
    identifierToReturn.period = period;
  }

  if (system) {
    identifierToReturn.system = `${system}`;
  }

  if (type) {
    const anyType = type as any;
    if (anyType.coding || anyType.text) {
      // type is a ready-made codable concept
      identifierToReturn.type = anyType as CodeableConcept;
    } else if (anyType.code && anyType.system) {
      // type is a codable concept input
      identifierToReturn.type = createCodableConcept(anyType as CodeableConceptInput);
    }
  }

  if (assignerDisplay) {
    // http://www.hl7.org/fhir/datatypes-definitions.html#Identifier.assigner - may omit reference element for assigner
    identifierToReturn.assigner = { display: `${assignerDisplay}` };
  }

  console.log('identifier created: ', identifierToReturn);

  return identifierToReturn;
};

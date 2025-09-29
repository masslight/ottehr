import { QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';

export const updateQuestionnaireResponse = (
  questionnaireResponse: QuestionnaireResponse | undefined,
  name: string,
  value: string
): { questionnaireResponse: QuestionnaireResponse } | undefined => {
  if (questionnaireResponse) {
    if (questionnaireResponse.item?.find((item) => item.linkId === name)) {
      return {
        questionnaireResponse: {
          ...questionnaireResponse,
          item: questionnaireResponse?.item?.map((item) =>
            item.linkId === name ? { ...item, answer: [{ valueString: value }] } : item
          ),
        },
      };
    } else {
      const newItem = { linkId: name, answer: [{ valueString: value }] };
      if (!questionnaireResponse.item) {
        return {
          questionnaireResponse: {
            ...questionnaireResponse,
            item: [newItem],
          },
        };
      } else {
        return {
          questionnaireResponse: {
            ...questionnaireResponse,
            item: [...questionnaireResponse.item, newItem],
          },
        };
      }
    }
  }
  return undefined;
};

export const isNumberValidation = (value: string): string | undefined => {
  if (isNaN(+value) || isNaN(parseFloat(value))) {
    return 'Value must be a number';
  }
  return;
};

export const isEmptyValidation = (value: string): boolean => {
  return value === '';
};

type ValidationValues = {
  temperature: {
    high: number;
  };
  pulse: {
    high: number;
  };
  hr: {
    high: number;
  };
  rr: {
    high: number;
  };
};

export const getValidationValuesByDOB = (dob: string): ValidationValues => {
  const now = DateTime.now();
  const birthDate = DateTime.fromISO(dob);
  const age = now.diff(birthDate, 'years').years;

  for (const group of ageGroups) {
    if (age >= group.minAge && age < group.maxAge) {
      return group.value;
    }
  }

  throw new Error('Invalid BOD');
};

const ageGroups: { minAge: number; maxAge: number; value: ValidationValues }[] = [
  {
    minAge: 0,
    maxAge: 0.25,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 0.25,
    maxAge: 0.5,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 0.5,
    maxAge: 0.75,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 0.75,
    maxAge: 1,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 1,
    maxAge: 1.5,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 1.5,
    maxAge: 2,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 2,
    maxAge: 3,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 3,
    maxAge: 4,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 4,
    maxAge: 6,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 6,
    maxAge: 8,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 8,
    maxAge: 12,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 12,
    maxAge: 15,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 15,
    maxAge: 18,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
  {
    minAge: 18,
    maxAge: Infinity,
    value: {
      temperature: {
        high: 46,
      },
      pulse: {
        high: 100,
      },
      hr: {
        high: 290,
      },
      rr: {
        high: 90,
      },
    },
  },
];

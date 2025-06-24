import { Extension, Questionnaire, QuestionnaireItem, QuestionnaireItemEnableWhen } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { assert, describe, expect, it } from 'vitest';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../../fhir';
import { ConditionKeyObject, QuestionnaireItemConditionDefinition, QuestionnaireItemTextWhen } from '../../../types';
import { DOB_DATE_FORMAT } from '../../../utils';
import { mapQuestionnaireAndValueSetsToItemsList } from '../paperwork';
import {
  evalComplexValidationTrigger,
  evalEnableWhen,
  evalItemText,
  evalRequired,
  recursiveGroupTransform,
} from '../validation';

const KEYS = {
  triggers: {
    boolean: {
      primary: 'conditional-bool-question',
      secondary: 'conditional-bool-question-secondary',
    },
    string: {
      primary: 'conditional-string-question',
      secondary: 'conditional-string-question-secondary',
    },
    date: {
      primary: 'conditional-date-question',
      secondary: 'conditional-date-question-secondary',
    },
  },
  dependents: {
    bool: {
      primaryTrue: 'enable-when-conditional-bool-true',
      secondaryFalse: 'enable-when-conditional-bool-false',
    },
    string: 'enable-when-conditional-string-question-foo',
    date: {
      over: 'enable-when-conditional-date-question-over',
      under: 'conditional-date-question-under',
      exactly: 'conditional-date-question-exactly',
    },
  },
};

const BASE_FORM_VALUES = [
  {
    linkId: KEYS.triggers.boolean.primary,
    answer: [{ valueBoolean: false }],
  },
  {
    linkId: 'conditional-bool-question-secondary',
    answer: [{ valueBoolean: false }],
  },
  {
    linkId: KEYS.triggers.string.primary,
    answer: [{ valueString: 'foo' }],
  },
  {
    linkId: KEYS.triggers.string.secondary,
    answer: [{ valueString: 'foo' }],
  },
  {
    linkId: KEYS.triggers.date.primary,
    answer: [{ valueString: '2001-01-01' }],
  },
  {
    linkId: KEYS.triggers.date.secondary,
    answer: [{ valueString: '2021-01-01' }],
  },
];

const BASE_QUESTIONNAIRE: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  url: 'some-url',
  version: '1.0.0',
  item: [
    {
      linkId: 'page-one',
      type: 'group',
      item: [
        {
          linkId: KEYS.triggers.boolean.primary,
          type: 'boolean',
        },
        {
          linkId: KEYS.triggers.boolean.secondary,
          type: 'boolean',
        },
        {
          linkId: KEYS.triggers.string.primary,
          type: 'string',
        },
        {
          linkId: KEYS.triggers.string.secondary,
          type: 'string',
        },
        {
          linkId: KEYS.triggers.date.primary,
          type: 'date',
        },
        {
          linkId: KEYS.triggers.date.secondary,
          type: 'date',
        },
        {
          linkId: KEYS.dependents.bool.primaryTrue,
          type: 'string',
          enableWhen: [
            {
              question: KEYS.triggers.boolean.primary,
              operator: '=',
              answerBoolean: true,
            },
          ],
        },
        {
          linkId: 'enable-when-conditional-bool-false',
          type: 'boolean',
          enableWhen: [
            {
              question: KEYS.triggers.boolean.primary,
              operator: '=',
              answerBoolean: false,
            },
          ],
        },
        {
          linkId: 'enable-when-conditional-bool-not-true',
          type: 'boolean',
          enableWhen: [
            {
              question: KEYS.triggers.boolean.primary,
              operator: '!=',
              answerBoolean: true,
            },
          ],
        },
        {
          linkId: 'enable-when-conditional-bool-not-false',
          type: 'boolean',
          enableWhen: [
            {
              question: KEYS.triggers.boolean.primary,
              operator: '!=',
              answerBoolean: false,
            },
          ],
        },
        {
          linkId: KEYS.dependents.string,
          text: 'This is the default text a user sees above my input',
          type: 'string',
          enableWhen: [
            {
              question: KEYS.triggers.string.primary,
              operator: '=',
              answerString: 'foo',
            },
          ],
        },
        {
          linkId: KEYS.dependents.date.over,
          type: 'date',
          enableWhen: [
            {
              question: KEYS.triggers.date.primary,
              operator: '>',
              answerInteger: 18,
            },
          ],
        },
        {
          linkId: KEYS.dependents.date.under,
          type: 'date',
          enableWhen: [
            {
              question: KEYS.triggers.date.primary,
              operator: '<',
              answerInteger: 18,
            },
          ],
        },
        {
          linkId: KEYS.dependents.date.exactly,
          type: 'date',
          enableWhen: [
            {
              question: KEYS.triggers.date.primary,
              operator: '=',
              answerInteger: 18,
            },
          ],
        },
      ],
    },
  ],
};

const setEnableBehavior = (
  items: QuestionnaireItem[],
  linkIds: string[],
  additionalConditions: QuestionnaireItemEnableWhen[],
  behavior: 'any' | 'all'
): QuestionnaireItem[] => {
  return items.map((i) => {
    if (linkIds.includes(i.linkId)) {
      return {
        ...i,
        enableBehavior: behavior,
        enableWhen: [...(i.enableWhen ?? []), ...additionalConditions],
      };
    }
    return {
      ...i,
    };
  });
};
const resetEnableWhenConditions = (
  items: QuestionnaireItem[],
  linkIds: string[],
  conditions: QuestionnaireItemEnableWhen[],
  behavior?: 'any' | 'all'
): QuestionnaireItem[] => {
  return items.map((i) => {
    if (linkIds.includes(i.linkId)) {
      const newOne = {
        ...i,
        enableWhen: [...conditions],
      };
      if (behavior) {
        newOne.enableBehavior = behavior;
      }
      return newOne;
    }
    return {
      ...i,
    };
  });
};

const filterExtension = (item: QuestionnaireItem, extRootUrl: string): QuestionnaireItem => {
  const extension = item.extension ?? [];
  return {
    ...item,
    extension: extension.filter((ext) => {
      return ext.url !== extRootUrl;
    }),
  };
};

const resetRequireWhenConditions = (
  items: QuestionnaireItem[],
  linkIds: string[],
  conditions: QuestionnaireItemConditionDefinition[]
): QuestionnaireItem[] => {
  return resetConditionExtension(items, linkIds, conditions, OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.requireWhen);
};

const resetFilterWhenConditions = (
  items: QuestionnaireItem[],
  linkIds: string[],
  conditions: QuestionnaireItemConditionDefinition[]
): QuestionnaireItem[] => {
  return resetConditionExtension(items, linkIds, conditions, OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.filterWhen);
};

const resetTextWhenConditions = (
  items: QuestionnaireItem[],
  linkTextMap: Record<string, string>,
  conditions: QuestionnaireItemTextWhen[]
): QuestionnaireItem[] => {
  const extras = conditions.map((cond) => {
    return {
      url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.textWhen.substituteText,
      valueString: cond.substituteText,
    };
  });
  return resetConditionExtension(
    items,
    Object.keys(linkTextMap),
    conditions,
    OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.textWhen,
    extras,
    linkTextMap
  );
};

const resetComplexValidationConditions = (
  items: QuestionnaireItem[],
  linkIds: string[],
  conditions: QuestionnaireItemConditionDefinition[]
): QuestionnaireItem[] => {
  const newItems = items.map((i) => {
    if (linkIds.includes(i.linkId)) {
      const newOne = filterExtension(i, OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.complexValidation.extension);
      const extension: Extension[] = [];

      const conditionObj = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.complexValidation.triggerWhen;
      extension.push(
        ...conditions.map(({ question, operator, answerString, answerBoolean, answerDate, answerInteger }) => {
          return {
            url: conditionObj.extension,
            extension: [
              {
                url: conditionObj.operator,
                valueString: operator,
              },
              {
                url: conditionObj.question,
                valueString: question,
              },
              {
                url: conditionObj.answer,
                valueString: answerString ?? answerDate,
                valueBoolean: answerBoolean,
                valueInteger: answerInteger !== undefined ? parseInt(`${answerInteger}`) : undefined,
              },
            ],
          };
        })
      );
      extension.push({
        url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.complexValidation.type,
        valueString: 'insurance prevalidation',
      });
      newOne.extension = [
        ...(newOne.extension ?? []),
        { url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.complexValidation.extension, extension },
      ];
      return newOne;
    }
    return {
      ...i,
    };
  });
  return newItems;
};

const resetConditionExtension = (
  items: QuestionnaireItem[],
  linkIds: string[],
  conditions: QuestionnaireItemConditionDefinition[],
  conditionObj: ConditionKeyObject,
  extras: Extension[] = [],
  textChanges: Record<string, string> = {}
): QuestionnaireItem[] => {
  return items.map((i) => {
    if (linkIds.includes(i.linkId)) {
      const newOne = filterExtension(i, conditionObj.extension);
      const extension = newOne.extension || [];
      extension.push(
        ...conditions.map(({ question, operator, answerString, answerBoolean, answerDate, answerInteger }) => {
          return {
            url: conditionObj.extension,
            extension: [
              {
                url: conditionObj.operator,
                valueString: operator,
              },
              {
                url: conditionObj.question,
                valueString: question,
              },
              {
                url: conditionObj.answer,
                valueString: answerString ?? answerDate,
                valueBoolean: answerBoolean,
                valueInteger: answerInteger !== undefined ? parseInt(`${answerInteger}`) : undefined,
              },
              ...extras,
            ],
          };
        })
      );
      newOne.extension = extension;
      const textChange = textChanges[i.linkId];
      if (textChanges !== undefined) {
        newOne.text = textChange;
      }
      return newOne;
    }
    return {
      ...i,
    };
  });
};

const resetRequired = (items: QuestionnaireItem[], linkIds: string[], required: boolean): QuestionnaireItem[] => {
  return items.map((i) => {
    if (linkIds.includes(i.linkId)) {
      const newOne = { ...i };
      newOne.required = required;
      return newOne;
    }
    return {
      ...i,
    };
  });
};

const PAGE_ONE_ITEMS = (BASE_QUESTIONNAIRE.item ?? [])[0].item ?? [];

describe('Conditional logic', () => {
  describe('enableWhen tests', () => {
    it('enabled when single enableWhen condition is true - boolean', () => {
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(PAGE_ONE_ITEMS, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: true }],
      };
      const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      const enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('not enabled when single enableWhen condition is false - boolean', () => {
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(PAGE_ONE_ITEMS, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: false }],
      };
      const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      const enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(false);
    });

    it('enabled when single enableWhen condition is false - boolean', () => {
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(PAGE_ONE_ITEMS ?? [], []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: false }],
      };
      const conditionalBoolFalseItem = structuredItems.find((i) => i.linkId === 'enable-when-conditional-bool-false');
      expect(conditionalBoolFalseItem).toBeDefined();
      assert(conditionalBoolFalseItem != undefined);
      const enabled = evalEnableWhen(conditionalBoolFalseItem, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('enabled when single enableWhen condition is not false - boolean', () => {
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(PAGE_ONE_ITEMS, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: true }],
      };
      const conditionalBoolTrueItem = structuredItems.find(
        (i) => i.linkId === 'enable-when-conditional-bool-not-false'
      );
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      let enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(true);

      formValues[KEYS.triggers.boolean.primary] = undefined;
      expect(formValues[KEYS.triggers.boolean.primary]).toBeUndefined();
      enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('enabled when single enableWhen condition is not true - boolean', () => {
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(PAGE_ONE_ITEMS ?? [], []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: false }],
      };
      const conditionalBoolFalseItem = structuredItems.find(
        (i) => i.linkId === 'enable-when-conditional-bool-not-true'
      );
      expect(conditionalBoolFalseItem).toBeDefined();
      assert(conditionalBoolFalseItem != undefined);
      let enabled = evalEnableWhen(conditionalBoolFalseItem, structuredItems, formValues);
      expect(enabled).toBe(true);

      formValues[KEYS.triggers.boolean.primary] = undefined;
      expect(formValues[KEYS.triggers.boolean.primary]).toBeUndefined();
      enabled = evalEnableWhen(conditionalBoolFalseItem, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('enabled when any of multiple enableWhen conditions is true - boolean', () => {
      const altered = setEnableBehavior(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.bool.primaryTrue],
        [
          {
            question: 'conditional-bool-question-secondary',
            operator: '=',
            answerBoolean: true,
          },
        ],
        'any'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: false }],
      };
      formValues['conditional-bool-question-secondary'] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: true }],
      };
      const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      const enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('not enabled when no enableWhen condition is true and enabled behavior is "any" - boolean', () => {
      const altered = setEnableBehavior(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.bool.primaryTrue],
        [
          {
            question: 'conditional-bool-question-secondary',
            operator: '=',
            answerBoolean: true,
          },
        ],
        'any'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: false }],
      };
      formValues[KEYS.triggers.boolean.secondary] = {
        linkId: KEYS.triggers.boolean.secondary,
        answer: [{ valueBoolean: false }],
      };
      const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      const enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(false);
    });

    it('not enabled when enabled behavior = "all" and some codition item is false - boolean', () => {
      const altered = setEnableBehavior(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.bool.primaryTrue],
        [
          {
            question: 'conditional-bool-question-secondary',
            operator: '=',
            answerBoolean: true,
          },
        ],
        'all'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: false }],
      };
      formValues[KEYS.triggers.boolean.secondary] = {
        linkId: KEYS.triggers.boolean.secondary,
        answer: [{ valueBoolean: true }],
      };
      const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      const enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(false);
    });
    it('enabled when all enableWhen conditions are true and enabled behavior is "all" - boolean', () => {
      const altered = setEnableBehavior(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.bool.primaryTrue],
        [
          {
            question: 'conditional-bool-question-secondary',
            operator: '=',
            answerBoolean: true,
          },
        ],
        'all'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: true }],
      };
      formValues[KEYS.triggers.boolean.secondary] = {
        linkId: KEYS.triggers.boolean.secondary,
        answer: [{ valueBoolean: true }],
      };
      const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      const enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('enabled when single enableWhen condition is true - string', () => {
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(PAGE_ONE_ITEMS, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'foo' }],
      };
      const conditionalFooQuestion = structuredItems.find(
        (i) => i.linkId === 'enable-when-conditional-string-question-foo'
      );
      expect(conditionalFooQuestion).toBeDefined();
      assert(conditionalFooQuestion != undefined);
      const enabled = evalEnableWhen(conditionalFooQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });
    it('not enabled when single enableWhen condition is true - string', () => {
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(PAGE_ONE_ITEMS, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'bar' }],
      };
      const conditionalFooQuestion = structuredItems.find(
        (i) => i.linkId === 'enable-when-conditional-string-question-foo'
      );
      expect(conditionalFooQuestion).toBeDefined();
      assert(conditionalFooQuestion != undefined);
      const enabled = evalEnableWhen(conditionalFooQuestion, structuredItems, formValues);
      expect(enabled).toBe(false);
    });
    it('enabled when single enableWhen condition is false - string', () => {
      const altered = resetEnableWhenConditions(
        PAGE_ONE_ITEMS,
        ['enable-when-conditional-string-question-foo'],
        [
          {
            operator: '!=',
            question: KEYS.triggers.string.primary,
            answerString: 'bar',
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'foo' }],
      };
      const conditionalFooQuestion = structuredItems.find(
        (i) => i.linkId === 'enable-when-conditional-string-question-foo'
      );
      expect(conditionalFooQuestion).toBeDefined();
      assert(conditionalFooQuestion != undefined);
      const enabled = evalEnableWhen(conditionalFooQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });
    it('enabled when single enableWhen condition is not true - string', () => {
      const altered = resetEnableWhenConditions(
        PAGE_ONE_ITEMS,
        ['enable-when-conditional-string-question-foo'],
        [
          {
            operator: '!=',
            question: KEYS.triggers.string.primary,
            answerString: 'bar',
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = undefined;
      const conditionalFooQuestion = structuredItems.find(
        (i) => i.linkId === 'enable-when-conditional-string-question-foo'
      );
      expect(conditionalFooQuestion).toBeDefined();
      assert(conditionalFooQuestion != undefined);
      const enabled = evalEnableWhen(conditionalFooQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });
    it('not enabled when single enableWhen condition question undefined - string', () => {
      const altered = resetEnableWhenConditions(
        PAGE_ONE_ITEMS,
        ['enable-when-conditional-string-question-foo'],
        [
          {
            operator: '=',
            question: KEYS.triggers.string.primary,
            answerString: 'foo',
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = undefined;
      const conditionalFooQuestion = structuredItems.find(
        (i) => i.linkId === 'enable-when-conditional-string-question-foo'
      );
      expect(conditionalFooQuestion).toBeDefined();
      assert(conditionalFooQuestion != undefined);
      const enabled = evalEnableWhen(conditionalFooQuestion, structuredItems, formValues);
      expect(enabled).toBe(false);
    });

    it('enabled when any of multiple enableWhen conditions is true - string', () => {
      const altered = setEnableBehavior(
        PAGE_ONE_ITEMS,
        ['enable-when-conditional-string-question-foo'],
        [
          {
            question: KEYS.triggers.string.secondary,
            operator: '=',
            answerString: 'foo',
          },
        ],
        'any'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'bar' }],
      };
      formValues[KEYS.triggers.boolean.secondary] = {
        linkId: KEYS.triggers.boolean.secondary,
        answer: [{ valueString: 'foo' }],
      };
      const conditionalBoolTrueItem = structuredItems.find(
        (i) => i.linkId === 'enable-when-conditional-string-question-foo'
      );
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      const enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('not enabled when no enableWhen condition is true and enabled behavior is "any" - string', () => {
      const altered = setEnableBehavior(
        PAGE_ONE_ITEMS,
        ['enable-when-conditional-string-question-foo'],
        [
          {
            question: KEYS.triggers.string.secondary,
            operator: '=',
            answerString: 'foo',
          },
        ],
        'any'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'bar' }],
      };
      formValues[KEYS.triggers.string.secondary] = {
        linkId: KEYS.triggers.string.secondary,
        answer: [{ valueString: 'food' }],
      };
      const conditionalBoolTrueItem = structuredItems.find(
        (i) => i.linkId === 'enable-when-conditional-string-question-foo'
      );
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      const enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(false);
    });

    it('not enabled when enabled behavior = "all" and some condition item is false - boolean', () => {
      const altered = setEnableBehavior(
        PAGE_ONE_ITEMS,
        ['enable-when-conditional-string-question-foo'],
        [
          {
            question: KEYS.triggers.string.secondary,
            operator: '=',
            answerString: 'foo',
          },
        ],
        'all'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'bar' }],
      };
      formValues[KEYS.triggers.string.secondary] = {
        linkId: KEYS.triggers.string.secondary,
        answer: [{ valueString: 'foo' }],
      };
      const conditionalBoolTrueItem = structuredItems.find(
        (i) => i.linkId === 'enable-when-conditional-string-question-foo'
      );
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      const enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(false);
    });
    it('enabled when all enableWhen conditions are true and enabled behavior is "all" - boolean', () => {
      const altered = setEnableBehavior(
        PAGE_ONE_ITEMS,
        ['enable-when-conditional-string-question-foo'],
        [
          {
            question: KEYS.triggers.string.secondary,
            operator: '=',
            answerString: 'foo',
          },
        ],
        'all'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'foo' }],
      };
      formValues[KEYS.triggers.string.secondary] = {
        linkId: KEYS.triggers.string.secondary,
        answer: [{ valueString: 'foo' }],
      };
      const conditionalBoolTrueItem = structuredItems.find(
        (i) => i.linkId === 'enable-when-conditional-string-question-foo'
      );
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      const enabled = evalEnableWhen(conditionalBoolTrueItem, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('enabled when single enableWhen condition is true - date, answerInteger, over', () => {
      const altered = setEnableBehavior(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.over],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '>',
            answerInteger: 18,
          },
        ],
        'all'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: '2001-01-01' }],
      };
      const conditionalOverQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.over);
      expect(conditionalOverQuestion).toBeDefined();
      assert(conditionalOverQuestion != undefined);
      const enabled = evalEnableWhen(conditionalOverQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('enabled when single enableWhen condition is true - date, answerInteger, under', () => {
      const altered = setEnableBehavior(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.under],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '<',
            answerInteger: 18,
          },
        ],
        'all'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: '2021-01-01' }],
      };
      const conditionalUnderQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.under);
      expect(conditionalUnderQuestion).toBeDefined();
      assert(conditionalUnderQuestion != undefined);
      const enabled = evalEnableWhen(conditionalUnderQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('enabled when single enableWhen condition is true - date, answerInteger, exactly', () => {
      const altered = setEnableBehavior(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '=',
            answerInteger: 18,
          },
        ],
        'all'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      const conditionalValue = DateTime.now().startOf('day').minus({ years: 18 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalExactlyQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalExactlyQuestion).toBeDefined();
      assert(conditionalExactlyQuestion != undefined);
      const enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('enabled when single enableWhen condition is true - date, answerInteger, equal or over', () => {
      const altered = resetEnableWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '>=',
            answerInteger: 18,
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      const conditionalValue = DateTime.now().startOf('day').minus({ years: 18 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalExactlyQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalExactlyQuestion).toBeDefined();
      assert(conditionalExactlyQuestion != undefined);
      let enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);

      const conditionalValue2 = DateTime.now().startOf('day').minus({ years: 30 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue2 }],
      };
      enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });
    it('enabled when single enableWhen condition is true - date, answerInteger, equal or under', () => {
      const altered = resetEnableWhenConditions(
        [...PAGE_ONE_ITEMS],
        [KEYS.dependents.date.exactly],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '<=',
            answerInteger: 18,
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = [...BASE_FORM_VALUES].reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      const conditionalValue = DateTime.now().startOf('day').minus({ years: 18 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalExactlyQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalExactlyQuestion).toBeDefined();
      assert(conditionalExactlyQuestion != undefined);
      let enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);

      const conditionalValue2 = DateTime.now().startOf('day').minus({ years: 3 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue2 }],
      };
      enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('enabled when multiple enableWhen conditions all true - date, answerInteger', () => {
      const altered = resetEnableWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '<=',
            answerInteger: 18,
          },
          {
            question: KEYS.triggers.date.primary,
            operator: '>=',
            answerInteger: 18,
          },
          {
            question: KEYS.triggers.date.primary,
            operator: '=',
            answerInteger: 18,
          },
        ],
        'all'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);

      const conditionalValue = DateTime.now().startOf('day').minus({ years: 18 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalExactlyQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalExactlyQuestion).toBeDefined();
      assert(conditionalExactlyQuestion != undefined);
      const enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('enabled when one of multiple enableWhen conditions true and behavior is "any" - date, answerInteger', () => {
      const altered = resetEnableWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '<=',
            answerInteger: 18,
          },
          {
            question: KEYS.triggers.date.primary,
            operator: '>=',
            answerInteger: 18,
          },
          {
            question: KEYS.triggers.date.primary,
            operator: '=',
            answerInteger: 18,
          },
        ],
        'any'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);

      const conditionalValue = DateTime.now().startOf('day').minus({ years: 30 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalExactlyQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalExactlyQuestion).toBeDefined();
      assert(conditionalExactlyQuestion != undefined);
      const enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('not enabled when none of multiple enableWhen conditions are true and behavior is "any" - date, answerInteger', () => {
      const altered = resetEnableWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '<=',
            answerInteger: 18,
          },
          {
            question: KEYS.triggers.date.primary,
            operator: '=',
            answerInteger: 18,
          },
        ],
        'any'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);

      const conditionalValue = DateTime.now().startOf('day').minus({ years: 30 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalExactlyQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalExactlyQuestion).toBeDefined();
      assert(conditionalExactlyQuestion != undefined);
      const enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(false);
    });

    it('not enabled when one of multiple enableWhen conditions is not true and behavior is "any" - date, answerInteger', () => {
      const altered = resetEnableWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '>=',
            answerInteger: 18,
          },
          {
            question: KEYS.triggers.date.secondary,
            operator: '=',
            answerInteger: 18,
          },
        ],
        'all'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);

      const conditionalValue = DateTime.now().startOf('day').minus({ years: 30 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalExactlyQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalExactlyQuestion).toBeDefined();
      assert(conditionalExactlyQuestion != undefined);
      const enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(false);
    });

    it('enabled when single enableWhen condition is satisfied - date, answerDate', () => {
      const altered = resetEnableWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '>=',
            answerDate: '2021-01-01',
          },
        ],
        'any'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);

      const conditionalValue = DateTime.now().startOf('day').minus({ years: 30 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalExactlyQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalExactlyQuestion).toBeDefined();
      assert(conditionalExactlyQuestion != undefined);
      const enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('enabled when single enableWhen condition is satisfied - date, answerDate, equal', () => {
      const altered = resetEnableWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '=',
            answerDate: '2021-01-01',
          },
        ],
        'any'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);

      const conditionalValue = DateTime.fromISO('2021-01-01');
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalExactlyQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalExactlyQuestion).toBeDefined();
      assert(conditionalExactlyQuestion != undefined);
      const enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(true);
    });

    it('not enabled when single enableWhen condition is not satisfied - date, answerDate', () => {
      const altered = resetEnableWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            question: KEYS.triggers.date.primary,
            operator: '<=',
            answerDate: '2021-01-01',
          },
        ],
        'any'
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);

      const conditionalValue = DateTime.now().startOf('day').minus({ years: 30 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalExactlyQuestion = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalExactlyQuestion).toBeDefined();
      assert(conditionalExactlyQuestion != undefined);
      const enabled = evalEnableWhen(conditionalExactlyQuestion, structuredItems, formValues);
      expect(enabled).toBe(false);
    });
  });
  describe('requireWhen tests', () => {
    it('required when requireWhen condition is true - boolean', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.bool.primaryTrue],
        [
          {
            operator: '=',
            question: KEYS.triggers.boolean.primary,
            answerBoolean: true,
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: true }],
      };
      expect(formValues[KEYS.triggers.boolean.primary]?.answer?.[0]?.valueBoolean).toBe(true);
      const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      expect(conditionalBoolTrueItem.requireWhen).toBeDefined();
      expect(conditionalBoolTrueItem.requireWhen?.answerBoolean).toBeDefined();
      expect(conditionalBoolTrueItem.requireWhen?.operator).toBe('=');
      expect(conditionalBoolTrueItem.requireWhen?.question).toBe(KEYS.triggers.boolean.primary);
      const required = evalRequired(conditionalBoolTrueItem, formValues);
      expect(required).toBe(true);
    });

    it('required when requireWhen condition is false - boolean', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.bool.primaryTrue],
        [
          {
            operator: '=',
            question: KEYS.triggers.boolean.primary,
            answerBoolean: false,
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = {
        linkId: KEYS.triggers.boolean.primary,
        answer: [{ valueBoolean: false }],
      };
      expect(formValues[KEYS.triggers.boolean.primary]?.answer?.[0]?.valueBoolean).toBe(false);
      const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      expect(conditionalBoolTrueItem.requireWhen).toBeDefined();
      expect(conditionalBoolTrueItem.requireWhen?.answerBoolean).toBeDefined();
      expect(conditionalBoolTrueItem.requireWhen?.operator).toBe('=');
      expect(conditionalBoolTrueItem.requireWhen?.question).toBe(KEYS.triggers.boolean.primary);
      const required = evalRequired(conditionalBoolTrueItem, formValues);
      expect(required).toBe(true);
    });

    it('required when requireWhen condition is not false - boolean', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.bool.primaryTrue],
        [
          {
            operator: '!=',
            question: KEYS.triggers.boolean.primary,
            answerBoolean: false,
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = undefined;
      const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      expect(conditionalBoolTrueItem.requireWhen?.question).toBe(KEYS.triggers.boolean.primary);
      const required = evalRequired(conditionalBoolTrueItem, formValues);
      expect(required).toBe(true);
    });

    it('required when requireWhen condition is not true - boolean', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.bool.primaryTrue],
        [
          {
            operator: '!=',
            question: KEYS.triggers.boolean.primary,
            answerBoolean: true,
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.boolean.primary] = undefined;
      const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
      expect(conditionalBoolTrueItem).toBeDefined();
      assert(conditionalBoolTrueItem != undefined);
      expect(conditionalBoolTrueItem.requireWhen?.question).toBe(KEYS.triggers.boolean.primary);
      const required = evalRequired(conditionalBoolTrueItem, formValues);
      expect(required).toBe(true);
    });

    it('required when requireWhen condition is true - string', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.string],
        [
          {
            operator: '=',
            question: KEYS.triggers.string.primary,
            answerString: 'foo',
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'foo' }],
      };
      expect(formValues[KEYS.triggers.string.primary]?.answer?.[0]?.valueString).toBe('foo');
      const conditionalStringItem = structuredItems.find((i) => i.linkId === KEYS.dependents.string);
      expect(conditionalStringItem).toBeDefined();
      assert(conditionalStringItem != undefined);
      expect(conditionalStringItem.requireWhen?.question).toBe(KEYS.triggers.string.primary);
      const required = evalRequired(conditionalStringItem, formValues);
      expect(required).toBe(true);
    });

    it('required when requireWhen condition is false - string', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.string],
        [
          {
            operator: '!=',
            question: KEYS.triggers.string.primary,
            answerString: 'foo',
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'bar' }],
      };
      expect(formValues[KEYS.triggers.string.primary]?.answer?.[0]?.valueString).toBe('bar');
      const conditionalStringItem = structuredItems.find((i) => i.linkId === KEYS.dependents.string);
      expect(conditionalStringItem).toBeDefined();
      assert(conditionalStringItem != undefined);
      expect(conditionalStringItem.requireWhen?.question).toBe(KEYS.triggers.string.primary);
      let required = evalRequired(conditionalStringItem, formValues);
      expect(required).toBe(true);
      formValues[KEYS.triggers.string.primary] = undefined;
      required = evalRequired(conditionalStringItem, formValues);
      expect(required).toBe(true);
    });

    it('not required when requireWhen condition is not satisfied - string', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.string],
        [
          {
            operator: '!=',
            question: KEYS.triggers.string.primary,
            answerString: 'foo',
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'foo' }],
      };
      expect(formValues[KEYS.triggers.string.primary]?.answer?.[0]?.valueString).toBe('foo');
      const conditionalStringItem = structuredItems.find((i) => i.linkId === KEYS.dependents.string);
      expect(conditionalStringItem).toBeDefined();
      assert(conditionalStringItem != undefined);
      expect(conditionalStringItem.requireWhen?.question).toBe(KEYS.triggers.string.primary);
      const required = evalRequired(conditionalStringItem, formValues);
      expect(required).toBe(false);
    });

    it('required when required = true, even if conditional required is false - string', () => {
      let altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.string],
        [
          {
            operator: '!=',
            question: KEYS.triggers.string.primary,
            answerString: 'foo',
          },
        ]
      );
      altered = resetRequired(altered, [KEYS.dependents.string], true);
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'foo' }],
      };
      expect(formValues[KEYS.triggers.string.primary]?.answer?.[0]?.valueString).toBe('foo');
      const conditionalStringItem = structuredItems.find((i) => i.linkId === KEYS.dependents.string);
      expect(conditionalStringItem).toBeDefined();
      assert(conditionalStringItem != undefined);
      expect(conditionalStringItem.requireWhen?.question).toBe(KEYS.triggers.string.primary);
      const required = evalRequired(conditionalStringItem, formValues);
      expect(required).toBe(true);
    });

    it('required when conditional required is true even if required prop = false - string', () => {
      let altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.string],
        [
          {
            operator: '=',
            question: KEYS.triggers.string.primary,
            answerString: 'foo',
          },
        ]
      );
      altered = resetRequired(altered, [KEYS.dependents.string], false);
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'foo' }],
      };
      expect(formValues[KEYS.triggers.string.primary]?.answer?.[0]?.valueString).toBe('foo');
      const conditionalStringItem = structuredItems.find((i) => i.linkId === KEYS.dependents.string);
      expect(conditionalStringItem).toBeDefined();
      assert(conditionalStringItem != undefined);
      expect(conditionalStringItem.requireWhen?.question).toBe(KEYS.triggers.string.primary);
      const required = evalRequired(conditionalStringItem, formValues);
      expect(required).toBe(true);
    });

    it('required when requireWhen condition is true - date, answerInteger, over', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.over],
        [
          {
            operator: '>',
            question: KEYS.triggers.date.primary,
            answerInteger: 18,
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: '2001-01-01' }],
      };
      expect(formValues[KEYS.triggers.date.primary]?.answer?.[0]?.valueString).toBe('2001-01-01');
      const conditionalDateItem = structuredItems.find((i) => i.linkId === KEYS.dependents.date.over);
      expect(conditionalDateItem).toBeDefined();
      assert(conditionalDateItem != undefined);
      expect(conditionalDateItem.requireWhen).toBeDefined();
      const required = evalRequired(conditionalDateItem, formValues);
      expect(required).toBe(true);
    });
    it('required when requireWhen condition is true - date, answerInteger, under', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.under],
        [
          {
            operator: '<',
            question: KEYS.triggers.date.primary,
            answerInteger: 18,
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: '2019-01-01' }],
      };
      expect(formValues[KEYS.triggers.date.primary]?.answer?.[0]?.valueString).toBe('2019-01-01');
      const conditionalDateItem = structuredItems.find((i) => i.linkId === KEYS.dependents.date.under);
      expect(conditionalDateItem).toBeDefined();
      assert(conditionalDateItem != undefined);
      expect(conditionalDateItem.requireWhen).toBeDefined();
      const required = evalRequired(conditionalDateItem, formValues);
      expect(required).toBe(true);
    });

    it('required when requireWhen condition is true - date, answerInteger, exactly', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            operator: '=',
            question: KEYS.triggers.date.primary,
            answerInteger: 18,
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      const conditionalValue = DateTime.now().startOf('day').minus({ years: 18 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalDateItem = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalDateItem).toBeDefined();
      assert(conditionalDateItem != undefined);
      expect(conditionalDateItem.requireWhen).toBeDefined();
      const required = evalRequired(conditionalDateItem, formValues);
      expect(required).toBe(true);
    });

    it('required when requireWhen condition is true - date, answerInteger, equal or over', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            operator: '>=',
            question: KEYS.triggers.date.primary,
            answerInteger: 18,
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      const conditionalValue = DateTime.now().startOf('day').minus({ years: 18 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalDateItem = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalDateItem).toBeDefined();
      assert(conditionalDateItem != undefined);
      expect(conditionalDateItem.requireWhen).toBeDefined();
      let required = evalRequired(conditionalDateItem, formValues);
      expect(required).toBe(true);
      const conditionalValue2 = DateTime.now().startOf('day').minus({ years: 48 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue2 }],
      };
      required = evalRequired(conditionalDateItem, formValues);
      expect(required).toBe(true);
    });

    it('required when requireWhen condition is true - date, answerInteger, equal or under', () => {
      const altered = resetRequireWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.date.exactly],
        [
          {
            operator: '<=',
            question: KEYS.triggers.date.primary,
            answerInteger: 18,
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      const conditionalValue = DateTime.now().startOf('day').minus({ years: 18 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue }],
      };
      const conditionalDateItem = structuredItems.find((i) => i.linkId === KEYS.dependents.date.exactly);
      expect(conditionalDateItem).toBeDefined();
      assert(conditionalDateItem != undefined);
      expect(conditionalDateItem.requireWhen).toBeDefined();
      let required = evalRequired(conditionalDateItem, formValues);
      expect(required).toBe(true);
      const conditionalValue2 = DateTime.now().startOf('day').minus({ years: 8 }).toFormat(DOB_DATE_FORMAT);
      formValues[KEYS.triggers.date.primary] = {
        linkId: KEYS.triggers.date.primary,
        answer: [{ valueString: conditionalValue2 }],
      };
      required = evalRequired(conditionalDateItem, formValues);
      expect(required).toBe(true);
    });

    describe('filterWhen tests', () => {
      it('filter when filterWhen condition is true - boolean', () => {
        const altered = resetFilterWhenConditions(
          PAGE_ONE_ITEMS,
          [KEYS.dependents.bool.primaryTrue],
          [
            {
              operator: '=',
              question: KEYS.triggers.boolean.primary,
              answerBoolean: true,
            },
          ]
        );
        const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
        const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
          accum[item.linkId] = { ...item };
          return accum;
        }, {} as any);
        formValues[KEYS.triggers.boolean.primary] = {
          linkId: KEYS.triggers.boolean.primary,
          answer: [{ valueBoolean: true }],
        };
        expect(formValues[KEYS.triggers.boolean.primary]?.answer?.[0]?.valueBoolean).toBe(true);
        const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
        expect(conditionalBoolTrueItem).toBeDefined();
        assert(conditionalBoolTrueItem != undefined);
        expect(conditionalBoolTrueItem.filterWhen).toBeDefined();
        expect(conditionalBoolTrueItem.filterWhen?.answerBoolean).toBeDefined();
        expect(conditionalBoolTrueItem.filterWhen?.operator).toBe('=');
        expect(conditionalBoolTrueItem.filterWhen?.question).toBe(KEYS.triggers.boolean.primary);
        formValues[KEYS.dependents.bool.primaryTrue] = {
          linkId: KEYS.dependents.bool.primaryTrue,
          answer: [{ valueString: 'I better get filtered!' }],
        };
        const newValues = recursiveGroupTransform(structuredItems, Object.values(formValues));
        expect(Array.isArray(newValues)).toBe(true);
        const triggerAnswer = newValues.find((obj: any) => obj.linkId === KEYS.triggers.boolean.primary);
        const filteredAnswer = newValues.find((obj: any) => obj.linkId === KEYS.dependents.bool.primaryTrue);
        expect(triggerAnswer.answer?.[0]?.valueBoolean).toBe(true);
        // when filtered, the answer property on the entry is set to undefined, but the object with its linkId remains
        expect(filteredAnswer).toBeDefined();
        expect(filteredAnswer?.answer).toBeUndefined();
      });

      it('filter when filterWhen condition is true - string', () => {
        const altered = resetFilterWhenConditions(
          PAGE_ONE_ITEMS,
          [KEYS.dependents.string],
          [
            {
              operator: '=',
              question: KEYS.triggers.string.primary,
              answerString: 'foo',
            },
          ]
        );
        const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
        const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
          accum[item.linkId] = { ...item };
          return accum;
        }, {} as any);
        formValues[KEYS.triggers.string.primary] = {
          linkId: KEYS.triggers.string.primary,
          answer: [{ valueString: 'foo' }],
        };
        expect(formValues[KEYS.triggers.string.primary]?.answer?.[0]?.valueString).toBe('foo');
        const conditionalStringItem = structuredItems.find((i) => i.linkId === KEYS.dependents.string);
        expect(conditionalStringItem).toBeDefined();
        assert(conditionalStringItem != undefined);
        expect(conditionalStringItem.filterWhen).toBeDefined();
        expect(conditionalStringItem.filterWhen?.answerString).toBeDefined();
        expect(conditionalStringItem.filterWhen?.operator).toBe('=');
        expect(conditionalStringItem.filterWhen?.question).toBe(KEYS.triggers.string.primary);
        formValues[KEYS.dependents.string] = {
          linkId: KEYS.dependents.string,
          answer: [{ valueString: 'I better get filtered!' }],
        };
        const newValues = recursiveGroupTransform(structuredItems, Object.values(formValues));
        expect(Array.isArray(newValues)).toBe(true);
        const triggerAnswer = newValues.find((obj: any) => obj.linkId === KEYS.triggers.string.primary);
        const filteredAnswer = newValues.find((obj: any) => obj.linkId === KEYS.dependents.string);
        expect(triggerAnswer.answer?.[0]?.valueString).toBe('foo');
        // when filtered, the answer property on the entry is set to undefined, but the object with its linkId remains
        expect(filteredAnswer).toBeDefined();
        expect(filteredAnswer?.answer).toBeUndefined();
      });

      it('filter when filterWhen condition is true - date, answerInteger', () => {
        const altered = resetFilterWhenConditions(
          PAGE_ONE_ITEMS,
          [KEYS.dependents.date.over],
          [
            {
              operator: '>=',
              question: KEYS.triggers.date.primary,
              answerInteger: 18,
            },
          ]
        );
        const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
        const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
          accum[item.linkId] = { ...item };
          return accum;
        }, {} as any);
        formValues[KEYS.triggers.date.primary] = {
          linkId: KEYS.triggers.date.primary,
          answer: [{ valueString: '2001-01-01' }],
        };
        expect(formValues[KEYS.triggers.date.primary]?.answer?.[0]?.valueString).toBe('2001-01-01');
        const conditionalDateItem = structuredItems.find((i) => i.linkId === KEYS.dependents.date.over);
        expect(conditionalDateItem).toBeDefined();
        assert(conditionalDateItem != undefined);
        expect(conditionalDateItem.filterWhen).toBeDefined();
        expect(conditionalDateItem.filterWhen?.answerInteger).toBeDefined();
        expect(conditionalDateItem.filterWhen?.operator).toBe('>=');
        expect(conditionalDateItem.filterWhen?.question).toBe(KEYS.triggers.date.primary);
        formValues[KEYS.dependents.date.over] = {
          linkId: KEYS.dependents.string,
          answer: [{ valueString: '1991-08-06' }],
        };
        const newValues = recursiveGroupTransform(structuredItems, Object.values(formValues));
        expect(Array.isArray(newValues)).toBe(true);
        const triggerAnswer = newValues.find((obj: any) => obj.linkId === KEYS.triggers.date.primary);
        const filteredAnswer = newValues.find((obj: any) => obj.linkId === KEYS.dependents.date.over);
        expect(triggerAnswer.answer?.[0]?.valueString).toBe('2001-01-01');
        // when filtered, the answer property on the entry is set to undefined, but the object with its linkId remains
        expect(filteredAnswer).toBeDefined();
        expect(filteredAnswer?.answer).toBeUndefined();
      });
    });

    it('filter when filterWhen condition is false = no filtering - string', () => {
      const altered = resetFilterWhenConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.string],
        [
          {
            operator: '=',
            question: KEYS.triggers.string.primary,
            answerString: 'foo',
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'bar' }],
      };
      expect(formValues[KEYS.triggers.string.primary]?.answer?.[0]?.valueString).toBe('bar');
      const conditionalStringItem = structuredItems.find((i) => i.linkId === KEYS.dependents.string);
      expect(conditionalStringItem).toBeDefined();
      assert(conditionalStringItem != undefined);
      expect(conditionalStringItem.filterWhen).toBeDefined();
      expect(conditionalStringItem.filterWhen?.answerString).toBeDefined();
      expect(conditionalStringItem.filterWhen?.operator).toBe('=');
      expect(conditionalStringItem.filterWhen?.question).toBe(KEYS.triggers.string.primary);
      formValues[KEYS.dependents.string] = {
        linkId: KEYS.dependents.string,
        answer: [{ valueString: 'I better NOT get filtered!' }],
      };
      const newValues = recursiveGroupTransform(structuredItems, Object.values(formValues));
      expect(Array.isArray(newValues)).toBe(true);
      const triggerAnswer = newValues.find((obj: any) => obj.linkId === KEYS.triggers.string.primary);
      const unfilteredAnswer = newValues.find((obj: any) => obj.linkId === KEYS.dependents.string);
      expect(triggerAnswer.answer?.[0]?.valueString).toBe('bar');
      // when filtered, the answer property on the entry is set to undefined, but the object with its linkId remains
      expect(unfilteredAnswer).toBeDefined();
      expect(unfilteredAnswer?.answer).toBeDefined();
      expect(unfilteredAnswer?.answer?.[0]?.valueString).toBe('I better NOT get filtered!');
    });
  });

  describe('textWhen tests', () => {
    // at this point the tests of the evaluation logic get a bit repetitive, so this single test should be sufficient for this feature
    // given the redundant coverage of other implementations in the other conditional tests
    it('item text changes as expected when textWhen condition is satisfied - string', () => {
      const altered = resetTextWhenConditions(
        PAGE_ONE_ITEMS,
        { [KEYS.dependents.string]: 'This is the default text a user sees above my input' },
        [
          {
            operator: '=',
            question: KEYS.triggers.string.primary,
            answerString: 'foo',
            substituteText: 'If this text is shown it means my condition was satisfied!',
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'bar' }],
      };
      expect(formValues[KEYS.triggers.string.primary]?.answer?.[0]?.valueString).toBe('bar');
      const conditionalStringItem = structuredItems.find((i) => i.linkId === KEYS.dependents.string);
      expect(conditionalStringItem).toBeDefined();
      assert(conditionalStringItem != undefined);
      expect(conditionalStringItem.textWhen).toBeDefined();
      expect(conditionalStringItem.textWhen?.answerString).toBeDefined();
      expect(conditionalStringItem.textWhen?.operator).toBe('=');
      expect(conditionalStringItem.textWhen?.question).toBe(KEYS.triggers.string.primary);
      expect(conditionalStringItem.textWhen?.substituteText).toBe(
        'If this text is shown it means my condition was satisfied!'
      );
      let itemText = evalItemText(conditionalStringItem, formValues);
      expect(itemText).toBe('This is the default text a user sees above my input');
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'foo' }],
      };
      itemText = evalItemText(conditionalStringItem, formValues);
      expect(itemText).toBe('If this text is shown it means my condition was satisfied!');
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'bar' }],
      };
      itemText = evalItemText(conditionalStringItem, formValues);
      expect(itemText).toBe('This is the default text a user sees above my input');
    });
  });

  describe('complexValidationTrigger tests', () => {
    // at this point the tests of the evaluation logic get a bit repetitive, so this single test should be sufficient for this feature
    // given the redundant coverage of other implementations in the other conditional tests
    it('complex validation triggered when condition is satisfied - string', () => {
      const altered = resetComplexValidationConditions(
        PAGE_ONE_ITEMS,
        [KEYS.dependents.string],
        [
          {
            operator: '=',
            question: KEYS.triggers.string.primary,
            answerString: 'foo',
          },
        ]
      );
      const structuredItems = mapQuestionnaireAndValueSetsToItemsList(altered, []);
      const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
        accum[item.linkId] = { ...item };
        return accum;
      }, {} as any);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'bar' }],
      };
      expect(formValues[KEYS.triggers.string.primary]?.answer?.[0]?.valueString).toBe('bar');
      const conditionalStringItem = structuredItems.find((i) => i.linkId === KEYS.dependents.string);
      expect(conditionalStringItem).toBeDefined();
      assert(conditionalStringItem != undefined);
      expect(conditionalStringItem.complexValidation).toBeDefined();
      expect(conditionalStringItem.complexValidation?.type).toBe('insurance prevalidation');
      expect(conditionalStringItem.complexValidation?.triggerWhen).toBeDefined();
      expect(conditionalStringItem.complexValidation?.triggerWhen?.operator).toBe('=');
      expect(conditionalStringItem.complexValidation?.triggerWhen?.question).toBe(KEYS.triggers.string.primary);
      let triggerEval = evalComplexValidationTrigger(conditionalStringItem, formValues);
      expect(triggerEval).toBeDefined();
      expect(triggerEval).toBe(false);
      formValues[KEYS.triggers.string.primary] = {
        linkId: KEYS.triggers.string.primary,
        answer: [{ valueString: 'foo' }],
      };
      triggerEval = evalComplexValidationTrigger(conditionalStringItem, formValues);
      expect(triggerEval).toBeDefined();
      expect(triggerEval).toBe(true);
    });
  });
});

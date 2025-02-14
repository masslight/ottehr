import {
  QuestionnaireItem,
  QuestionnaireItemEnableWhen,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DATE_ERROR_MESSAGE,
  IntakeQuestionnaireItem,
  isoDateRegex,
  emailRegex,
  emojiRegex,
  phoneRegex,
  pickFirstValueFromAnswerItem,
  zipRegex,
  QuestionnaireItemConditionDefinition,
} from 'utils';
import * as Yup from 'yup';

interface ValidatableQuestionnaireItem extends IntakeQuestionnaireItem {
  regex?: RegExp;
  regexError?: string;
  dateComponents?: { day: string; year: string; month: string };
}

// all this logic could be in an extension, but not sure it's worth the trouble
export const PHONE_NUMBER_FIELDS = [
  'patient-number',
  'guardian-number',
  'responsible-party-number',
  'pharmacy-phone',
  'pcp-number',
];
export const EMAIL_FIELDS = ['patient-email', 'guardian-email'];
export const ZIP_CODE_FIELDS = ['patient-zip'];
export const SIGNATURE_FIELDS = ['signature'];
export const FULL_ADDRESS_FIELDS = ['pharmacy-address'];

const makeReferenceValueSchema = (required: boolean): Yup.AnyObjectSchema => {
  if (required) {
    return Yup.object({
      reference: Yup.string().required('This field is required'),
      display: Yup.string().required('This field is required'),
    }).required('This field is required');
  }
  return Yup.object({
    reference: Yup.string(),
    display: Yup.string(),
  });
};

const makeValidatableItem = (
  item: IntakeQuestionnaireItem
): ValidatableQuestionnaireItem[] | ValidatableQuestionnaireItem => {
  // todo: add validation for date components
  let regex: RegExp | undefined;
  let regexError: string | undefined;

  // keeping these field checks for backwards compatibility for now
  // can just check item.dataType after 1.14 release
  if (PHONE_NUMBER_FIELDS.includes(item.linkId) || item.dataType === 'Phone Number') {
    regex = phoneRegex;
    regexError = 'Phone number must be 10 digits in the format (xxx) xxx-xxxx';
  }
  if (EMAIL_FIELDS.includes(item.linkId) || item.dataType === 'Email') {
    regex = emailRegex;
    regexError = 'Email is not valid';
  }
  if (ZIP_CODE_FIELDS.includes(item.linkId) || item.dataType === 'ZIP') {
    regex = zipRegex;
    regexError = 'ZIP Code must be 5 numbers';
  }

  return {
    ...item,
    regex,
    regexError,
  };
};

interface TrimAnswerOptions {
  returnUndefined: boolean;
}
const trimInvalidAnswersFromItem = (
  val: QuestionnaireResponseItem,
  options: TrimAnswerOptions = { returnUndefined: false }
): QuestionnaireResponseItem | null | undefined => {
  const answer: any = val.answer;
  const { returnUndefined } = options;
  if (answer == undefined) {
    return returnUndefined ? undefined : { ...val, answer: undefined };
  }
  if (answer?.[0] == undefined) {
    return returnUndefined ? undefined : { ...val, answer: undefined };
  } else {
    const obj = answer?.[0];
    if (typeof obj === 'object') {
      if (Object.keys(obj).length === 0) {
        return returnUndefined ? undefined : { ...val, answer: undefined };
      } else if (!Object.values(obj)?.[0]) {
        return returnUndefined ? undefined : { ...val, answer: undefined };
      }
    } else {
      return returnUndefined ? undefined : { ...val, answer: undefined };
    }
  }
  return val;
};

const wrapSchemaInSingleMemberArray = (
  schema: Yup.AnyObjectSchema,
  item: IntakeQuestionnaireItem,
  context: { required: boolean; filtered: boolean }
): Yup.AnySchema => {
  const { required, filtered } = context;
  const multi = item.acceptsMultipleAnswers;
  if (required && !filtered) {
    let answer = Yup.array().of(schema).length(1).required('This field is required');
    if (multi) {
      answer = Yup.array().of(schema).min(1).required('This field is required');
    }
    return Yup.object({
      linkId: Yup.string(),
      answer,
    })
      .transform((v) => (!v ? undefined : v))
      .required('This field is required');
  }
  return Yup.object({
    linkId: Yup.string().optional(),
    answer: multi ? Yup.array().of(schema).optional() : Yup.array().of(schema).max(1).optional(),
  })
    .transform((val: any) => {
      return trimInvalidAnswersFromItem(val, { returnUndefined: true });
    })
    .optional();
};

const schemaForItem = (item: ValidatableQuestionnaireItem, context: any): Yup.AnySchema => {
  const required = evalRequired(item, context);
  const filtered = evalFilterWhen(item, context);
  let schemaTemp: any | undefined = undefined;
  if (item.type === 'text' || item.type === 'string' || item.type === 'open-choice') {
    let stringSchema = Yup.string().trim().matches(emojiRegex, {
      message: 'Emojis are not a valid character',
      excludeEmptyString: true,
    });
    if (item.regex) {
      stringSchema = stringSchema.matches(item.regex, {
        message: item.regexError,
        excludeEmptyString: true,
      });
    }

    if (required) {
      stringSchema = stringSchema.required('This field is required');
    }
    let schema: Yup.AnySchema = Yup.object({
      valueString: stringSchema,
    });
    if (required) {
      schema = schema.required('This field is required');
    } else {
      schema = schema.optional();
    }
    schemaTemp = schema;
  }
  if (item.type === 'boolean') {
    let booleanSchema = Yup.boolean();
    if (required) {
      booleanSchema = booleanSchema.is([true], 'This field is required').required('This field is required');
    }
    schemaTemp = Yup.object({
      valueBoolean: booleanSchema,
    });
    if (required) {
      schemaTemp = schemaTemp.required('This field is required');
    }
  }

  if (item.type === 'choice' && item.answerOption && item.answerOption.length) {
    let stringSchema = Yup.string();
    if (required) {
      stringSchema = stringSchema.required('This field is required');
    }
    stringSchema = stringSchema.oneOf(item.answerOption.map((option) => option.valueString));
    let schema = Yup.object({
      valueString: stringSchema,
    });
    if (required) {
      schema = schema.required('This field is required');
    }
    schemaTemp = schema;
  }
  if ((item.type === 'choice' || item.type === 'open-choice') && item.answerLoadingOptions !== undefined) {
    const { answerSource } = item.answerLoadingOptions;
    console.log('required', item.linkId, required, item.required);
    if (!answerSource) {
      // answer options come from answerValueSet, which are converted into valueString choices
      let stringSchema = Yup.string();
      if (required) {
        stringSchema = stringSchema.required('This field is required');
      }
      let schema = Yup.object({
        valueString: stringSchema,
      });
      if (required) {
        schema = schema.required('This field is required');
      }
      schemaTemp = schema;
    } else {
      // const { query, resourceType } = answerSource;
      let referenceSchema = Yup.object({
        valueReference: makeReferenceValueSchema(required),
      });
      if (required) {
        referenceSchema = referenceSchema.required('This field is required');
      }
      schemaTemp = referenceSchema;
    }
  }
  if (item.type === 'date' && item.dataType === 'DOB') {
    let stringSchema = Yup.string()
      .typeError(DATE_ERROR_MESSAGE)
      .matches(isoDateRegex, DATE_ERROR_MESSAGE)
      .test('date test', async (value: any, context: any) => {
        const dt = DateTime.fromISO(value);
        const now = DateTime.now();
        if (dt > now) {
          return context.createError({ message: 'Date may not be in the future' });
        }
        if (item.validateAgeOver !== undefined) {
          if (dt > now.minus({ years: item.validateAgeOver })) {
            return context.createError({ message: `Must be ${item.validateAgeOver} years or older` });
          }
        }
        return value;
      });

    if (required) {
      stringSchema = stringSchema.required(DATE_ERROR_MESSAGE);
    }
    let schema: Yup.AnySchema = Yup.object({
      valueString: stringSchema,
    });
    if (required) {
      schema = schema.required(DATE_ERROR_MESSAGE);
    } else {
      schema = schema.optional().default(undefined);
    }
    schemaTemp = schema;
  }
  if (item.type === 'attachment') {
    let objSchema: any;
    if (required) {
      objSchema = Yup.object({
        valueAttachment: Yup.object({
          url: Yup.string().required('This field is required'), // we could have stronger validation for a z3 url here
          contentType: Yup.string().required('This field is required'),
          title: Yup.string().required('This field is required'),
          created: Yup.string().optional(),
          extension: Yup.array()
            .of(Yup.object({ url: Yup.string(), valueString: Yup.string() }))
            .optional(),
        }).required('This field is required'),
      }).required('This field is required');
    } else {
      objSchema = Yup.object({
        valueAttachment: Yup.object({
          url: Yup.string().required('This field is required'), // we could have stronger validation for a z3 url here
          contentType: Yup.string().required('This field is required'),
          title: Yup.string().required('This field is required'),
          created: Yup.string().optional(),
          extension: Yup.array()
            .of(Yup.object({ url: Yup.string(), valueString: Yup.string() }))
            .optional(),
        }).nullable(),
      })
        .nullable()
        .default(undefined);
    }
    schemaTemp = objSchema;
  }
  if (!schemaTemp) {
    throw new Error(`no schema defined for item ${item.linkId} ${JSON.stringify(item)}`);
  }
  return wrapSchemaInSingleMemberArray(schemaTemp, item, { required, filtered });
};

export const makeValidationSchema = (
  items: IntakeQuestionnaireItem[],
  pageId?: string,
  externalContext?: { values: any; items: any }
): any => {
  // console.log('validation items', items);
  if (pageId !== undefined) {
    // we are validating one page of the questionnaire
    const itemsToValidate = items.find((i) => {
      return i.linkId === pageId;
    })?.item;
    if (itemsToValidate !== undefined) {
      return Yup.lazy((values) => {
        return makeValidationSchemaPrivate(itemsToValidate, values, externalContext);
      });
    } else {
      // this is the branch hit from frontend validation. it is nearly the same as the branch hit by
      // patch. in this case item list is provided directly, where as with Patch it is provided as
      // the item field on { linkId: pageId, item: items }. might be nice to consolidate this.
      // console.log('page id not found; assuming it is root and making schema from items');
      return Yup.lazy((values: any) => {
        return makeValidationSchemaPrivate(items, values, externalContext);
      });
    }
  } else {
    // we are validating the entire questionnaire
    return Yup.array().of(
      Yup.object().test('submit test', async (value: any, context: any) => {
        const { linkId: pageId, item: answerItem } = value;
        console.log('items.it 5', items);
        const questionItem = items.find((i) => i.linkId === pageId);
        if (!questionItem) {
          // console.log('page not found');
          return context.createError({ message: `Page ${pageId} not found in Questionnaire` });
        }
        if (answerItem === undefined) {
          if (questionItem.item?.some((i) => evalRequired(i, context))) {
            return context.createError({ message: 'Item not found' });
          } else {
            return value;
          }
        }
        const schema = makeValidationSchemaPrivate(questionItem.item ?? [], context);
        // we convert this from a list to key-val dict to match the form shape
        try {
          const reduced = answerItem.reduce((accum: any, current: any) => {
            accum[current.linkId] = { ...current };
            return accum;
          }, {});
          const validated = await schema.validate(reduced, { abortEarly: false });
          console.log('validated', JSON.stringify(validated));
          return Yup.mixed().transform(() => validated);
        } catch (e) {
          console.log('error: ', pageId, JSON.stringify(answerItem), e);
          return e;
        }
      })
    );
  }
};

const makeValidationSchemaPrivate = (
  items: IntakeQuestionnaireItem[],
  formValues: any,
  externalContext?: { values: any; items: any }
): Yup.AnyObjectSchema => {
  // console.log('validation items', items);
  // these allow us some flexibility to inject field dependencies from another
  // paperwork page, or anywhere outside the context of the immediate form being validated
  const externalValues = externalContext?.values ?? {};

  const validatableItems = items
    .filter((item) => item?.type !== 'display' && !item?.readOnly)
    .flatMap((item) => makeValidatableItem(item));
  let allValues = (externalContext?.values ?? [])
    .flatMap((page: any) => page.item)
    .reduce((accum: { [x: string]: any }, current: any) => {
      const linkId = current?.linkId;
      if (linkId) {
        accum[linkId] = current;
      }
      return accum;
    }, {} as any);
  allValues = { ...allValues, ...formValues };
  const validationTemp: any = {};
  validatableItems.forEach((item) => {
    let schemaTemp: any | undefined = item.type !== 'group' ? schemaForItem(item, allValues) : undefined;
    if (item.type === 'group' && item.item && item.dataType !== 'DOB') {
      const filteredItems = (item.item ?? []).filter((item) => item?.type !== 'display' && !item?.readOnly);
      // console.log('filtered items', filteredItems);
      const embeddedSchema = makeValidationSchemaPrivate(filteredItems, externalContext);
      // console.log('embedded schema', embeddedSchema);
      schemaTemp = Yup.object().shape({
        linkId: Yup.string(),
        item: Yup.array()
          .transform((v: any) => {
            if (!Array.isArray(v)) {
              return v;
            }
            // console.log('sorted pre insert', JSON.stringify(v));
            const filled = filteredItems.map((item) => {
              const match = v.find((i) => {
                return i?.linkId === item?.linkId;
              });
              if (match) {
                if (match.item) {
                  const cleaned = trimInvalidAnswersFromItem(match);
                  return { ...cleaned, item: recursiveGroupTransform(item.item ?? [], match.item) };
                } else {
                  return {
                    ...trimInvalidAnswersFromItem(match),
                  };
                }
              } else {
                return { linkId: item.linkId };
              }
            });
            // console.log('sorted post insert', JSON.stringify(filled));
            return filled;
          })
          .of(
            Yup.object().test(
              `${item.linkId} group member test`,
              // test function, determines schema validity
              (val: any, context: any) => {
                // console.log('testing val', val, context);
                const parentContext = context?.from?.pop()?.value ?? {};
                const combinedContext = { ...(externalValues ?? {}), ...(parentContext ?? {}) };
                const shouldFilter = evalFilterWhen(item, combinedContext);
                // if the parent item should be filtered we've normalized any items to linkId placeholders
                // and can safely return true here, only proceeding to test conformance of each embedded item
                // with the schema if the encompassing parent is not filtered out.
                if (shouldFilter) {
                  return true;
                }
                if (context?.path) {
                  try {
                    const idx = context.path.replace('[', '.').replace(']', '').split('.').pop();
                    if (!idx) {
                      return false;
                    }
                    const item: any = {};
                    item[val.linkId] = val;

                    // console.log('idx', idx, itemLinkId, val, item);
                    return embeddedSchema.validateAt(val.linkId, item);
                  } catch (e) {
                    console.log('thrown error from group member test', e);
                    return context.createError({ message: (e as any).message });
                  }
                }
                return true;
              }
            )
          ),
      });
    }

    if (schemaTemp !== undefined || item.type === 'group') {
      if (item.type === 'group') {
        validationTemp[item.linkId] =
          schemaTemp ??
          Yup.object({
            linkId: Yup.string(),
            item: Yup.array().of(
              Yup.object({
                linkId: Yup.string(),
                answer: Yup.array().of(Yup.object({ valueString: Yup.string() })),
              })
            ),
          });
      } else {
        validationTemp[item.linkId] = schemaTemp;
      }
    } else {
      console.log('undefined schema', item.linkId);
    }
  });
  return Yup.object().shape(validationTemp);
};

export const itemAnswerHasValue = (answerItem: QuestionnaireResponseItemAnswer): boolean => {
  const entries = Object.entries(answerItem);
  if (entries.length === 0) {
    return false;
  }

  return entries.some((entry) => {
    const [_, val] = entry;
    return val !== undefined;
  });
};

type EnableWhenOperator = 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<=';

const evalBoolean = (operator: EnableWhenOperator, answerValue: boolean, value: boolean | undefined): boolean => {
  if (operator === 'exists') {
    return value !== undefined;
  }

  if (operator === '=') {
    return answerValue == value;
  } else if (operator === '!=') {
    return answerValue != value;
  }
  throw new Error(`Unexpected operator ${operator} encountered for boolean value`);
};

const evalString = (operator: EnableWhenOperator, answerValue: string, value: string | undefined): boolean => {
  if (operator === '=') {
    return answerValue === value;
  } else if (operator === '!=') {
    return answerValue !== value;
  }
  throw new Error(`Unexpected operator ${operator} encountered for boolean value`);
};

const evalEnableWhenItem = (
  enableWhen: QuestionnaireItemEnableWhen,
  values: { [itemLinkId: string]: QuestionnaireResponseItem },
  items: QuestionnaireItem[]
): boolean => {
  const { answerString, answerBoolean, question, operator } = enableWhen;
  // console.log('items', items);
  const questionPathNodes = question.split('.');

  const itemDef = questionPathNodes.reduce(
    (accum, current) => {
      if (!accum) {
        return accum;
      }
      const item = accum.items.find((item) => {
        return item?.linkId === current;
      });
      if (!item) {
        return accum;
      }
      accum['item'] = item;
      accum['items'] = item?.item ?? [];
      return accum;
    },
    { items, item: undefined } as { items: QuestionnaireItem[]; item: QuestionnaireItem | undefined } | undefined
  )?.item;
  if (!itemDef) {
    return operator === '!=';
  }

  const valueDef = questionPathNodes.reduce((accum, current) => {
    if (accum === undefined) {
      return undefined;
    }
    const newVal = (accum as any)[current];
    if (newVal) {
      return newVal;
    }
    return (accum.item ?? []).find((i: any) => i?.linkId && i.linkId === current);
  }, values as any);

  if (answerBoolean === undefined && answerString === undefined) {
    // we only need to support these 2 value types so far
    return false;
  }

  if (itemDef.type === 'boolean' && answerBoolean !== undefined) {
    return evalBoolean(operator, answerBoolean, pickFirstValueFromAnswerItem(valueDef, 'boolean'));
  } else if (
    (itemDef.type === 'string' || itemDef.type === 'choice' || itemDef.type === 'open-choice') &&
    answerString
  ) {
    const verdict = evalString(operator, answerString, pickFirstValueFromAnswerItem(valueDef));
    return verdict;
  } else {
    // we only support string and bool atm
    return false;
  }
};

export const evalEnableWhen = (
  item: IntakeQuestionnaireItem,
  items: IntakeQuestionnaireItem[],
  values: { [itemLinkId: string]: QuestionnaireResponseItem }
): boolean => {
  const { enableWhen, enableBehavior = 'all' } = item;
  if (enableWhen === undefined || enableWhen.length === 0) {
    return true;
  }

  if (enableBehavior === 'any') {
    const verdict = enableWhen.some((ew) => {
      const enabled = evalEnableWhenItem(ew, values, items);
      return enabled;
    });
    return verdict;
  } else if (enableBehavior === 'all') {
    const verdict = enableWhen.every((ew) => {
      const enabled = evalEnableWhenItem(ew, values, items);
      return enabled;
    });
    return verdict;
  } else {
    const verdict = enableWhen.every((ew) => {
      return evalEnableWhenItem(ew, values, items);
    });
    return verdict;
  }
};

// optionVal, if passed will be taken as the value of the field to check requireWhen against,
// otherwise the context is checked for a value using requireWhen.question as the key
export const evalRequired = (item: IntakeQuestionnaireItem, context: any, questionVal?: any): boolean => {
  if (item.required) {
    return true;
  }

  if (item.requireWhen === undefined) {
    return false;
  }

  return evalCondition(item.requireWhen, context, questionVal);
};

export const evalItemText = (item: IntakeQuestionnaireItem, context: any, questionVal?: any): string | undefined => {
  const { textWhen } = item;
  if (textWhen === undefined) {
    return item.text;
  }
  const { substituteText } = textWhen;

  if (evalCondition(textWhen, context, questionVal)) {
    return substituteText;
  }
  return item.text;
};

interface NestedItem {
  item?: NestedItem[];
}
export const flattenItems = (items: NestedItem[]): any => {
  let itemsList = items as NestedItem[];
  if (typeof items === 'object') {
    itemsList = Object.values(items);
  }
  return itemsList?.flatMap((i) => {
    if (i?.item) {
      return flattenItems(i?.item);
    }
    return i;
  });
};

interface HasLinkId {
  linkId: string;
}
const makeItemDict = (items: HasLinkId[]): { [linkId: string]: any } => {
  return [...items].reduce(
    (accum, cur) => {
      if (cur && cur.linkId) {
        accum[cur.linkId] = { ...cur, linkId: undefined };
      }
      return accum;
    },
    {} as { [linkId: string]: any }
  );
};

export const evalFilterWhen = (item: IntakeQuestionnaireItem, context: any, questionVal?: any): boolean => {
  if (item.filterWhen === undefined) {
    return false;
  }
  return evalCondition(item.filterWhen, context, questionVal);
};

export const evalComplexValidationTrigger = (
  item: IntakeQuestionnaireItem,
  context: any,
  questionVal?: any
): boolean => {
  console.log('item.complex', item.complexValidation?.type, item.complexValidation?.triggerWhen);
  if (item.complexValidation === undefined) {
    return false;
  } else if (item.complexValidation?.triggerWhen === undefined) {
    return true;
  }
  return evalCondition(item.complexValidation.triggerWhen, context, questionVal);
};

const evalCondition = (condition: QuestionnaireItemConditionDefinition, context: any, questionVal?: any): boolean => {
  const { question, operator, answerString, answerBoolean } = condition;
  const questionValue = recursivePathEval(context, question, questionVal);

  if (answerString !== undefined) {
    const comparisonString = questionValue?.answer?.[0]?.valueString ?? questionValue?.valueString;
    if (operator === '=' && comparisonString === answerString) {
      return true;
    }
    if (operator === '!=' && comparisonString !== answerString) {
      return true;
    }
  }
  if (answerBoolean !== undefined) {
    const comparisonBool = questionValue?.answer?.[0]?.valueBoolean ?? questionValue?.valueBoolean;

    if (operator === '=' && comparisonBool === answerBoolean) {
      return true;
    }
    if (operator === '!=' && comparisonBool !== answerBoolean) {
      return true;
    }
  }
  return false;
};
/*
  given any list of questionnaire items and values representing answers to those items,
  filter out any values that should not be included in the form submission, whether because
  those values represent invalid "empty" states or because they are logically excluded based
  on the application of the filter-when extension.
  filtered out values aren't actually removed but rather are normalized to { linkId } w/out
  any answer or item props. this makes for valid fhir and also ensure ordering is preserved
  within groups (which may be important for downstream implementation)
*/
export const recursiveGroupTransform = (items: IntakeQuestionnaireItem[], values: any): any => {
  const filteredItems = items.filter((item) => item && item?.type !== 'display' && !item?.readOnly);
  const stringifiedInput = JSON.stringify(values);
  const output = filteredItems.map((item) => {
    const match = values?.find((i: any) => {
      return i?.linkId === item?.linkId;
    });
    if (!match || evalFilterWhen(item, values)) {
      return { linkId: item.linkId };
    }
    if (match.item) {
      return { ...trimInvalidAnswersFromItem(match), item: recursiveGroupTransform(item.item ?? [], match.item) };
    } else {
      return trimInvalidAnswersFromItem(match);
    }
  });

  const stringifiedOutput = JSON.stringify(output);
  if (stringifiedInput === stringifiedOutput) {
    return output;
  } else {
    return recursiveGroupTransform(items, output);
  }
};

const recursivePathEval = (context: any, question: string, value?: any): any | undefined => {
  if (value) {
    return value;
  }
  try {
    const itemDict = Array.isArray(context) ? makeItemDict(context) : context;
    const questionValue = (itemDict ?? {})[question];
    if (questionValue) {
      return questionValue;
    } else {
      const questionSplit = question.split('.');
      if (questionSplit.length > 1) {
        const newQuestion = questionSplit.slice(1).join('.');
        return recursivePathEval(context, newQuestion);
      }
    }
  } catch (e) {
    console.log('error resolving path', e, context);
  }
  return undefined;
};

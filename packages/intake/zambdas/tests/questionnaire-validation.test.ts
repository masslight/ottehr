import { IntakeQuestionnaireItem, getQuestionnaireItemsAndProgress, makeValidationSchema } from 'utils';
import { AnyObjectSchema, AnySchema } from 'yup';
import { getAuth0Token } from '../src/shared';
import { createOystehrClient } from '../src/shared/helpers';
import QRData from './data/quetionnaire-responses.json';
import { vi } from 'vitest';
import { SECRETS as S } from './data/secrets';
// import { QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';

// npm run test -- questionnaire-validation.test.ts

// where does this come from, and how can we get its questionnaire id instead??
// const APPOINTMENT_ID = '94a90465-8c4f-422d-b752-ca3d154d7175';
// const COMPLETED_VALID_FULL_QR_WITH_INSURANCE: QuestionnaireResponseItem[] = QRData.full[0].item;
// const COMPLETED_VALID_FULL_QR_NO_INSURANCE: QuestionnaireResponseItem[] = QRData.full[1].item;

// type QRPageName = 'contact-information-page' | 'payment-option-page' | 'patient-details-page' | 'photo-id-page';

// function makeValueAttachmentAnswer(url: any, title: any, contentType: any): QuestionnaireResponseItemAnswer[] {
//   return [
//     {
//       valueAttachment: {
//         url,
//         title,
//         creation: '2024-08-08T12:10:36.693-04:00',
//         contentType,
//       },
//     },
//   ];
// }

// function editQRAnswer(
//   pageId: QRPageName,
//   answerId: string,
//   newAnswer: any,
//   answerType: 'valueString' | 'valueBoolean' | 'date' | 'attachment' | 'addPageItem' = 'valueString',
//   qrType: 'full' | 'page',
//   withInsurance?: boolean
// ): QuestionnaireResponseItem[] {
//   // get the qr and make a copy
//   if (withInsurance === undefined) {
//     withInsurance = true;
//   }

//   let pageQR: QuestionnaireResponseItem[];
//   const fullQR = withInsurance ? COMPLETED_VALID_FULL_QR_WITH_INSURANCE : COMPLETED_VALID_FULL_QR_NO_INSURANCE;

//   switch (pageId) {
//     // making some assupmtions here about where the valid, completed pages are in the lists
//     case 'contact-information-page':
//     case 'patient-details-page':
//     case 'photo-id-page':
//       pageQR = QRData.page[pageId][0].item;
//       break;
//     case 'payment-option-page':
//       pageQR = withInsurance ? QRData.page[pageId][0].item : QRData.page[pageId][1].item;
//       break;
//     default:
//       throw new Error('Page not found');
//   }

//   const copy = JSON.parse(JSON.stringify(qrType === 'full' ? fullQR : pageQR)) as QuestionnaireResponseItem[];

//   let itemIndex;
//   let pageIndex;
//   let updatedAnswer = undefined;
//   let updatedItem = undefined;

//   if (qrType === 'full') {
//     pageIndex = copy.findIndex((item) => item.linkId === pageId);
//     itemIndex = pageIndex > -1 ? copy[pageIndex].item?.findIndex((item) => item.linkId === answerId) : undefined;
//   } else if (qrType === 'page') {
//     itemIndex = copy.findIndex((item) => item.linkId === answerId);
//   }

//   // update the answer in the qr copy
//   switch (answerType) {
//     case 'valueString':
//       updatedAnswer = [{ valueString: newAnswer }];
//       break;
//     case 'valueBoolean':
//       updatedAnswer = [{ valueBoolean: newAnswer }];
//       break;
//     case 'date':
//       updatedItem = newAnswer;
//       break;
//     case 'attachment':
//       updatedAnswer = newAnswer;
//       break;
//     case 'addPageItem':
//       // push a new item instead of updating one and return early
//       if (qrType === 'full' && pageIndex !== undefined && pageIndex > -1) {
//         (copy[pageIndex].item as QuestionnaireResponseItem[]).push({
//           linkId: answerId,
//           answer: newAnswer,
//         });
//         return copy;
//       } else if (qrType === 'page') {
//         copy.push({
//           linkId: answerId,
//           answer: newAnswer,
//         });
//         return copy;
//       } else {
//         throw new Error('Failed to add page item');
//       }
//     default:
//       throw new Error('Invalid answer type');
//   }

//   if (itemIndex !== undefined && itemIndex > -1) {
//     // console.log('UPDATED', updatedAnswer, pageIndex, itemIndex);
//     const answerItem = {
//       linkId: answerId,
//       answer: updatedAnswer,
//       item: updatedItem,
//     };

//     if (qrType === 'full' && pageIndex !== undefined && pageIndex > -1 && copy[pageIndex].item !== undefined) {
//       (copy[pageIndex].item as QuestionnaireResponseItem[])[itemIndex] = answerItem;
//       // console.log('COPY:', JSON.stringify(copy.find((page) => page.linkId === pageId)));
//       // console.log('OG:', JSON.stringify(fullQR.find((page) => page.linkId === pageId)));
//     } else if (qrType === 'page' && copy[itemIndex] !== undefined) {
//       (copy[itemIndex] as QuestionnaireResponseItem) = answerItem;
//     } else {
//       throw new Error('Failed to update answer');
//     }
//   } else {
//     throw new Error('Failed to find item');
//   }
//   return copy;
// }

// async function validateAnswers(
//   answers: QuestionnaireResponseItem[],
//   validationSchema: AnySchema | AnyObjectSchema | null,
//   validatePage?: boolean
// ): Promise<any> {
//   let validationResult;

//   try {
//     if (!validationSchema) {
//       throw new Error('Failed to get validation schema');
//     }

//     let pageAnswers;
//     if (validatePage) {
//       // transform items into an object with linkIDs as keys
//       pageAnswers = answers.reduce((accum, curr) => {
//         accum[curr.linkId] = curr;
//         return accum;
//       }, {} as any);
//       // console.log('Patch answers', pageAnswers);
//     }

//     validationResult = await validationSchema.validate(validatePage ? pageAnswers : answers, { abortEarly: false });
//   } catch (e) {
//     validationResult = e;
//   }

//   // console.log('RESULT', validationResult);
//   return validationResult;
// }

// async function testForInvalidAnswer(
//   answers: QuestionnaireResponseItem[],
//   validationSchema: AnySchema | AnyObjectSchema | null,
//   validatePage?: boolean,
//   errorMessage?: string,
//   numErrors?: number
// ): Promise<void> {
//   const validationResult = await validateAnswers(answers, validationSchema, validatePage);
//   const expectedErrors = numErrors ?? 1;

//   expect(validationResult).toBeDefined();
//   expect(validationResult.inner?.length).toBe(expectedErrors);
//   expect(validationResult.errors?.length).toBe(expectedErrors);
//   if (errorMessage && expectedErrors === 1) {
//     expect(validationResult.inner[0].errors[0]).toBe(errorMessage);
//   } else {
//     validationResult.inner.forEach((inner: any) => {
//       inner.errors.forEach((error: any) => {
//         // console.log(inner.path, error);
//         expect(error).toBeDefined();
//       });
//     });
//   }
// }

// async function testForValidAnswer(
//   answers: QuestionnaireResponseItem[],
//   validationSchema: AnySchema | AnyObjectSchema | null,
//   validatePage?: boolean
// ): Promise<void> {
//   const validationResult = await validateAnswers(answers, validationSchema, validatePage);
//   expect(validationResult).toBeDefined();
//   expect(validationResult.inner).not.toBeDefined();
//   expect(validationResult.errors).not.toBeDefined();
// }

describe.skip('qr page validation tests', () => {
  let questions: IntakeQuestionnaireItem[] = [];

  vi.setConfig({ testTimeout: 100_000 });
  beforeAll(async () => {
    const { FHIR_API, AUTH0_ENDPOINT, AUTH0_AUDIENCE, AUTH0_CLIENT, AUTH0_SECRET, IN_PERSON_PREVISIT_QUESTIONNAIRE } =
      S;
    const SECRETS = {
      FHIR_API: FHIR_API,
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
      AUTH0_CLIENT: AUTH0_CLIENT,
      AUTH0_SECRET: AUTH0_SECRET,
      IN_PERSON_PREVISIT_QUESTIONNAIRE,
    };

    const token = await getAuth0Token(SECRETS);
    const oystehr = createOystehrClient(token, SECRETS);

    // get paperwork questions
    const maybeData = await getQuestionnaireItemsAndProgress('some_questionnaire_response_id', oystehr);
    if (!maybeData) {
      throw new Error('No items');
    }
    const { items } = maybeData;

    // make validation schemas for QR pages
    questions = items;
  });

  const pages = Object.entries(QRData.page);
  pages.flatMap((pageEntry) => {
    const [pageLinkId, pageTestList] = pageEntry;
    return pageTestList.map((testEntry) => {
      const { fullFormId, description, context = { values: {}, items: [] }, item, expectation } = testEntry;
      const { valid, inner, validItemsToCheck } = expectation;
      return test(description, async () => {
        // this covers form values
        const validationSchema = makeValidationSchema(questions, pageLinkId);
        expect(validationSchema).toBeDefined();
        expect(Object.keys(validationSchema).length).toBeGreaterThan(0);
        // console.log('item', item);
        // aply schema

        // this covers patch object
        const validationSchemaForPatch = makeValidationSchema(questions, pageLinkId, context);
        expect(validationSchemaForPatch).toBeDefined();
        expect(Object.keys(validationSchema).length).toBeGreaterThan(0);
        // const toValidate = { linkId: pageLinkId, item };
        // console.log('to validate', toValidate);
        // apply schema to toValidate

        // this covers object embedded in full form submit
        if (fullFormId) {
          const context = QRData.full.find((item) => item.id === fullFormId);
          if (context) {
            const validationSchemaWithFullFormContext = makeValidationSchema(questions, pageLinkId, {
              values: context.item,
              items: undefined,
            });
            expect(validationSchemaWithFullFormContext).toBeDefined();
            expect(Object.keys(validationSchema).length).toBeGreaterThan(0);
            // apply schema
            let validationResult: any = undefined;
            try {
              const val = ((item as any[] | undefined) ?? []).reduce((accum: any, curr: any) => {
                if (!accum || !curr.linkId) {
                  return accum;
                }
                accum[curr.linkId] = curr;
                return accum;
              }, {} as any);
              validationResult = await validationSchema.validate(val, { abortEarly: false });
            } catch (e) {
              validationResult = e;
            }

            expect(validationResult).toBeDefined();
            console.log('validation result', validationResult);
            if (!valid) {
              // console.log('validation result', JSON.stringify(validationResult));
              inner.forEach((inner: any, idx) => {
                expect(validationResult.inner?.[idx]?.path).toBe(inner.path);
                inner.errors.forEach((e: any, eIdx: number) => {
                  expect(validationResult.inner?.[idx]?.errors?.[eIdx]).toBe(e);
                });
              });
            } else {
              //console.log('validation result', JSON.stringify(validationResult));
              expect(validationResult.inner).not.toBeDefined();
              expect(validationResult.errors).not.toBeDefined();
              validItemsToCheck?.forEach((item) => {
                const { path, value } = item;
                const pathParts = path.split('.');
                const resultValue = pathParts.reduce((accum: any, curr: string | number) => {
                  // console.log('accum, curr', accum, curr);
                  // const asInt = parseInt(curr);
                  return accum?.[curr];
                }, validationResult as any);
                // have to use null for json to be valid, so map that to undefined
                expect(resultValue).toBe(value ?? undefined);
              });
            }
          }
        }
      });
    });
  });
});

describe.skip('full qr validation tests', () => {
  let questions: IntakeQuestionnaireItem[] = [];
  let validationSchema: AnySchema | AnyObjectSchema | null = null;

  vi.setConfig({ testTimeout: 100_000 });

  beforeAll(async () => {
    const { FHIR_API, AUTH0_ENDPOINT, AUTH0_AUDIENCE, AUTH0_CLIENT, AUTH0_SECRET, IN_PERSON_PREVISIT_QUESTIONNAIRE } =
      S;
    const SECRETS = {
      FHIR_API: FHIR_API,
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
      AUTH0_CLIENT: AUTH0_CLIENT,
      AUTH0_SECRET: AUTH0_SECRET,
      IN_PERSON_PREVISIT_QUESTIONNAIRE,
    };

    const token = await getAuth0Token(SECRETS);
    const oystehr = createOystehrClient(token, SECRETS);

    // get paperwork questions and validation schema
    const maybeData = await getQuestionnaireItemsAndProgress('some_questionnaire_response_id', oystehr);
    if (!maybeData) {
      throw new Error('No items');
    }
    const { items } = maybeData;

    questions = items;
    validationSchema = makeValidationSchema(questions);

    expect(questions.length).toBeGreaterThan(0);
    expect(validationSchema).toBeDefined();
  });

  QRData.full.map(async (fullQR) => {
    return test(fullQR.description, async () => {
      const { expectation, item } = fullQR;
      const { valid, inner, validItemsToCheck } = expectation;
      if (!validationSchema) {
        throw new Error('Failed to get validation schema');
      }
      expect(Object.keys(validationSchema).length).toBeGreaterThan(0);
      let validationResult: any = undefined;
      try {
        validationResult = await validationSchema.validate(item, { abortEarly: false });
      } catch (e) {
        validationResult = e;
      }
      expect(validationResult).toBeDefined();
      // console.log('validation result', validationResult);
      if (!valid) {
        // console.log('validation result', JSON.stringify(validationResult));
        inner.forEach((inner, idx) => {
          expect(validationResult.inner?.[idx]?.path).toBe(inner.path);
          inner.errors.forEach((e, eIdx) => {
            expect(validationResult.inner?.[idx]?.errors?.[eIdx]).toBe(e);
          });
        });
      } else {
        //console.log('validation result', JSON.stringify(validationResult));
        expect(validationResult.inner).not.toBeDefined();
        expect(validationResult.errors).not.toBeDefined();
        validItemsToCheck.forEach((item) => {
          const { path, value } = item;
          const pathParts = path.split('.');
          const resultValue = pathParts.reduce((accum: any, curr: string | number) => {
            // console.log('accum, curr', accum, curr);
            // const asInt = parseInt(curr);
            return accum?.[curr];
          }, validationResult as any);
          // have to use null for json to be valid, so map that to undefined
          expect(resultValue).toBe(value ?? undefined);
        });
      }
    });
  });
});
/*
describe('QR item type tests', () => {
  let questions: IntakeQuestionnaireItem[] = [];
  let fullValidationSchema: AnySchema | AnyObjectSchema | null = null;
  const pageValidationSchemas: { [key in QRPageName]: AnySchema | AnyObjectSchema | null } = {
    'contact-information-page': null,
    'payment-option-page': null,
    'patient-details-page': null,
    'photo-id-page': null,
  };

  vi.setConfig({ testTimeout: 100_000 });
  beforeAll(async () => {
    const token = await getAuth0Token(SECRETS);
    const oystehr = createOystehrClient(token, SECRETS);

    // get paperwork questions and validation schema
    const [canonUrl, version] = getSecret(SecretsKeys.IN_PERSON_PREVISIT_QUESTIONNAIRE, SECRETS).split('|');
    const { items } = await getQuestionnaireItemsAndProgress(
      canonUrl,
      version,
      'ip-questionnaire-item-value-set',
      APPOINTMENT_ID,
      oystehr
    );

    questions = items;
    fullValidationSchema = makeValidationSchema(questions);
    Object.keys(pageValidationSchemas).forEach(
      (pageId) => (pageValidationSchemas[pageId as QRPageName] = makeValidationSchema(questions, pageId))
    );

    expect(questions.length).toBeGreaterThan(0);
    expect(fullValidationSchema).toBeDefined();
  });

  const testItems = (qrType: 'full' | 'page'): void => {
    const needsValidatePage = qrType === 'page';
    const getValidationSchema = (pageId: QRPageName): AnySchema | AnyObjectSchema | null => {
      return qrType === 'page' ? pageValidationSchemas[pageId] : fullValidationSchema;
    };

    test('No emojis allowed in text or string types', async () => {
      // open-choice type can have string emojis too but we don't use this type yet
      const emojiStringAnswer = editQRAnswer(
        'contact-information-page',
        'patient-street-address',
        '🦄',
        'valueString',
        qrType
      );
      const emojiTextAnswer = editQRAnswer(
        'payment-option-page',
        'insurance-additional-information',
        '🤠',
        'valueString',
        qrType
      );
      const emojiErr = 'Emojis are not a valid character';
      await testForInvalidAnswer(
        emojiStringAnswer,
        getValidationSchema('contact-information-page'),
        needsValidatePage,
        emojiErr
      );
      await testForInvalidAnswer(
        emojiTextAnswer,
        getValidationSchema('payment-option-page'),
        needsValidatePage,
        emojiErr
      );
    });

    test('Invalid phone number does not match regex', async () => {
      const invalidPhone = editQRAnswer('patient-details-page', 'pcp-number', '1234567890', 'valueString', qrType);
      await testForInvalidAnswer(
        invalidPhone,
        getValidationSchema('patient-details-page'),
        needsValidatePage,
        'Phone number must be 10 digits in the format (xxx) xxx-xxxx'
      );
    });

    test('Invalid email does not match regex', async () => {
      const invalidEmail = editQRAnswer('contact-information-page', 'guardian-email', 'abc@123', 'valueString', qrType);
      await testForInvalidAnswer(
        invalidEmail,
        getValidationSchema('contact-information-page'),
        needsValidatePage,
        'Email is not valid'
      );
    });

    test('Invalid zip code does not match regex', async () => {
      const invalidZip = editQRAnswer('contact-information-page', 'patient-zip', '1234', 'valueString', qrType);
      await testForInvalidAnswer(
        invalidZip,
        getValidationSchema('contact-information-page'),
        needsValidatePage,
        'ZIP Code must be 5 numbers'
      );
    });

    test('Required field cannot be empty string or undefined', async () => {
      const validationSchema = getValidationSchema('contact-information-page');
      const undefinedAnswer = editQRAnswer(
        'contact-information-page',
        'patient-street-address',
        undefined,
        'valueString',
        qrType
      );
      const emptyStringAnswer = editQRAnswer(
        'contact-information-page',
        'patient-street-address',
        '',
        'valueString',
        qrType
      );
      const blankSpacesAnswer = editQRAnswer(
        'contact-information-page',
        'patient-street-address',
        ' ',
        'valueString',
        qrType
      );
      const requiredErr = 'This field is required';
      await testForInvalidAnswer(undefinedAnswer, validationSchema, needsValidatePage, requiredErr);
      await testForInvalidAnswer(emptyStringAnswer, validationSchema, needsValidatePage, requiredErr);
      await testForInvalidAnswer(blankSpacesAnswer, validationSchema, needsValidatePage, requiredErr);
    });

    test('Optional fields can accept empty string or undefined', async () => {
      const validationSchema = getValidationSchema('contact-information-page');
      const undefinedAnswer = editQRAnswer(
        'contact-information-page',
        'patient-street-address-2',
        undefined,
        'valueString',
        qrType
      );
      const emptyStringAnswer = editQRAnswer(
        'contact-information-page',
        'patient-street-address-2',
        '',
        'valueString',
        qrType
      );
      const blankSpacesAnswer = editQRAnswer(
        'contact-information-page',
        'patient-street-address-2',
        ' ',
        'valueString',
        qrType
      );
      await testForValidAnswer(undefinedAnswer, validationSchema, needsValidatePage);
      await testForValidAnswer(emptyStringAnswer, validationSchema, needsValidatePage);
      await testForValidAnswer(blankSpacesAnswer, validationSchema, needsValidatePage);
    });

    test('Boolean field does not accept non-boolean answers', async () => {
      const notABoolean = editQRAnswer(
        'contact-information-page',
        'mobile-opt-in',
        'Ongo Gablogian',
        'valueBoolean',
        qrType
      );
      await testForInvalidAnswer(notABoolean, getValidationSchema('contact-information-page'), needsValidatePage);
    });

    test('Choice type answer is one listed in the available options', async () => {
      const validationSchema = getValidationSchema('payment-option-page');
      const options = questions
        .find((page) => page.linkId === 'payment-option-page')
        ?.item?.find((q) => q.linkId === 'payment-option')?.answerOption;
      if (!options?.length) {
        throw new Error('No options found for choice type question');
      }

      const validChoice = editQRAnswer(
        'payment-option-page',
        'payment-option',
        'I have insurance',
        'valueString',
        qrType
      );
      const invalidChoice = editQRAnswer(
        'payment-option-page',
        'payment-option',
        'I will pay with dogecoin',
        'valueString',
        qrType
      );

      await testForValidAnswer(validChoice, validationSchema, needsValidatePage);
      await testForInvalidAnswer(invalidChoice, validationSchema, needsValidatePage);
    });

    test('Date type field only accepts valid dates', async () => {
      const invalidDate = editQRAnswer(
        'payment-option-page',
        'policy-holder-date-of-birth',
        [
          {
            linkId: 'policy-holder-dob-day',
            answer: [
              {
                valueString: '08',
              },
            ],
          },
          {
            linkId: 'policy-holder-dob-month',
            answer: [
              {
                valueString: '42',
              },
            ],
          },
          {
            linkId: 'policy-holder-dob-year',
            answer: [
              {
                valueString: '1997',
              },
            ],
          },
        ],
        'date',
        qrType
      );
      await testForInvalidAnswer(
        invalidDate,
        getValidationSchema('payment-option-page'),
        needsValidatePage,
        'Please enter a valid date'
      );
    });

    test('Attachment type fields require url, title, and content type to be defined if attachment is sent', async () => {
      const validationSchema = getValidationSchema('photo-id-page');
      const nullValues = makeValueAttachmentAnswer(null, null, null);
      const undefinedValues = makeValueAttachmentAnswer(undefined, undefined, undefined);
      const emptyValues = makeValueAttachmentAnswer('', '', '');
      const nullAnswer = editQRAnswer('photo-id-page', 'photo-id-front', nullValues, 'attachment', qrType);
      const undefinedAnswer = editQRAnswer('photo-id-page', 'photo-id-front', undefinedValues, 'attachment', qrType);
      const emptyAnswer = editQRAnswer('photo-id-page', 'photo-id-front', emptyValues, 'attachment', qrType);

      await testForInvalidAnswer(nullAnswer, validationSchema, needsValidatePage, undefined, 3);
      await testForInvalidAnswer(undefinedAnswer, validationSchema, needsValidatePage, undefined, 3);
      await testForInvalidAnswer(emptyAnswer, validationSchema, needsValidatePage, undefined, 3);
    });

    test('Attachment type fields can be optional', async () => {
      const undefinedAttachment: QuestionnaireResponseItemAnswer[] = [
        {
          valueAttachment: undefined,
        },
      ];
      const undefinedAnswer = editQRAnswer(
        'photo-id-page',
        'photo-id-front',
        undefinedAttachment,
        'attachment',
        qrType
      );
      await testForValidAnswer(undefinedAnswer, getValidationSchema('photo-id-page'), needsValidatePage);
    });

    test('Field is required when "require-when" extension exists on item and the conditional is true', async () => {
      const validationSchema = getValidationSchema('payment-option-page');
      const errMessage = 'This field is required';
      const undefinedAnswer = editQRAnswer(
        'payment-option-page',
        'insurance-carrier',
        undefined,
        'valueString',
        qrType
      );
      const emptyStringAnswer = editQRAnswer('payment-option-page', 'insurance-carrier', '', 'valueString', qrType);
      const blankSpaceAnswer = editQRAnswer('payment-option-page', 'insurance-carrier', ' ', 'valueString', qrType);

      await testForInvalidAnswer(undefinedAnswer, validationSchema, needsValidatePage, errMessage);
      await testForInvalidAnswer(emptyStringAnswer, validationSchema, needsValidatePage, errMessage);
      await testForInvalidAnswer(blankSpaceAnswer, validationSchema, needsValidatePage, errMessage);
    });

    test('Field is not required when "require-when" extension exists on item and the conditional is false', async () => {
      const validationSchema = getValidationSchema('payment-option-page');
      const undefinedAnswer = editQRAnswer(
        'payment-option-page',
        'insurance-carrier',
        undefined,
        'addPageItem',
        qrType,
        false
      );
      const undefinedValueAnswer = editQRAnswer(
        'payment-option-page',
        'insurance-carrier',
        [
          {
            valueString: undefined,
          },
        ],
        'addPageItem',
        qrType,
        false
      );
      const emptyValueAnswer = editQRAnswer(
        'payment-option-page',
        'insurance-carrier',
        [
          {
            valueString: '',
          },
        ],
        'addPageItem',
        qrType,
        false
      );

      await testForValidAnswer(undefinedAnswer, validationSchema, needsValidatePage);
      await testForValidAnswer(undefinedValueAnswer, validationSchema, needsValidatePage);
      await testForValidAnswer(emptyValueAnswer, validationSchema, needsValidatePage);
    });

    test('String type answer is validated when "enableWhen" conditional is true', async () => {
      const invalidStringAnswer = editQRAnswer(
        'payment-option-page',
        'insurance-member-id',
        '🦦',
        'valueString',
        qrType
      );
      await testForInvalidAnswer(
        invalidStringAnswer,
        getValidationSchema('payment-option-page'),
        needsValidatePage,
        'Emojis are not a valid character'
      );
    });

    test('Text type answer is validated when "enableWhen" conditional is true', async () => {
      const invalidTextAnswer = editQRAnswer(
        'payment-option-page',
        'insurance-additional-information',
        '✨',
        'valueString',
        qrType
      );
      await testForInvalidAnswer(
        invalidTextAnswer,
        getValidationSchema('payment-option-page'),
        needsValidatePage,
        'Emojis are not a valid character'
      );
    });

    test('Choice type answer is validated when "enableWhen" conditional is true', async () => {
      const options = questions
        .find((page) => page.linkId === 'payment-option-page')
        ?.item?.find((q) => q.linkId === 'policy-holder-birth-sex')?.answerOption;

      if (!options?.length) {
        throw new Error('No options found for choice type question');
      }

      const invalidChoiceAnswer = editQRAnswer(
        'payment-option-page',
        'policy-holder-birth-sex',
        'Other',
        'valueString',
        qrType
      );
      await testForInvalidAnswer(invalidChoiceAnswer, getValidationSchema('payment-option-page'), needsValidatePage);
    });

    test('Attachment type field is validated when "enableWhen" conditional is true', async () => {
      const nullValues = makeValueAttachmentAnswer(null, null, null);
      const nullAnswer = editQRAnswer('payment-option-page', 'insurance-card-front', nullValues, 'attachment', qrType);
      await testForInvalidAnswer(
        nullAnswer,
        getValidationSchema('payment-option-page'),
        needsValidatePage,
        undefined,
        3
      );
    });

    test('Answer is optional when "enableWhen" conditional is false', async () => {
      const validationSchema = getValidationSchema('payment-option-page');
      const undefinedAnswer = editQRAnswer(
        'payment-option-page',
        'insurance-carrier',
        undefined,
        'addPageItem',
        qrType,
        false
      );
      const emptyStringAnswer = editQRAnswer(
        'payment-option-page',
        'insurance-carrier',
        '',
        'addPageItem',
        qrType,
        false
      );
      const nullAnswer = editQRAnswer('payment-option-page', 'insurance-carrier', null, 'addPageItem', qrType, false);
      await testForValidAnswer(undefinedAnswer, validationSchema, needsValidatePage);
      await testForValidAnswer(emptyStringAnswer, validationSchema, needsValidatePage);
      await testForValidAnswer(nullAnswer, validationSchema, needsValidatePage);
    });
  };

  describe('full qr item type tests', () => testItems('full'));
  describe('qr page item type tests', () => testItems('page'));
});
*/

import { IntakeQuestionnaireItem, getQuestionnaireItemsAndProgress, recursiveGroupTransform } from 'utils';
import { getAuth0Token } from '../src/shared';
import { createOystehrClient } from '../src/shared/helpers';
import QRData from './data/quetionnaire-responses.json';
import { vi } from 'vitest';
import { SECRETS as S } from './data/secrets';

// where does this come form, and how can we get the questionnaire id instead?
// const APPOINTMENT_ID = '94a90465-8c4f-422d-b752-ca3d154d7175';

describe.skip('qr recursive filter validation tests', () => {
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

    // get paperwork questions and validation schema
    const maybeData = await getQuestionnaireItemsAndProgress('some_questionnaire_response_id', oystehr);
    if (!maybeData) {
      throw new Error('No items');
    }
    const { items } = maybeData;

    questions = items;

    expect(questions.length).toBeGreaterThan(0);
  });

  test('filter test 1', async () => {
    const stuffNeedingFilter = QRData.full.find(
      (i) => i.description === 'insurance-fields-filtered-based-on-payment-option --valid'
    );
    expect(stuffNeedingFilter).toBeDefined();

    if (!stuffNeedingFilter) {
      return;
    }
    const { item } = stuffNeedingFilter;

    const filtered = recursiveGroupTransform(questions, item);

    console.log('filtered', JSON.stringify(filtered));
    expect(filtered).toBeDefined();
    const paymenOptionPage = filtered.find((p: any) => p.linkId === 'payment-option-page');
    expect(paymenOptionPage).toBeDefined();
    expect(paymenOptionPage.item).toBeDefined();

    const secondaryInsurance = paymenOptionPage.item.find((p: any) => {
      return p?.linkId === 'secondary-insurance';
    });
    expect(secondaryInsurance?.item).toBeUndefined();

    const nonPaymentOptionItems = paymenOptionPage.item.filter((i: any) => {
      return i !== undefined && i?.linkId !== 'payment-option' && (i?.item !== undefined || i?.answer !== undefined);
    });
    expect(nonPaymentOptionItems.length).toBe(0);

    const paymentOptionItem = paymenOptionPage.item.find((i: any) => {
      return i?.linkId === 'payment-option';
    });
    expect(paymentOptionItem).toBeDefined();
    expect(paymentOptionItem.item).toBeUndefined();
    expect(paymentOptionItem.answer?.[0]?.valueString).toBe('I will pay without insurance');

    const contactInfoPage = filtered.find((p: any) => p?.linkId === 'contact-information-page');
    expect(contactInfoPage?.item).toBeDefined();
    const psa = contactInfoPage?.item?.find((i: any) => i?.linkId === 'patient-street-address');
    expect(psa?.answer?.[0]?.valueString).toBeDefined();
  });

  test('filter test 2 - normalizing some fhir-invalid no-value cases so that they are fhir-valid', async () => {
    const stuffNeedingFilter = QRData.page['payment-option-page'].find(
      (i) => i.description === 'insurance-fields-with-fhir-invalid-no-value-cases --valid'
    );
    expect(stuffNeedingFilter).toBeDefined();

    if (!stuffNeedingFilter) {
      return;
    }

    const pageQuestions = questions.find((q) => q.linkId === 'payment-option-page');

    const paymenOptionPageItem = recursiveGroupTransform(pageQuestions?.item ?? [], stuffNeedingFilter.item);

    console.log('payment option page item', JSON.stringify(paymenOptionPageItem));

    const secondaryInsurance = paymenOptionPageItem.find((p: any) => {
      return p?.linkId === 'secondary-insurance';
    });
    expect(secondaryInsurance?.item).toBeDefined();
    expect(secondaryInsurance?.answer).toBeUndefined();

    const insuranceCardBack = paymenOptionPageItem.find((p: any) => {
      return p?.linkId === 'insurance-card-back';
    });
    expect(insuranceCardBack?.item).toBeUndefined();
    expect(insuranceCardBack?.answer).toBeUndefined();

    const paymentOptionItem = paymenOptionPageItem.find((i: any) => {
      return i?.linkId === 'payment-option';
    });
    expect(paymentOptionItem).toBeDefined();
    expect(paymentOptionItem.item).toBeUndefined();
    expect(paymentOptionItem.answer?.[0]?.valueString).toBe('I have insurance');
  });
});

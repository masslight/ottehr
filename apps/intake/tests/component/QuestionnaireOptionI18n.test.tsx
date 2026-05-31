import { render, screen } from '@testing-library/react';
import { FC, ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import RadioInput from '../../src/features/paperwork/components/RadioInput';
import RadioListInput from '../../src/features/paperwork/components/RadioListInput';
import i18n from '../../src/lib/i18n';

// usePaperworkContext reads from a react-router outlet; stub it so the option
// components can render in isolation.
vi.mock('../../src/features/paperwork/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/paperwork/context')>();
  return { ...actual, usePaperworkContext: () => ({ paperwork: [] }) };
});

const options = [{ valueString: 'Cough and/or congestion' }, { valueString: 'Fever' }];

const Wrapper: FC<{ children: ReactNode }> = ({ children }) => {
  const methods = useForm({ defaultValues: {} });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const radioValues = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('input[type="radio"]')).map((el) => (el as HTMLInputElement).value);

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('RadioInput questionnaire option i18n', () => {
  test('renders option labels from valueString in English', () => {
    render(
      <Wrapper>
        <RadioInput name="reason-en" linkId="reason-en" value={undefined} options={options} onChange={() => {}} />
      </Wrapper>
    );
    expect(screen.getByText('Cough and/or congestion')).toBeTruthy();
    expect(screen.getByText('Fever')).toBeTruthy();
  });

  test('translates labels by questionnaire.<linkId>.option.<value> and preserves the submitted value', async () => {
    i18n.addResourceBundle(
      'es',
      'translation',
      { 'questionnaire.reason-es.option.Cough and/or congestion': 'Tos o congestión' },
      true,
      true
    );
    await i18n.changeLanguage('es');

    const { container } = render(
      <Wrapper>
        <RadioInput name="reason-es" linkId="reason-es" value={undefined} options={options} onChange={() => {}} />
      </Wrapper>
    );

    // Translated label is shown for the option that has a translation...
    expect(screen.getByText('Tos o congestión')).toBeTruthy();
    // ...and the English label is NOT rendered for it.
    expect(screen.queryByText('Cough and/or congestion')).toBeNull();
    // Untranslated options fall back to the questionnaire-provided (English) text.
    expect(screen.getByText('Fever')).toBeTruthy();

    // Critically, the underlying selectable values are unchanged — only the display is localized.
    expect(radioValues(container)).toEqual(['Cough and/or congestion', 'Fever']);
  });

  test('falls back to English when the active language has no translation for the option', async () => {
    await i18n.changeLanguage('es');
    render(
      <Wrapper>
        <RadioInput
          name="reason-fallback"
          linkId="reason-fallback"
          value={undefined}
          options={options}
          onChange={() => {}}
        />
      </Wrapper>
    );
    expect(screen.getByText('Cough and/or congestion')).toBeTruthy();
    expect(screen.getByText('Fever')).toBeTruthy();
  });
});

describe('RadioListInput questionnaire option i18n', () => {
  test('translates labels while preserving values', async () => {
    i18n.addResourceBundle('es', 'translation', { 'questionnaire.list-reason.option.Fever': 'Fiebre' }, true, true);
    await i18n.changeLanguage('es');

    const { container } = render(
      <Wrapper>
        <RadioListInput name="list-reason" linkId="list-reason" value="" options={options} onChange={() => {}} />
      </Wrapper>
    );

    expect(screen.getByText('Fiebre')).toBeTruthy();
    expect(screen.getByText('Cough and/or congestion')).toBeTruthy();
    expect(radioValues(container)).toEqual(['Cough and/or congestion', 'Fever']);
  });
});

describe('shipped Spanish questionnaire translations', () => {
  // Validates that the real es.json `questionnaire.*` keys (not test-injected bundles)
  // are picked up by the renderer.
  test('renders shipped Spanish option labels for preferred-language while preserving values', async () => {
    await i18n.changeLanguage('es');
    const languageOptions = [{ valueString: 'Spanish' }, { valueString: 'French' }];
    const { container } = render(
      <Wrapper>
        <RadioInput
          name="preferred-language"
          linkId="preferred-language"
          value={undefined}
          options={languageOptions}
          onChange={() => {}}
        />
      </Wrapper>
    );
    expect(screen.getByText('Español')).toBeTruthy();
    expect(screen.getByText('Francés')).toBeTruthy();
    expect(radioValues(container)).toEqual(['Spanish', 'French']);
  });

  test('renders shipped Spanish for booking reason-for-visit options while preserving values', async () => {
    await i18n.changeLanguage('es');
    const reasonOptions = [{ valueString: 'Auto accident' }, { valueString: 'Fever' }];
    const { container } = render(
      <Wrapper>
        <RadioInput
          name="reason-for-visit"
          linkId="reason-for-visit"
          value={undefined}
          options={reasonOptions}
          onChange={() => {}}
        />
      </Wrapper>
    );
    expect(screen.getByText('Accidente automovilístico')).toBeTruthy();
    expect(screen.getByText('Fiebre')).toBeTruthy();
    expect(radioValues(container)).toEqual(['Auto accident', 'Fever']);
  });
});

import { describe, expect, it } from 'vitest';
import { i18nextCreator } from './i18nextCreator';

describe('i18nextCreator', () => {
  it('does not HTML-escape interpolation values rendered by React', async () => {
    const i18n = i18nextCreator({
      en: {
        translation: {
          title: 'Thank you for choosing {{projectName}}!',
        },
      },
    });

    await i18n.changeLanguage('en');

    expect(i18n.t('title', { projectName: 'Example Health & Family Practice' })).toBe(
      'Thank you for choosing Example Health & Family Practice!'
    );
  });
});

import { render, screen } from '@testing-library/react';
import { PHONE_NOT_ON_FILE } from 'utils';
import { describe, expect, it } from 'vitest';
import { PreferredPharmacy } from '../../src/features/visits/shared/components/PreferredPharmacy';

describe('PreferredPharmacy', () => {
  it('shows the phone in the details line when present', () => {
    render(
      <PreferredPharmacy
        data={[
          {
            name: 'Walgreens',
            address: '123 Pineapple St, Brooklyn, NY 11201',
            phone: '(555) 867-5309',
          },
        ]}
      />
    );

    expect(screen.getByText('Walgreens / 123 Pineapple St, Brooklyn, NY 11201 / (555) 867-5309')).toBeDefined();
  });

  it('shows the not-on-file fallback in the details line when there is no phone', () => {
    render(
      <PreferredPharmacy
        data={[
          {
            name: 'Walgreens',
            address: '123 Pineapple St, Brooklyn, NY 11201',
          },
        ]}
      />
    );

    expect(screen.getByText(`Walgreens / 123 Pineapple St, Brooklyn, NY 11201 / ${PHONE_NOT_ON_FILE}`)).toBeDefined();
  });
});

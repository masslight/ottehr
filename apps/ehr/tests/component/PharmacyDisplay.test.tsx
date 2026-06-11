import { render, screen } from '@testing-library/react';
import { PharmacyDisplay } from 'ui-components';
import { PHONE_NOT_ON_FILE } from 'utils';
import { describe, expect, it, vi } from 'vitest';

const dataTestIds = {
  text: 'pharmacy-display-text',
  button: 'pharmacy-display-clear',
};

describe('PharmacyDisplay', () => {
  it('renders the phone number when present', () => {
    render(
      <PharmacyDisplay
        selectedPlace={{
          placesId: 'some-places-id',
          name: 'Walgreens',
          address: '123 Pineapple St, Brooklyn, NY 11201',
          phone: '(555) 867-5309',
        }}
        clearPharmacyData={vi.fn()}
        dataTestIds={dataTestIds}
      />
    );

    expect(screen.getByText('Walgreens')).toBeDefined();
    expect(screen.getByText('123 Pineapple St, Brooklyn, NY 11201')).toBeDefined();
    expect(screen.getByText('(555) 867-5309')).toBeDefined();
  });

  it('renders the not-on-file fallback when there is no phone', () => {
    render(
      <PharmacyDisplay
        selectedPlace={{
          placesId: 'some-places-id',
          name: 'Walgreens',
          address: '123 Pineapple St, Brooklyn, NY 11201',
        }}
        clearPharmacyData={vi.fn()}
        dataTestIds={dataTestIds}
      />
    );

    expect(screen.getByText(PHONE_NOT_ON_FILE)).toBeDefined();
  });
});

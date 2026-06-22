import { render, screen } from '@testing-library/react';
import { PharmacyDTO, PHONE_NOT_ON_FILE } from 'utils';
import { describe, expect, it } from 'vitest';
import { PreferredPharmacy } from '../../src/features/visits/shared/components/PreferredPharmacy';

const pharmacy: PharmacyDTO = {
  name: 'Walgreens',
  address: '123 Pineapple St, Brooklyn, NY 11201',
  phone: '(555) 867-5309',
};

describe('PreferredPharmacy', () => {
  it('renders nothing when there are no pharmacies', () => {
    const { container } = render(<PreferredPharmacy data={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders the section title and the details line', () => {
    render(<PreferredPharmacy data={[pharmacy]} />);

    expect(screen.getByText('Preferred pharmacy')).toBeDefined();
    expect(screen.getByText('Walgreens / 123 Pineapple St, Brooklyn, NY 11201 / (555) 867-5309')).toBeDefined();
  });

  it('shows the not-on-file fallback in the details line when there is no phone', () => {
    render(
      <PreferredPharmacy
        data={[
          {
            ...pharmacy,
            phone: undefined,
          },
        ]}
      />
    );

    expect(screen.getByText(`Walgreens / 123 Pineapple St, Brooklyn, NY 11201 / ${PHONE_NOT_ON_FILE}`)).toBeDefined();
  });

  it('renders a row per pharmacy', () => {
    render(
      <PreferredPharmacy
        data={[
          pharmacy,
          {
            name: 'Corner Drugs',
            address: '1 Main St',
            phone: '(555) 111-2222',
          },
        ]}
      />
    );

    expect(screen.getByText(/^Walgreens/)).toBeDefined();
    expect(screen.getByText('Corner Drugs / 1 Main St / (555) 111-2222')).toBeDefined();
  });

  it('marks the primary pharmacy for the visit', () => {
    render(
      <PreferredPharmacy
        data={[
          {
            ...pharmacy,
            primary: true,
          },
        ]}
      />
    );

    expect(screen.getByText('Primary for this visit')).toBeDefined();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PharmacyDisplay } from 'ui-components';
import { PHONE_NOT_ON_FILE, PlacesResult } from 'utils';
import { describe, expect, it, vi } from 'vitest';

const dataTestIds = {
  text: 'pharmacy-display-text',
  button: 'pharmacy-display-clear',
};

const selectedPlace: PlacesResult = {
  placesId: 'some-places-id',
  name: 'Walgreens',
  address: '123 Pineapple St, Brooklyn, NY 11201',
  phone: '(555) 867-5309',
};

describe('PharmacyDisplay', () => {
  it('renders the pharmacy name and address', () => {
    render(<PharmacyDisplay selectedPlace={selectedPlace} clearPharmacyData={vi.fn()} dataTestIds={dataTestIds} />);

    expect(screen.getByText('Walgreens')).toBeDefined();
    expect(screen.getByText('123 Pineapple St, Brooklyn, NY 11201')).toBeDefined();
  });

  it('renders the phone number when present', () => {
    render(<PharmacyDisplay selectedPlace={selectedPlace} clearPharmacyData={vi.fn()} dataTestIds={dataTestIds} />);

    expect(screen.getByText('(555) 867-5309')).toBeDefined();
  });

  it('renders the not-on-file fallback when there is no phone', () => {
    render(
      <PharmacyDisplay
        selectedPlace={{
          ...selectedPlace,
          phone: undefined,
        }}
        clearPharmacyData={vi.fn()}
        dataTestIds={dataTestIds}
      />
    );

    expect(screen.getByText(PHONE_NOT_ON_FILE)).toBeDefined();
  });

  it('applies the provided data test ids', () => {
    render(<PharmacyDisplay selectedPlace={selectedPlace} clearPharmacyData={vi.fn()} dataTestIds={dataTestIds} />);

    expect(screen.getByTestId(dataTestIds.text)).toBeDefined();
    expect(screen.getByTestId(dataTestIds.button)).toBeDefined();
  });

  it('calls clearPharmacyData when the delete button is clicked', async () => {
    const clearPharmacyData = vi.fn();
    render(
      <PharmacyDisplay selectedPlace={selectedPlace} clearPharmacyData={clearPharmacyData} dataTestIds={dataTestIds} />
    );

    await userEvent.click(screen.getByTestId(dataTestIds.button));

    expect(clearPharmacyData).toHaveBeenCalledTimes(1);
  });
});

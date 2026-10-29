import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { ErxDirectoryPharmacy, ErxDirectoryQuery } from 'utils/lib/types/api/erx-search.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnFilePharmacy, PharmacySearch } from '../../src/features/visits/in-person/components/erx/PharmacySearch';
import { usePreferredPharmacy } from '../../src/features/visits/shared/hooks/useErxPharmacies';

const mocks = vi.hoisted(() => ({ searchPlaces: vi.fn(), searchPharmacyDirectory: vi.fn() }));

vi.mock('src/hooks/useAuthToken', () => ({ useAuthToken: () => 'user-token' }));
vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({ searchPlaces: mocks.searchPlaces }),
}));
vi.mock('src/api/api', () => ({ searchPharmacyDirectory: mocks.searchPharmacyDirectory }));

const directoryRow = (overrides: Partial<ErxDirectoryPharmacy>): ErxDirectoryPharmacy => ({
  ncpdpId: '4400001',
  npi: '1234567893',
  name: 'CVS/PHARMACY #7741',
  address1: '1200 S CONGRESS AVE',
  city: 'AUSTIN',
  state: 'TX',
  zipCode: '787041234',
  phone: '5125550142',
  specialties: [],
  ...overrides,
});
const CVS = directoryRow({});
const HEB = directoryRow({ ncpdpId: '4400002', name: 'HEB PHARMACY #612', address1: '2400 S CONGRESS AVE' });
const WALGREENS = directoryRow({ ncpdpId: '4400003', name: 'WALGREENS #09552', address1: '2501 S LAMAR BLVD' });
const NO_NPI = directoryRow({ ncpdpId: '4400004', name: 'NO NPI PHARMACY', address1: '1 MAIN ST', npi: undefined });
const DIRECTORY = [CVS, HEB, WALGREENS, NO_NPI];

const result = (row: ErxDirectoryPharmacy): Record<string, string> => ({
  ncpdpId: row.ncpdpId,
  npi: row.npi!,
  name: row.name,
  phone: row.phone!,
  address: `${row.address1}, AUSTIN, TX 78704`,
});

// Google's places: CVS and Wilson's (not in the directory).
const PLACES = {
  'place-cvs': {
    name: 'CVS Pharmacy',
    address: '1200 S Congress Ave, Austin, TX',
    number: '1200',
    street: 'S Congress Ave',
  },
  'place-wilson': {
    name: "Wilson's Family Pharmacy",
    address: '418 E Oltorf St, Austin, TX',
    number: '418',
    street: 'E Oltorf St',
  },
} as const;

/** The directory search as the service does it: "contains" on the address and city, exact on the rest. */
const searchDirectory = async (_token: string, query: ErxDirectoryQuery): Promise<ErxDirectoryPharmacy[]> =>
  DIRECTORY.filter(
    (row) =>
      (!query.address || row.address1.toLowerCase().includes(query.address.toLowerCase())) &&
      (!query.city || row.city.toLowerCase().includes(query.city.toLowerCase())) &&
      (!query.state || row.state === query.state) &&
      (!query.zipCode || row.zipCode.includes(query.zipCode)) &&
      (!query.ncpdpId || row.ncpdpId === query.ncpdpId) &&
      (!query.name || row.name.toLowerCase().includes(query.name.toLowerCase())) &&
      (!query.phone || row.phone === query.phone)
  );

const searchPlaces = async ({
  searchTerm,
  placesId,
}: {
  searchTerm?: string;
  placesId?: string;
}): Promise<unknown> => ({
  pharmacyPlaces: Object.entries(PLACES)
    .filter(([id, place]) =>
      searchTerm ? place.name.toLowerCase().includes(searchTerm.toLowerCase().split(' ')[0]) : id === placesId
    )
    .map(([id, place]) => ({
      placesId: id,
      name: place.name,
      address: place.address,
      ...(placesId
        ? {
            addressComponents: {
              streetNumber: place.number,
              streetLong: place.street,
              streetShort: place.street,
              city: 'Austin',
              stateShort: 'TX',
              zipCode: '78704',
            },
          }
        : {}),
    })),
});

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const renderPicker = (props: Partial<Parameters<typeof PharmacySearch>[0]> = {}): ReturnType<typeof vi.fn> => {
  const onPick = vi.fn();
  render(<PharmacySearch onPick={onPick} {...props} />, { wrapper });
  return onPick;
};

const ON_FILE: OnFilePharmacy = {
  firstName: 'Maria',
  saved: { name: 'CVS Pharmacy', address: '1200 S Congress Ave, Austin, TX 78704', primary: true },
  pharmacy: result(CVS) as unknown as OnFilePharmacy['pharmacy'],
};

describe('eRx pharmacy picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchPlaces.mockImplementation(searchPlaces);
    mocks.searchPharmacyDirectory.mockImplementation(searchDirectory);
  });

  it('lists the pharmacy on file and the ones sent to before, before anything is typed', async () => {
    const user = userEvent.setup();
    const onPick = renderPicker({
      onFile: ON_FILE,
      sentBefore: [
        { ncpdpId: WALGREENS.ncpdpId, name: 'Walgreens' },
        { ncpdpId: '4499999', name: 'Closed Pharmacy' },
        // The one on file isn't listed twice.
        { ncpdpId: CVS.ncpdpId, name: 'CVS' },
      ],
    });
    expect(screen.getByText('On file for Maria')).toBeInTheDocument();
    expect(screen.getByText('Sent to before')).toBeInTheDocument();
    const onFile = screen.getByRole('option', { name: /CVS\/PHARMACY #7741 \(preferred\)/ });
    expect(within(onFile).getByText('eRx ✓')).toBeInTheDocument();
    const walgreens = await screen.findByRole('option', { name: /WALGREENS #09552.*eRx ✓/ });
    expect(walgreens).toHaveAttribute('aria-disabled', 'false');
    // No longer in the directory: it can't take e-prescriptions.
    const closed = await screen.findByRole('option', { name: /Closed Pharmacy.*Can't e-prescribe/ });
    expect(closed).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    await user.click(walgreens);
    expect(onPick).toHaveBeenCalledWith(result(WALGREENS));
  });

  it('shows a saved pharmacy that matches nothing as one that can’t e-prescribe', () => {
    renderPicker({ onFile: { ...ON_FILE, pharmacy: null } });
    const onFile = screen.getByRole('option', { name: /CVS Pharmacy \(preferred\)/ });
    expect(within(onFile).getByText("Can't e-prescribe")).toBeInTheDocument();
    expect(onFile).toHaveAttribute('aria-disabled', 'true');
  });

  it('checks a Google pick against the directory and picks the match', async () => {
    const user = userEvent.setup();
    const onPick = renderPicker();
    await user.type(screen.getByRole('combobox', { name: 'Pharmacy' }), 'cvs congress');
    await user.click(await screen.findByRole('option', { name: /CVS Pharmacy/ }));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(result(CVS)));
    expect(mocks.searchPharmacyDirectory).toHaveBeenCalledWith('user-token', {
      address: '1200 s',
      city: 'Austin',
      state: 'TX',
    });
  });

  it('says a pick outside the directory can’t receive e-prescriptions, and lists those in its zip', async () => {
    const user = userEvent.setup();
    const onPick = renderPicker();
    await user.type(screen.getByRole('combobox', { name: 'Pharmacy' }), 'wilson oltorf');
    await user.click(await screen.findByRole('option', { name: /Wilson's Family Pharmacy/ }));
    expect(
      await screen.findByText("Wilson's Family Pharmacy can't receive e-prescriptions. Pick another pharmacy.")
    ).toBeInTheDocument();
    expect(await screen.findByText('Can receive e-prescriptions in 78704')).toBeInTheDocument();
    // A directory row without an NPI can't be ordered to, so it isn't offered.
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'CVS/PHARMACY #77411200 S CONGRESS AVE, AUSTIN, TX 78704',
      'HEB PHARMACY #6122400 S CONGRESS AVE, AUSTIN, TX 78704',
      'WALGREENS #095522501 S LAMAR BLVD, AUSTIN, TX 78704',
    ]);
    expect(onPick).not.toHaveBeenCalled();
    await user.click(screen.getByRole('option', { name: /HEB PHARMACY #612/ }));
    expect(onPick).toHaveBeenCalledWith(result(HEB));
  });

  it('searches the directory for what’s typed on request, and goes back to Google', async () => {
    const user = userEvent.setup();
    const onPick = renderPicker();
    const field = screen.getByRole('combobox', { name: 'Pharmacy' });
    await user.type(field, 'heb');
    // Google finds nothing, so the row is all there is.
    await user.click(
      await screen.findByRole('option', { name: 'Search compounding, mail-order and other pharmacies for "heb"' })
    );
    expect(await screen.findByText('Compounding, mail-order and other pharmacies')).toBeInTheDocument();
    expect(mocks.searchPharmacyDirectory).toHaveBeenCalledWith('user-token', { name: 'heb' });
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'HEB PHARMACY #6122400 S CONGRESS AVE, AUSTIN, TX 78704',
      'Back to Google results',
    ]);
    await user.click(screen.getByRole('option', { name: 'Back to Google results' }));
    expect(screen.queryByText('Compounding, mail-order and other pharmacies')).not.toBeInTheDocument();
    // With the keyboard, as any other row.
    await user.keyboard('{ArrowUp}{Enter}');
    await screen.findByText('Compounding, mail-order and other pharmacies');
    await user.click(await screen.findByRole('option', { name: /HEB PHARMACY #612/ }));
    expect(onPick).toHaveBeenCalledWith(result(HEB));
    // Typing again returns to Google.
    await user.type(field, ' x');
    expect(screen.queryByText('Compounding, mail-order and other pharmacies')).not.toBeInTheDocument();
  });

  it.each([
    ['78704', { zipCode: '78704' }],
    ['4400002', { ncpdpId: '4400002' }],
    ['(512) 555-0142', { phone: '5125550142' }],
    ['12345678', { name: '12345678' }],
  ])('searches the directory for "%s" as %o', async (typed, query) => {
    const user = userEvent.setup();
    renderPicker();
    await user.type(screen.getByRole('combobox', { name: 'Pharmacy' }), typed);
    await user.click(screen.getByRole('option', { name: /^Search compounding/ }));
    await waitFor(() => expect(mocks.searchPharmacyDirectory).toHaveBeenCalledWith('user-token', query));
  });

  it('shows the error when Google can’t be searched', async () => {
    mocks.searchPlaces.mockRejectedValue(new Error('Google is down'));
    const user = userEvent.setup();
    renderPicker();
    await user.type(screen.getByRole('combobox', { name: 'Pharmacy' }), 'cvs');
    expect(await screen.findByText('Google is down')).toBeInTheDocument();
  });
});

describe('preferred pharmacy lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchPlaces.mockImplementation(searchPlaces);
    mocks.searchPharmacyDirectory.mockImplementation(searchDirectory);
  });

  it('matches a pharmacy picked with Google by its place', async () => {
    const saved = {
      name: 'CVS Pharmacy',
      address: '1200 S Congress Ave, Austin, TX 78704, USA',
      placesId: 'place-cvs',
    };
    const { result: hook } = renderHook(() => usePreferredPharmacy('patient-1', saved), { wrapper });
    await waitFor(() => expect(hook.current.data).toEqual(result(CVS)));
    expect(mocks.searchPlaces).toHaveBeenCalledWith({ placesId: 'place-cvs' });
  });

  it('matches a pharmacy entered by hand by its saved address', async () => {
    const saved = { name: 'H-E-B Pharmacy', address: '2400 South Congress Avenue, Austin, TX 78704' };
    const { result: hook } = renderHook(() => usePreferredPharmacy('patient-1', saved), { wrapper });
    await waitFor(() => expect(hook.current.data).toEqual(result(HEB)));
    expect(mocks.searchPlaces).not.toHaveBeenCalled();
  });

  it('is null when the saved pharmacy matches nothing', async () => {
    const saved = { name: "Wilson's Family Pharmacy", address: '418 E Oltorf St, Austin, TX 78704' };
    const { result: hook } = renderHook(() => usePreferredPharmacy('patient-1', saved), { wrapper });
    await waitFor(() => expect(hook.current.data).toBeNull());
  });
});

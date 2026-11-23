import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime, Settings } from 'luxon';
import { ReactNode, useState } from 'react';
import { vaccineSiteLocations } from 'utils/lib/types/api/medication-administration.types';
import { CVX_VACCINES } from 'utils/lib/types/data/immunization/cvx-vaccines.generated';
import { MVX_MANUFACTURERS } from 'utils/lib/types/data/immunization/mvx-manufacturers.generated';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (must come before component imports) ─────────────────────────────

vi.mock('src/features/immunization/hooks/useImmunizationDiagnosisOptions', () => ({
  useImmunizationDiagnosisOptions: () => [{ resourceId: 'cond-1', display: 'Z23 - Encounter for immunization' }],
}));

vi.mock('src/components/input/EmployeeSelectInput', () => ({
  useEmployeeOptions: () => ({ options: [{ id: 'prov-1', name: 'Dr. Test' }], isLoading: false }),
}));

vi.mock('src/components/input/CptCodesInput', () => ({
  CptCodesInput: () => <div data-testid="cpt-codes-input" />,
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import {
  emptyImmunizationForm,
  ImmunizationFormValues,
} from '../../src/features/immunization/components/immunizationForm';
import {
  ImmunizationSentences,
  SAVE_QUICK_PICK_LABEL,
} from '../../src/features/immunization/components/ImmunizationSentences';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TDAP = { id: '115', name: 'Tdap' };
const MERCK = MVX_MANUFACTURERS.find((manufacturer) => manufacturer.mvx === 'MSD')!;

const QUICK_PICK = {
  id: 'qp-1',
  name: 'Adult booster 0.5 mL IM',
  vaccine: TDAP,
  dose: '0.5',
  units: 'ml',
};

const form = (
  details: ImmunizationFormValues['details'] = {},
  administrationDetails: ImmunizationFormValues['administrationDetails'] = {}
): ImmunizationFormValues => {
  const empty = emptyImmunizationForm();
  return {
    details: { ...empty.details, ...details },
    administrationDetails: { ...empty.administrationDetails, ...administrationDetails },
  };
};

type SentencesProps = Parameters<typeof ImmunizationSentences>[0];

const renderSentences = (
  values: ImmunizationFormValues,
  props: Partial<SentencesProps> = {}
): { onChange: ReturnType<typeof vi.fn>; onQuickPick: ReturnType<typeof vi.fn> } => {
  const onChange = vi.fn();
  const onQuickPick = vi.fn();
  render(
    <ImmunizationSentences
      values={values}
      onChange={onChange}
      quickPicks={[QUICK_PICK]}
      onQuickPick={onQuickPick}
      errors={[]}
      readOnly={false}
      {...props}
    />
  );
  return { onChange, onQuickPick };
};

/** The sentences over real state, so typing into a blank shows and the last values can be read. */
const renderWithState = (
  start: ImmunizationFormValues,
  props: Partial<SentencesProps> = {}
): { saved: () => ImmunizationFormValues } => {
  let saved = start;
  const Harness = (): ReactNode => {
    const [values, setValues] = useState(start);
    saved = values;
    return (
      <ImmunizationSentences
        values={values}
        onChange={setValues}
        quickPicks={[]}
        onQuickPick={vi.fn()}
        errors={[]}
        readOnly={false}
        {...props}
      />
    );
  };
  render(<Harness />);
  return { saved: () => saved };
};

const isNeeded = (testId: string): boolean => screen.getByTestId(testId).hasAttribute('data-needed');

const ADMINISTRATION_BLANKS = [
  dataTestIds.vaccineDetailsPage.administeredDate,
  dataTestIds.vaccineDetailsPage.administeredTime,
  dataTestIds.vaccineDetailsPage.lotNumber,
  dataTestIds.vaccineDetailsPage.expiredDate,
  dataTestIds.vaccineDetailsPage.ndcCode,
  dataTestIds.orderVaccinePage.manufacturer,
  dataTestIds.vaccineDetailsPage.visGivenDate,
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ImmunizationSentences - the order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the blanks the order requires, and only those', () => {
    renderSentences(form());

    expect(isNeeded(dataTestIds.orderVaccinePage.vaccine)).toBe(true);
    expect(isNeeded(dataTestIds.orderVaccinePage.dose)).toBe(true);
    expect(isNeeded(dataTestIds.orderVaccinePage.units)).toBe(true);
    expect(isNeeded(dataTestIds.orderVaccinePage.orderedBy)).toBe(true);
    expect(isNeeded(dataTestIds.orderVaccinePage.associatedDx)).toBe(false);
    expect(isNeeded(dataTestIds.orderVaccinePage.route)).toBe(false);
    expect(isNeeded(dataTestIds.orderVaccinePage.location)).toBe(false);
    for (const blank of [...ADMINISTRATION_BLANKS, dataTestIds.vaccineDetailsPage.cptCode]) {
      expect(isNeeded(blank)).toBe(false);
    }
  });

  it('reads as a sentence, with "via" between the units and the route', () => {
    renderSentences(
      form({
        medication: TDAP,
        dose: '1',
        units: 'ml',
        route: '26643006',
        location: { code: '123851003', name: 'Mouth' },
        orderedProvider: { id: 'prov-1', name: 'Dr. Test' },
      })
    );

    expect(screen.getByTestId(dataTestIds.orderVaccinePage.dose)).toHaveValue(1);
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.units)).toHaveTextContent('mL');
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.route)).toHaveTextContent('oral route');
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.location)).toHaveTextContent('mouth');
    // the dose is an input, so its value is not part of the sentence's text
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.route).closest('.MuiTypography-root')).toHaveTextContent(
      /^Give mL via oral route in the mouth\S?\.$/
    );
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine).closest('.MuiTypography-root')).toHaveTextContent(
      /^Tdap for add diagnosis\S?\.$/
    );
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.orderedBy)).toHaveTextContent('Dr. Test');
  });

  it('offers the vaccine site list in its own order, and picking a site saves its code and name', async () => {
    const { saved } = renderWithState(form({ medication: TDAP }));
    const user = userEvent.setup();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.location));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(
      vaccineSiteLocations.map((site) => site.name)
    );
    // the in-house medication sites are not offered
    expect(screen.queryByRole('option', { name: 'given via nebulizer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Volume divided - Left vastus lateralis' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Left thigh (vastus lateralis)' }));
    expect(saved().details.location).toEqual({ code: '61396006', name: 'Left thigh (vastus lateralis)' });
  });

  it('a site saved from the medication list still reads, and stays offered until another is picked', async () => {
    renderSentences(form({ medication: TDAP, location: { code: '206007', name: 'Left Gluteus Maximus' } }));
    const location = screen.getByTestId(dataTestIds.orderVaccinePage.location);
    expect(location).toHaveTextContent(/left gluteus maximus/i);

    await userEvent.setup().click(location);
    expect(screen.getByRole('option', { name: 'Left Gluteus Maximus' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Left gluteus' })).toBeInTheDocument();
  });

  it('offers every vaccine of the vaccine list in the immunization menu', async () => {
    renderSentences(form());

    await userEvent.setup().click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));

    const options = within(screen.getByRole('listbox', { name: 'Vaccines' })).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(CVX_VACCINES.map((vaccine) => vaccine.name));
  });

  it('picking a vaccine from the menu fills only the vaccine: its id is its CVX code', async () => {
    const values = form({ dose: '1', orderedProvider: { id: 'prov-1', name: 'Dr. Test' } });
    const { onChange, onQuickPick } = renderSentences(values);
    const user = userEvent.setup();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));
    await user.type(screen.getByRole('combobox', { name: 'Immunization' }), 'tdap');
    // a string name matches the whole option, so this is "Tdap" and not "Tdap, Td, ..." or another containing it
    await user.click(within(screen.getByRole('listbox', { name: 'Vaccines' })).getByRole('option', { name: 'Tdap' }));

    expect(onQuickPick).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({ ...values, details: { ...values.details, medication: TDAP } });
  });

  it('lists quick picks by their name or vaccine, and picking one hands it to the caller', async () => {
    const { onChange, onQuickPick } = renderSentences(form());
    const user = userEvent.setup();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));
    await user.type(screen.getByRole('combobox', { name: 'Immunization' }), 'tdap');
    const quickPicks = screen.getByRole('listbox', { name: 'Quick picks' });
    await user.click(within(quickPicks).getByRole('option', { name: 'Adult booster 0.5 mL IM' }));

    expect(onQuickPick).toHaveBeenCalledWith(QUICK_PICK);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('says so while the quick picks load', async () => {
    renderSentences(form(), { quickPicks: [], quickPicksLoading: true });

    await userEvent.setup().click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));

    expect(screen.getByText('Loading quick picks…')).toBeInTheDocument();
    expect(screen.queryByText('No quick picks yet')).not.toBeInTheDocument();
  });

  it('offers the vaccine list alone where no quick pick can be applied', async () => {
    renderSentences(form(), { quickPicks: undefined });

    await userEvent.setup().click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));

    expect(screen.getByRole('listbox', { name: 'Vaccines' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: 'Quick picks' })).not.toBeInTheDocument();
  });

  it('picks the diagnosis from the visit, and takes it away again', async () => {
    const { saved } = renderWithState(form());
    const user = userEvent.setup();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.associatedDx));
    await user.click(await screen.findByRole('option', { name: 'Z23 - Encounter for immunization' }));
    expect(saved().details.associatedDx).toEqual({ resourceId: 'cond-1', display: 'Z23 - Encounter for immunization' });
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.associatedDx)).toHaveTextContent(
      'Z23 - Encounter for immunization'
    );

    await user.click(screen.getByRole('button', { name: 'Remove diagnosis' }));
    expect(saved().details.associatedDx).toBeUndefined();
  });

  it('picks the ordering provider from the providers', async () => {
    const { saved } = renderWithState(form());
    const user = userEvent.setup();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.orderedBy));
    await user.click(await screen.findByRole('option', { name: 'Dr. Test' }));

    expect(saved().details.orderedProvider).toEqual({ id: 'prov-1', name: 'Dr. Test' });
  });

  it('names the ordering provider as the provider list does, and by the saved name when not listed', () => {
    renderSentences(form({ orderedProvider: { id: 'prov-1', name: 'Dr. Test, MD' } }));
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.orderedBy)).toHaveTextContent(/^Dr\. Test$/);
    cleanup();

    renderSentences(form({ orderedProvider: { id: 'prov-gone', name: 'Dr. Former, MD' } }));
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.orderedBy)).toHaveTextContent(/^Dr\. Former, MD$/);
  });

  it('offers instructions as a link until opened, then takes several lines', async () => {
    const { saved } = renderWithState(form());
    const user = userEvent.setup();

    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.instructions)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /\+ instructions/ }));

    const instructions = screen.getByTestId(dataTestIds.orderVaccinePage.instructions);
    expect(instructions.tagName).toBe('TEXTAREA');
    await user.type(instructions, 'After consent{Enter}Observe 15 minutes');
    expect(saved().details.instructions).toBe('After consent\nObserve 15 minutes');

    await user.click(screen.getByRole('button', { name: 'Remove instructions' }));
    expect(saved().details.instructions).toBe('');
    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.instructions)).not.toBeInTheDocument();
  });

  it('shows saved instructions without asking to open them', () => {
    renderSentences(form({ instructions: 'After consent' }));

    expect(screen.getByTestId(dataTestIds.orderVaccinePage.instructions)).toHaveValue('After consent');
  });

  it('lists what is missing once the caller reports it', () => {
    renderSentences(form(), { errors: ['Pick the immunization', 'Enter the dose'] });

    expect(screen.getByText('Pick the immunization. Enter the dose.')).toBeInTheDocument();
  });

  it('lets admins save a form that has a vaccine as a quick pick', async () => {
    const onSaveQuickPick = vi.fn();
    renderSentences(form(), { onSaveQuickPick });
    expect(screen.queryByRole('button', { name: SAVE_QUICK_PICK_LABEL })).not.toBeInTheDocument();

    renderSentences(form({ medication: TDAP }), { onSaveQuickPick });
    await userEvent.setup().click(screen.getByRole('button', { name: SAVE_QUICK_PICK_LABEL }));
    expect(onSaveQuickPick).toHaveBeenCalledTimes(1);
  });

  it('shows the values as plain text, with nothing to change, when read-only', () => {
    renderSentences(form({ medication: TDAP, dose: '0.5', instructions: 'After consent' }, { lot: 'L-42' }), {
      readOnly: true,
      onSaveQuickPick: vi.fn(),
    });

    expect(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine)).toHaveTextContent('Tdap');
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.dose)).toHaveTextContent('0.5');
    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.lotNumber)).toHaveTextContent('L-42');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ImmunizationSentences - the administration details', () => {
  it('shows them as sentences with the saved values, and has no CVX or MVX input', () => {
    renderSentences(
      form(
        { medication: TDAP, manufacturer: MERCK.name },
        { lot: 'L-42', ndc: '00006-4681-00', expDate: '2027-01-31', mvx: 'MSD' }
      )
    );

    expect(screen.getByRole('heading', { name: 'Administration' })).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.lotNumber)).toHaveValue('L-42');
    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.ndcCode)).toHaveValue('00006-4681-00');
    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.expiredDate)).toHaveValue('01/31/2027');
    // the manufacturer reads by its name; its MVX code is saved with it, never typed
    const manufacturer = screen.getByTestId(dataTestIds.orderVaccinePage.manufacturer);
    expect(manufacturer).toHaveTextContent(/^Merck and Co., Inc.$/);
    // a name that ends in a full stop ends the sentence with it
    expect(manufacturer.closest('.MuiTypography-root')).toHaveTextContent(/^Manufacturer Merck and Co., Inc\.$/);
    expect(screen.queryByText(/CVX/)).not.toBeInTheDocument();
    expect(screen.queryByText(/MVX/)).not.toBeInTheDocument();
  });

  it('ends the manufacturer sentence with a full stop when the name has none', () => {
    renderSentences(form({ manufacturer: 'Pfizer, Inc' }, { mvx: 'PFR' }));

    expect(
      screen.getByTestId(dataTestIds.orderVaccinePage.manufacturer).closest('.MuiTypography-root')
    ).toHaveTextContent(/^Manufacturer Pfizer, Inc\S?\.$/);
  });

  it('picks the manufacturer from the MVX list, which sets its name and its MVX code together', async () => {
    const { saved } = renderWithState(form({ medication: TDAP }));
    const user = userEvent.setup();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.manufacturer));
    expect(within(screen.getByRole('listbox', { name: 'Manufacturer' })).getAllByRole('option')).toHaveLength(
      MVX_MANUFACTURERS.length
    );
    await user.type(screen.getByRole('textbox', { name: 'Filter manufacturer' }), 'merck and');
    await user.click(screen.getByRole('option', { name: MERCK.name }));

    expect(saved().details.manufacturer).toBe(MERCK.name);
    expect(saved().administrationDetails.mvx).toBe('MSD');
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.manufacturer)).toHaveTextContent(MERCK.name);
  });

  it('clears the manufacturer and its MVX code together', async () => {
    const { saved } = renderWithState(form({ manufacturer: MERCK.name }, { mvx: 'MSD' }));
    const user = userEvent.setup();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.manufacturer));
    await user.click(screen.getByRole('option', { name: 'Clear' }));

    expect(saved().details.manufacturer).toBe('');
    expect(saved().administrationDetails.mvx).toBe('');
  });

  it('shows a manufacturer and MVX code typed before the list, until one from the list replaces them', async () => {
    const { saved } = renderWithState(form({ manufacturer: 'example' }, { mvx: '1111fff' }));
    const user = userEvent.setup();

    const manufacturer = screen.getByTestId(dataTestIds.orderVaccinePage.manufacturer);
    expect(manufacturer).toHaveTextContent('example (MVX 1111fff)');
    // untouched, they are saved as they were
    expect(saved()).toMatchObject({ details: { manufacturer: 'example' }, administrationDetails: { mvx: '1111fff' } });

    await user.click(manufacturer);
    expect(screen.getByRole('option', { name: 'example (MVX 1111fff)' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('option', { name: MERCK.name }));

    expect(saved()).toMatchObject({ details: { manufacturer: MERCK.name }, administrationDetails: { mvx: 'MSD' } });
  });

  it('reads "VIS given to the patient on [date]", with no way to say it was not given', async () => {
    const { saved } = renderWithState(form({ medication: TDAP }));
    const user = userEvent.setup();

    expect(screen.getByText(/VIS given to the patient on/)).toBeInTheDocument();
    expect(screen.queryByText(/not given/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(screen.getByTestId(dataTestIds.vaccineDetailsPage.visGivenDate));
    await user.keyboard('11102026');

    expect(saved().administrationDetails).toMatchObject({ visGivenDate: '2026-11-10', visGiven: true });
  });

  it('a cleared VIS date is a VIS not recorded as given', async () => {
    const { saved } = renderWithState(form({ medication: TDAP }, { visGivenDate: '2026-11-10', visGiven: true }));
    const user = userEvent.setup();

    await user.clear(screen.getByTestId(dataTestIds.vaccineDetailsPage.visGivenDate));

    expect(saved().administrationDetails.visGivenDate).toBeUndefined();
    expect(saved().administrationDetails.visGiven).toBe(false);
  });

  it('marks what administering requires on the details card: everything but the CPT codes', () => {
    renderSentences(form({ medication: TDAP }), { needAdministration: true });

    for (const blank of ADMINISTRATION_BLANKS) expect(isNeeded(blank)).toBe(true);
    expect(isNeeded(dataTestIds.vaccineDetailsPage.cptCode)).toBe(false);
  });

  it('opens the CPT code search from its blank and reads the picked codes', async () => {
    renderSentences(
      form(
        {},
        {
          cptCodes: [
            { code: '90715', display: 'Tdap' },
            { code: '90471', display: 'Immunization admin' },
          ],
        }
      )
    );

    const cptCodes = screen.getByTestId(dataTestIds.vaccineDetailsPage.cptCode);
    expect(cptCodes).toHaveTextContent('90715, 90471');
    await userEvent.setup().click(cptCodes);
    expect(screen.getByTestId('cpt-codes-input')).toBeInTheDocument();
  });

  it('a typed given date keeps the date and opens at the current time', async () => {
    // Browsers give the years typed on the way to 2026 (0002, 0020, 0202) offsets with seconds (-04:56:02);
    // an IANA default zone does the same here, where Node's system zone rounds them to whole minutes.
    const defaultZone = Settings.defaultZone;
    Settings.defaultZone = 'America/New_York';
    try {
      const { saved } = renderWithState(form());
      const user = userEvent.setup();
      await user.click(screen.getByTestId(dataTestIds.vaccineDetailsPage.administeredDate));
      await user.keyboard('11112026');

      const given = DateTime.fromISO(saved().administrationDetails.administeredDateTime ?? '');
      expect(given.toISODate()).toBe('2026-11-11');
      expect(
        Math.abs(
          given
            .set({ year: 2026, month: 11, day: 11 })
            .diff(DateTime.now().set({ year: 2026, month: 11, day: 11 }), 'minutes').minutes
        )
      ).toBeLessThan(2);
    } finally {
      Settings.defaultZone = defaultZone;
    }
  });
});

describe('ImmunizationSentences - Administration on the order page', () => {
  const filled = (): ImmunizationFormValues =>
    form({ medication: TDAP }, { lot: 'L-42', cptCodes: [{ code: '90715', display: 'Tdap' }] });

  it('starts collapsed under a summary of what it holds, and opens on a click', async () => {
    renderWithState(filled(), { collapseAdministration: true });

    const toggle = screen.getByTestId(dataTestIds.orderVaccinePage.administrationToggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId(dataTestIds.vaccineDetailsPage.lotNumber)).not.toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.administrationSummary)).toHaveTextContent(
      'Lot L-42 · CPT 90715'
    );

    await userEvent.setup().click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.lotNumber)).toHaveValue('L-42');
    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.administrationSummary)).not.toBeInTheDocument();
  });

  it('shows no summary when nothing is filled', () => {
    renderWithState(form(), { collapseAdministration: true });

    expect(screen.getByTestId(dataTestIds.orderVaccinePage.administrationToggle)).toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.administrationSummary)).not.toBeInTheDocument();
  });

  it('is always open on the details card', () => {
    renderSentences(filled());

    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.administrationToggle)).not.toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.lotNumber)).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement, useState } from 'react';
import { ekgFamily } from 'utils/lib/procedure-coding/families/ekg';
import { foreignBodyFamily } from 'utils/lib/procedure-coding/families/foreign-body';
import { lacerationFamily } from 'utils/lib/procedure-coding/families/laceration';
import { nebulizerFamily } from 'utils/lib/procedure-coding/families/nebulizer';
import { resolveFamilyFacts } from 'utils/lib/procedure-coding/family-support';
import { ProcedureFamilyModel } from 'utils/lib/procedure-coding/model.types';
import { readRows, StructuredFacts } from 'utils/lib/procedure-coding/structured-fields';
import { describe, expect, it, vi } from 'vitest';
import {
  CodingFieldSentences,
  LacerationSentences,
} from '../../src/features/visits/in-person/components/procedures/narrative/CodingFieldSentences';

const latest: { facts?: StructuredFacts } = {};

function Form({ family, readOnly = false }: { family: ProcedureFamilyModel; readOnly?: boolean }): ReactElement {
  const [value, setValue] = useState<StructuredFacts>(resolveFamilyFacts(family, {}));
  latest.facts = value;
  const Component = family.id === lacerationFamily.id ? LacerationSentences : CodingFieldSentences;
  return <Component family={family} value={value} onChange={setValue} readOnly={readOnly} />;
}

describe('coding field sentences', () => {
  it('writes each wound as a sentence, adds and removes wounds', async () => {
    const user = userEvent.setup();
    render(<Form family={lacerationFamily} />);
    expect(screen.getAllByRole('spinbutton', { name: 'length (cm)' })).toHaveLength(1);
    expect(screen.getByText(/repair of a/)).toBeInTheDocument();
    expect(screen.getByText(/sutures\/staples\)/)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'suture/staple count' })).toHaveAttribute(
      'placeholder',
      'suture/staple count'
    );
    expect(screen.getByRole('textbox', { name: 'closure material' })).toHaveAttribute('placeholder', 'material');
    expect(screen.getByRole('textbox', { name: 'closure material' })).not.toHaveAttribute('data-needed');
    expect(screen.getByRole('spinbutton', { name: 'suture/staple count' })).not.toHaveAttribute('data-needed');

    await user.click(screen.getByRole('button', { name: 'Add another wound' }));
    expect(screen.getAllByRole('spinbutton', { name: 'length (cm)' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Remove Wound 2' }));
    expect(screen.getAllByRole('spinbutton', { name: 'length (cm)' })).toHaveLength(1);
  });

  it('stores picks and details on the wound row with the family keys', async () => {
    const user = userEvent.setup();
    render(<Form family={lacerationFamily} />);
    await user.click(screen.getByRole('button', { name: 'repair type (empty)' }));
    await user.click(screen.getByRole('option', { name: 'layered' }));
    await user.type(screen.getByRole('spinbutton', { name: 'length (cm)' }), '3.5');
    await user.click(screen.getByRole('button', { name: '+ details (empty)' }));
    await user.click(screen.getByRole('checkbox', { name: 'Wound-edge debridement' }));
    // Irrigation is a details answer like the rest, not a blank in the sentence.
    await user.click(screen.getByRole('checkbox', { name: 'Irrigation performed' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const wound = readRows(latest.facts ?? {}, 'wounds')[0];
    expect(wound).toMatchObject({ closure: 'layered', length: 3.5, edgeDebridement: true, irrigation: true });
    expect(screen.queryByText(/Irrigation:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Details:/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^\+ details: wound-edge debridement and irrigation performed/i })
    ).toBeInTheDocument();
  });

  it('renders any other family generically, with checkboxes as yes/no and hidden fields left out', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Form family={ekgFamily} />);
    expect(screen.getByText(/Component furnished:/)).toBeInTheDocument();
    // "Repeat clinician" only applies to a second same-day recording.
    expect(screen.queryByText(/Repeat clinician/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ details (empty)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ecg integral.*: no/i })).toBeInTheDocument();
    unmount();

    render(<Form family={nebulizerFamily} />);
    await user.click(screen.getByRole('button', { name: /continuous treatment over one hour: no/i }));
    await user.click(screen.getByRole('option', { name: 'yes' }));
    expect(latest.facts?.overHour).toBe(true);
  });

  it('marks laterality only for locations that need it for coding', async () => {
    const user = userEvent.setup();
    render(<Form family={foreignBodyFamily} />);
    await user.click(screen.getByRole('button', { name: 'foreign body location (empty)' }));
    await user.click(screen.getByRole('option', { name: 'nose' }));
    expect(screen.getByRole('button', { name: 'side (empty)' })).not.toHaveAttribute('data-needed');
    await user.click(screen.getByRole('button', { name: 'foreign body location: nose' }));
    await user.click(screen.getByRole('option', { name: 'cornea' }));
    expect(screen.getByRole('button', { name: 'side (empty)' })).toHaveAttribute('data-needed', 'true');
  });

  it('drops the count wording for an adhesive closure without clearing the stored count', async () => {
    const user = userEvent.setup();
    render(<Form family={lacerationFamily} />);
    await user.type(screen.getByRole('spinbutton', { name: 'suture/staple count' }), '4');
    await user.click(screen.getByRole('button', { name: 'repair type (empty)' }));
    await user.click(screen.getByRole('option', { name: 'adhesive only' }));
    expect(screen.queryByText(/sutures\/staples/)).not.toBeInTheDocument();
    expect(readRows(latest.facts ?? {}, 'wounds')[0]).toMatchObject({ closure: 'adhesive only', sutureCount: 4 });

    await user.click(screen.getByRole('button', { name: 'repair type: adhesive only' }));
    await user.click(screen.getByRole('option', { name: 'layered' }));
    expect(screen.getByRole('spinbutton', { name: 'suture/staple count' })).toHaveValue(4);
  });

  it.each(['open', 'strips only'])('hides suture counts for %s and preserves their saved values', async (closure) => {
    const user = userEvent.setup();
    render(<Form family={lacerationFamily} />);
    await user.type(screen.getByRole('spinbutton', { name: 'suture/staple count' }), '4');
    await user.type(screen.getByRole('textbox', { name: 'closure material' }), 'Retained material');
    await user.click(screen.getByRole('button', { name: 'repair type (empty)' }));
    await user.click(screen.getByRole('option', { name: closure }));
    expect(screen.queryByRole('spinbutton', { name: 'suture/staple count' })).not.toBeInTheDocument();
    expect(readRows(latest.facts ?? {}, 'wounds')[0]).toMatchObject({
      closure,
      sutureCount: 4,
      material: 'Retained material',
    });
    if (closure === 'open') {
      expect(screen.getByRole('textbox', { name: 'closure material' })).toHaveValue('Retained material');
      expect(
        screen.getByRole('textbox', { name: 'closure material' }).closest('.MuiTypography-root')
      ).toHaveTextContent('Closure material:');
      expect(screen.queryByText(/closed with/)).not.toBeInTheDocument();
      expect(screen.getByText(/Wound left/)).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: `repair type: ${closure}` }));
    await user.click(screen.getByRole('option', { name: 'layered' }));
    expect(screen.getByRole('spinbutton', { name: 'suture/staple count' })).toHaveValue(4);
    expect(screen.getByRole('textbox', { name: 'closure material' })).toHaveValue('Retained material');
  });

  it('lets an open wound material be edited and cleared without losing other wound answers', async () => {
    const user = userEvent.setup();
    render(<Form family={lacerationFamily} />);
    await user.type(screen.getByRole('textbox', { name: 'closure material' }), 'Nylon');
    await user.type(screen.getByRole('spinbutton', { name: 'length (cm)' }), '3.5');
    await user.click(screen.getByRole('button', { name: 'repair type (empty)' }));
    await user.click(screen.getByRole('option', { name: 'open' }));
    await user.clear(screen.getByRole('textbox', { name: 'closure material' }));
    const wound = readRows(latest.facts ?? {}, 'wounds')[0];
    expect(wound).toMatchObject({ closure: 'open', length: 3.5 });
    expect(wound.material).toBeUndefined();
  });

  it('shows a saved open wound material in read-only details', () => {
    const value = resolveFamilyFacts(lacerationFamily, {
      structuredFacts: { wounds: [{ closure: 'open', material: 'Nylon' }] },
    });
    render(<LacerationSentences family={lacerationFamily} value={value} onChange={vi.fn()} readOnly />);
    expect(screen.getByText('Nylon')).toBeInTheDocument();
    expect(screen.getByText('Nylon').closest('.MuiTypography-root')).toHaveTextContent('Closure material: Nylon');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/closed with/)).not.toBeInTheDocument();
  });

  it('shows sentences as plain text on read-only surfaces, without an empty count', () => {
    render(<Form family={lacerationFamily} readOnly />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText(/repair of a/)).toBeInTheDocument();
    expect(screen.queryByText(/sutures\/staples/)).not.toBeInTheDocument();
  });
});

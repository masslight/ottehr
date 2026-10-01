import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement, useState } from 'react';
import { ekgFamily } from 'utils/lib/procedure-coding/families/ekg';
import { lacerationFamily } from 'utils/lib/procedure-coding/families/laceration';
import { nebulizerFamily } from 'utils/lib/procedure-coding/families/nebulizer';
import { resolveFamilyFacts } from 'utils/lib/procedure-coding/family-support';
import { ProcedureFamilyModel } from 'utils/lib/procedure-coding/model.types';
import { readRows, StructuredFacts } from 'utils/lib/procedure-coding/structured-fields';
import { describe, expect, it } from 'vitest';
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
    expect(screen.getByRole('spinbutton', { name: 'suture/staple count' })).toHaveAttribute('placeholder', '#');
    expect(screen.getByRole('textbox', { name: 'closure material' })).toHaveAttribute('placeholder', 'material');

    await user.click(screen.getByRole('button', { name: 'Add another wound' }));
    expect(screen.getAllByRole('spinbutton', { name: 'length (cm)' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Remove Wound 2' }));
    expect(screen.getAllByRole('spinbutton', { name: 'length (cm)' })).toHaveLength(1);
  });

  it('stores picks and details on the wound row with the family keys', async () => {
    const user = userEvent.setup();
    render(<Form family={lacerationFamily} />);
    await user.click(screen.getByRole('button', { name: 'closure (empty)' }));
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
    // Details-flagged checkboxes sit behind the "+ details" popover rather than in the sentence.
    expect(screen.getByRole('button', { name: '+ details (empty)' })).toBeInTheDocument();
    unmount();

    render(<Form family={nebulizerFamily} />);
    await user.click(screen.getByRole('button', { name: /continuous treatment over one hour: no/i }));
    await user.click(screen.getByRole('option', { name: 'yes' }));
    expect(latest.facts?.overHour).toBe(true);
  });

  it('drops the count wording for an adhesive closure without clearing the stored count', async () => {
    const user = userEvent.setup();
    render(<Form family={lacerationFamily} />);
    await user.type(screen.getByRole('spinbutton', { name: 'suture/staple count' }), '4');
    await user.click(screen.getByRole('button', { name: 'closure (empty)' }));
    await user.click(screen.getByRole('option', { name: 'adhesive only' }));
    expect(screen.queryByText(/sutures\/staples/)).not.toBeInTheDocument();
    expect(readRows(latest.facts ?? {}, 'wounds')[0]).toMatchObject({ closure: 'adhesive only', sutureCount: 4 });

    await user.click(screen.getByRole('button', { name: 'closure: adhesive only' }));
    await user.click(screen.getByRole('option', { name: 'layered' }));
    expect(screen.getByRole('spinbutton', { name: 'suture/staple count' })).toHaveValue(4);
  });

  it('shows sentences as plain text on read-only surfaces, without an empty count', () => {
    render(<Form family={lacerationFamily} readOnly />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText(/repair of a/)).toBeInTheDocument();
    expect(screen.queryByText(/sutures\/staples/)).not.toBeInTheDocument();
  });
});

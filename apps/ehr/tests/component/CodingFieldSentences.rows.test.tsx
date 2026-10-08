import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement, useState } from 'react';
import { suggestedCodes } from 'utils/lib/procedure-coding/cpt';
import { suggestCode } from 'utils/lib/procedure-coding/evaluate';
import { injectionInfusionFamily } from 'utils/lib/procedure-coding/families/injection-infusion';
import { lacerationFamily } from 'utils/lib/procedure-coding/families/laceration';
import { resolveFamilyFacts } from 'utils/lib/procedure-coding/family-support';
import { ProcedureFamilyModel } from 'utils/lib/procedure-coding/model.types';
import { readRows, StructuredFacts } from 'utils/lib/procedure-coding/structured-fields';
import { describe, expect, it } from 'vitest';
import {
  CodingFieldSentences,
  LacerationSentences,
} from '../../src/features/visits/in-person/components/procedures/narrative/CodingFieldSentences';

/** Rows the sentence UI writes must reach the coding engine in on-screen order, so the engine's
 * "Wound 2: …" / "Administration 3: …" wording names the row the provider is looking at. */
const latest: { facts?: StructuredFacts } = {};

function Form({ family }: { family: ProcedureFamilyModel }): ReactElement {
  const [value, setValue] = useState<StructuredFacts>(resolveFamilyFacts(family, {}));
  latest.facts = value;
  const Component = family.id === lacerationFamily.id ? LacerationSentences : CodingFieldSentences;
  return <Component family={family} value={value} onChange={setValue} readOnly={false} />;
}

/** The engine's "still needed" messages (its best-practice reminders are left out). */
const messages = (family: ProcedureFamilyModel): string[] =>
  suggestCode({
    procedureType: family.procedureNames[0],
    structuredFacts: latest.facts,
    context: { completeDay: true, otherProcedures: [] },
  })
    .findings.filter((finding) => finding.level === 'determines')
    .map((finding) => finding.message);

describe('coding rows written by the sentence UI', () => {
  it('keeps three wounds in order and edits only the row that was touched', async () => {
    const user = userEvent.setup();
    render(<Form family={lacerationFamily} />);
    await user.click(screen.getByRole('button', { name: 'Add another wound' }));
    await user.click(screen.getByRole('button', { name: 'Add another wound' }));

    const lengths = screen.getAllByRole('spinbutton', { name: 'length (cm)' });
    expect(lengths).toHaveLength(3);
    await user.type(lengths[2], '4');
    await user.click(screen.getAllByRole('button', { name: 'repair type (empty)' })[2]);
    await user.click(screen.getByRole('option', { name: 'layered' }));
    await user.click(screen.getAllByRole('button', { name: 'site (empty)' })[2]);
    await user.click(screen.getByRole('option', { name: 'hand' }));

    const wounds = readRows(latest.facts ?? {}, 'wounds');
    expect(wounds).toHaveLength(3);
    expect(wounds[2]).toMatchObject({ length: 4, closure: 'layered', site: 'hand' });
    expect(wounds[0].length).toBeUndefined();
    expect(wounds[1].length).toBeUndefined();
    // The engine stops at the first incomplete row, so with wound 1 untouched it names wound 1 ...
    expect(messages(lacerationFamily)).toEqual([
      'Additional documentation needed to suggest a code — Wound 1: Site',
      'Additional documentation needed to suggest a code — Wound 1: Closure',
    ]);

    // ... and after removing wounds 1 and 2 the edited row is wound 1 and codes on its own.
    await user.click(screen.getByRole('button', { name: 'Remove Wound 1' }));
    await user.click(screen.getByRole('button', { name: 'Remove Wound 1' }));
    expect(readRows(latest.facts ?? {}, 'wounds')).toEqual([expect.objectContaining({ length: 4, site: 'hand' })]);
    expect(messages(lacerationFamily)).toEqual([]);
    expect(
      suggestedCodes(
        suggestCode({ procedureType: lacerationFamily.procedureNames[0], structuredFacts: latest.facts })
      ).map((line) => line.code)
    ).toEqual(['12042']);
  });

  it('names the incomplete administration by its on-screen position', async () => {
    const user = userEvent.setup();
    render(<Form family={injectionInfusionFamily} />);
    await user.click(screen.getByRole('button', { name: 'Add another administration' }));
    await user.click(screen.getByRole('button', { name: 'Add another administration' }));

    const drugs = screen.getAllByRole('textbox', { name: 'drug' });
    expect(drugs).toHaveLength(3);
    for (const [index, drug] of drugs.entries()) {
      // Filled blanks read "route: IM/SC", so match on the label prefix to keep on-screen order.
      await user.click(screen.getAllByRole('button', { name: /^route/ })[index]);
      await user.click(screen.getByRole('option', { name: 'IM/SC' }));
      if (index !== 2) await user.type(drug, `drug ${index + 1}`);
    }

    const rows = readRows(latest.facts ?? {}, 'administrations');
    expect(rows.map((row) => row.drug)).toEqual(['drug 1', 'drug 2', undefined]);
    expect(messages(injectionInfusionFamily)).toEqual([
      'Additional documentation needed to suggest a code — Administration 3: Drug',
    ]);
  });
});

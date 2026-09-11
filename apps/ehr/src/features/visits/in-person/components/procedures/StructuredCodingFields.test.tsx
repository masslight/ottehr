import { fireEvent, render, screen } from '@testing-library/react';
import { ReactElement, useState } from 'react';
import { resolveFamilyFacts } from 'utils/lib/procedure-coding';
import { lacerationFamily } from 'utils/lib/procedure-coding/families/laceration';
import { StructuredFacts } from 'utils/lib/procedure-coding/structured-fields';
import { describe, expect, it } from 'vitest';
import { StructuredCodingFields } from './StructuredCodingFields';

function Form({ readOnly = false }: { readOnly?: boolean }): ReactElement {
  const [value, setValue] = useState<StructuredFacts>(resolveFamilyFacts(lacerationFamily, {}));
  return <StructuredCodingFields family={lacerationFamily} value={value} onChange={setValue} readOnly={readOnly} />;
}
describe('structured coding form', () => {
  it('starts with one wound and collapsed advanced questions, and supports another wound', () => {
    render(<Form />);
    expect(screen.getAllByLabelText('Length (cm)')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Additional findings and documentation' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add wound' }));
    expect(screen.getAllByLabelText('Length (cm)')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Wounds 2' }));
    expect(screen.getAllByLabelText('Length (cm)')).toHaveLength(1);
  });
  it('allows incomplete measurements and explicit false answers', () => {
    render(<Form />);
    const length = screen.getByLabelText('Length (cm)');
    fireEvent.change(length, { target: { value: '3.5' } });
    expect(length).toHaveValue(3.5);
    fireEvent.change(length, { target: { value: '' } });
    expect(length).toHaveValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'Additional findings and documentation' }));
    const contaminated = screen.getByLabelText('Heavy contamination requiring extensive cleaning');
    expect(contaminated).not.toBeChecked();
    fireEvent.click(contaminated);
    expect(contaminated).toBeChecked();
  });
  it('keeps fields visible but prevents edits on read-only surfaces', () => {
    render(<Form readOnly />);
    expect(screen.getByLabelText('Length (cm)')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add wound' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Wounds 1' })).not.toBeInTheDocument();
  });
});

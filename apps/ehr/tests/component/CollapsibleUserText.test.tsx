import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  CollapsibleUserText,
  countWords,
  USER_TEXT_COLLAPSE_THRESHOLD,
} from '../../src/features/easy-charting/CollapsibleUserText';

// Collapse-in-place for long user bubbles in the easy-chart thread: long pasted dictations must
// clamp with a toggle; short messages must render untouched.
describe('CollapsibleUserText', () => {
  // Stateful wrapper mirroring AssistantColumn's per-message expanded Set.
  function Harness({ text }: { text: string }): JSX.Element {
    const [expanded, setExpanded] = useState(false);
    return <CollapsibleUserText text={text} expanded={expanded} onToggle={() => setExpanded((e) => !e)} />;
  }

  const longText = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');

  it('renders short text plain, with no toggle', () => {
    const short = 'add diagnosis sinusitis';
    render(<Harness text={short} />);
    expect(screen.getByText(short)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('treats text exactly at the threshold as short', () => {
    const atLimit = 'x'.repeat(USER_TEXT_COLLAPSE_THRESHOLD);
    render(<Harness text={atLimit} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('clamps long text and shows a word-count toggle', () => {
    expect(longText.length).toBeGreaterThan(USER_TEXT_COLLAPSE_THRESHOLD);
    render(<Harness text={longText} />);
    const toggle = screen.getByRole('button', { name: 'Show more · 100 words' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(window.getComputedStyle(screen.getByText(/word0/)).maxHeight).toBe('6em');
  });

  it('expands on toggle and collapses back, without losing the text', async () => {
    const user = userEvent.setup();
    render(<Harness text={longText} />);
    await user.click(screen.getByRole('button', { name: /Show more/ }));
    const toggle = screen.getByRole('button', { name: 'Show less' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(window.getComputedStyle(screen.getByText(/word0/)).maxHeight).toBe('');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Show more · 100 words' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('counts words by whitespace split', () => {
    expect(countWords('one two  three\nfour\tfive')).toBe(5);
    expect(countWords('  padded  ')).toBe(1);
  });
});

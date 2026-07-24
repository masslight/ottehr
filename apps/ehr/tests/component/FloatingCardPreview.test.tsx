import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FloatingCardPreview from '../../src/components/FloatingCardPreview';

// ============================================================================
// HARNESS
// ============================================================================
const FRONT_URL = 'https://presigned.example.com/insurance-card-front.png';
const BACK_URL = 'https://presigned.example.com/insurance-card-back.png';
const TITLE = 'Primary Insurance Card';

interface RenderOverrides {
  open?: boolean;
  frontUrl?: string | undefined;
  backUrl?: string | undefined;
  defaultFace?: 'front' | 'back';
}

const renderPreview = (overrides: RenderOverrides = {}): { onClose: ReturnType<typeof vi.fn> } => {
  const onClose = vi.fn();
  render(
    <>
      {/* A form field OUTSIDE the preview: the preview must not block typing into it. */}
      <input aria-label="Member ID" defaultValue="" />
      <FloatingCardPreview
        open={overrides.open ?? true}
        onClose={onClose}
        frontUrl={'frontUrl' in overrides ? overrides.frontUrl : FRONT_URL}
        backUrl={'backUrl' in overrides ? overrides.backUrl : BACK_URL}
        title={TITLE}
        defaultFace={overrides.defaultFace}
      />
    </>
  );
  return { onClose };
};

const getPanel = (): HTMLElement => screen.getByRole('dialog', { name: `${TITLE} preview` });

// ============================================================================
// TESTS
// ============================================================================
describe('FloatingCardPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    renderPreview({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByAltText(`${TITLE} front`)).toBeNull();
  });

  it('shows the FRONT image when open (default face)', () => {
    renderPreview();

    const img = screen.getByAltText(`${TITLE} front`) as HTMLImageElement;
    expect(img.src).toBe(FRONT_URL);
    expect(screen.queryByAltText(`${TITLE} back`)).toBeNull();
    // Portaled to document.body, positioned fixed at the default top-right offset.
    const panel = getPanel();
    expect(panel.parentElement).toBe(document.body);
    expect(panel.style.top).toBe('96px');
  });

  it('toggling to Back shows the BACK image', async () => {
    const user = userEvent.setup();
    renderPreview();

    await user.click(screen.getByRole('button', { name: `Show back of ${TITLE} preview` }));

    const img = screen.getByAltText(`${TITLE} back`) as HTMLImageElement;
    expect(img.src).toBe(BACK_URL);
    expect(screen.queryByAltText(`${TITLE} front`)).toBeNull();
  });

  it('respects defaultFace="back"', () => {
    renderPreview({ defaultFace: 'back' });

    expect(screen.getByAltText(`${TITLE} back`)).toBeDefined();
    expect(screen.queryByAltText(`${TITLE} front`)).toBeNull();
  });

  it('hides the Front/Back toggle when only one face exists and shows that face', () => {
    renderPreview({ backUrl: undefined, defaultFace: 'back' });

    // Only the front exists, so the front is shown even though defaultFace asked for back.
    expect(screen.getByAltText(`${TITLE} front`)).toBeDefined();
    expect(screen.queryByRole('button', { name: `Show back of ${TITLE} preview` })).toBeNull();
    expect(screen.queryByRole('button', { name: `Show front of ${TITLE} preview` })).toBeNull();
  });

  it('close button calls onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPreview();

    await user.click(screen.getByRole('button', { name: `Close ${TITLE} preview` }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape calls onClose — even while typing in a form field behind the panel', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPreview();

    await user.click(screen.getByLabelText('Member ID'));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is NON-MODAL: no MUI backdrop / modal wrapper, and the form behind stays typeable', async () => {
    const user = userEvent.setup();
    renderPreview();

    // No MUI Modal/Dialog machinery: no backdrop, no [role="presentation"] modal wrapper.
    expect(document.querySelector('.MuiBackdrop-root')).toBeNull();
    expect(document.querySelector('.MuiModal-root')).toBeNull();
    expect(document.querySelector('[role="presentation"]')).toBeNull();
    expect(document.querySelector('.MuiDialog-root')).toBeNull();

    // The panel is aria-labelled and explicitly non-modal (not just missing aria-modal).
    expect(getPanel().getAttribute('aria-modal')).toBe('false');

    // The staffer keeps typing in the form while the preview floats.
    const input = screen.getByLabelText('Member ID') as HTMLInputElement;
    await user.click(input);
    await user.keyboard('ZGP884213106');
    expect(input.value).toBe('ZGP884213106');
    expect(document.activeElement).toBe(input);
  });

  it('does not steal focus from the form when it opens', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <input aria-label="Member ID" />
        <FloatingCardPreview open={false} onClose={vi.fn()} frontUrl={FRONT_URL} backUrl={BACK_URL} title={TITLE} />
      </>
    );
    const input = screen.getByLabelText('Member ID');
    await user.click(input);

    rerender(
      <>
        <input aria-label="Member ID" />
        <FloatingCardPreview open={true} onClose={vi.fn()} frontUrl={FRONT_URL} backUrl={BACK_URL} title={TITLE} />
      </>
    );

    expect(screen.getByRole('dialog', { name: `${TITLE} preview` })).toBeDefined();
    expect(document.activeElement).toBe(input);
  });

  it('announces the open via a visually-hidden live region, since it never takes focus', () => {
    renderPreview();

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(`${TITLE} preview opened`);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('is draggable by the header, clamped to the viewport, and ignores drags starting on buttons', () => {
    renderPreview();
    const panel = getPanel();
    const header = screen.getByText(TITLE);

    // Drag by the header title: panel follows the mouse (jsdom rects are 0, so offset = mousedown coords).
    fireEvent.mouseDown(header, { clientX: 40, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 340, clientY: 210 });
    expect(panel.style.left).toBe('300px');
    expect(panel.style.top).toBe('200px');

    // Clamped: cannot be dragged off the left/top viewport edges.
    fireEvent.mouseMove(window, { clientX: -500, clientY: -500 });
    expect(panel.style.left).toBe('8px');
    expect(panel.style.top).toBe('8px');
    fireEvent.mouseUp(window);

    // A mousedown on a header button must NOT start a drag.
    fireEvent.mouseDown(screen.getByRole('button', { name: `Close ${TITLE} preview` }), { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 500, clientY: 500 });
    expect(panel.style.left).toBe('8px');
    expect(panel.style.top).toBe('8px');
  });
});

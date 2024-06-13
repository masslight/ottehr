import { describe, test, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScrollToTop } from '../../lib/components';

describe('ScrollToTop', () => {
  vi.spyOn(document.documentElement, 'scrollTo');

  test('should render ScrollToTop component', async () => {
    const wrapper = render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollToTop />
      </MemoryRouter>,
    );

    expect(wrapper).toBeTruthy();
  });

  test('should scroll to the top when ScrollToTop component rendered', async () => {
    expect(document.documentElement.scrollTo).toHaveBeenCalledTimes(1);
  });

  test('should scroll to 2000', async () => {
    window.scrollTo(0, 2000);

    expect(window.pageYOffset).toBe(2000);
  });

  test('should scroll to the top when location changes', async () => {
    render(
      <MemoryRouter initialEntries={['/new-path']}>
        <ScrollToTop />
      </MemoryRouter>,
    );

    await waitFor(() => expect(window.pageYOffset).toBe(0));
    expect(document.documentElement.scrollTo).toHaveBeenCalledTimes(2);
  });
});

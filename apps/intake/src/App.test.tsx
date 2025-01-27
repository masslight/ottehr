import { render } from '@testing-library/react';
import { beforeEach, describe, it, vi } from 'vitest';
import App from './App';

beforeEach(() => {
  document.documentElement.scrollTo = vi.fn() as any;
});

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
  });
});

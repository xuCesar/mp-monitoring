import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App';

describe('Viewer App', () => {
  it('shows connecting state before media is live', () => {
    render(<App />);

    expect(screen.getByText('连接中')).toBeTruthy();
  });
});

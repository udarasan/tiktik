import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe('routes', () => {
  it('renders the home page at /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Tickr' })).toBeInTheDocument();
  });

  it('renders not found for unknown paths', () => {
    renderAt('/does-not-exist');
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });
});

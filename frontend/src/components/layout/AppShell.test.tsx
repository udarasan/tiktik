import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useUiStore } from '@/stores/ui';
import { renderRoute } from '@/test/render';

vi.mock('@/features/profile/api/profile');
vi.mock('@/features/auth/api/auth');

function renderAt(path: string) {
  return renderRoute(path).router;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  useUiStore.setState({ theme: 'light', sidebarCollapsed: false, mobileNavOpen: false });
});

describe('AppShell layout', () => {
  it('renders sidebar, top bar and main landmarks with the dashboard', () => {
    renderAt('/');
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
  });

  it('lists the plan §11.2 navigation, with unbuilt items disabled', () => {
    renderAt('/');
    const nav = within(screen.getByRole('complementary', { name: 'Sidebar' })).getByRole(
      'navigation',
      { name: 'Main' },
    );
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const label of ['My tasks', 'Notifications', 'Team', 'Workspace settings']) {
      expect(within(nav).getByText(label).closest('[aria-disabled]')).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    }
    expect(within(nav).getByText('No projects yet')).toBeInTheDocument();
  });

  it('shows not found inside the shell for unknown paths', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});

describe('sidebar', () => {
  it('collapses and expands, and remembers the choice', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    expect(JSON.parse(localStorage.getItem('tickr-ui') ?? '{}')).toMatchObject({
      state: { sidebarCollapsed: true },
    });
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });

  it('opens the mobile drawer and closes it when navigating', async () => {
    const user = userEvent.setup();
    renderAt('/');
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    await user.click(within(drawer).getByRole('link', { name: 'Dashboard' }));
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
  });

  it('closes the mobile drawer from the backdrop', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
  });
});

describe('theme', () => {
  it('cycles light → dark → system and updates <html>', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: /^Theme: Light/ }));
    expect(document.documentElement).toHaveClass('dark');
    await user.click(screen.getByRole('button', { name: /^Theme: Dark/ }));
    expect(useUiStore.getState().theme).toBe('system');
    // jsdom has no matchMedia → system resolves to light
    expect(document.documentElement).not.toHaveClass('dark');
    expect(screen.getByRole('button', { name: /^Theme: System/ })).toBeInTheDocument();
  });
});

describe('task panel slot', () => {
  it('is closed without ?task', () => {
    renderAt('/');
    expect(screen.queryByRole('complementary', { name: /^Task / })).not.toBeInTheDocument();
  });

  it('opens from ?task=KEY and closes with the close button', async () => {
    const user = userEvent.setup();
    const router = renderAt('/?task=WEB-42');
    expect(screen.getByRole('complementary', { name: 'Task WEB-42' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close task panel' }));
    expect(screen.queryByRole('complementary', { name: 'Task WEB-42' })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('closes with Escape and keeps other query params', async () => {
    const user = userEvent.setup();
    const router = renderAt('/?view=list&task=WEB-7');
    expect(screen.getByRole('complementary', { name: 'Task WEB-7' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Task WEB-7' })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?view=list');
  });

  it('opens from the dashboard preview link', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('link', { name: 'open DEMO-1' }));
    expect(screen.getByRole('complementary', { name: 'Task DEMO-1' })).toBeInTheDocument();
  });
});

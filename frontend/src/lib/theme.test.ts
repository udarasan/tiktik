import { applyTheme, resolveTheme } from './theme';

describe('resolveTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('%s with prefersDark=%s → %s', (pref, prefersDark, expected) => {
    expect(resolveTheme(pref, prefersDark)).toBe(expected);
  });
});

describe('applyTheme', () => {
  it('toggles the dark class and color-scheme on the root element', () => {
    const el = document.createElement('html');
    applyTheme('dark', el);
    expect(el.classList.contains('dark')).toBe(true);
    expect(el.style.colorScheme).toBe('dark');
    applyTheme('light', el);
    expect(el.classList.contains('dark')).toBe(false);
    expect(el.style.colorScheme).toBe('light');
  });
});

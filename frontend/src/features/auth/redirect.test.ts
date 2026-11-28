import { safeNextPath } from './redirect';

describe('safeNextPath (open-redirect protection)', () => {
  it.each([
    ['/w/acme/p/WEB/board?task=WEB-1', '/w/acme/p/WEB/board?task=WEB-1'],
    ['/', '/'],
  ])('keeps in-app path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [''],
    ['https://evil.example.com'],
    ['//evil.example.com'],
    ['/\\evil.example.com'],
    ['javascript:alert(1)'],
    ['/login'],
    ['/register?next=/x'],
  ])('falls back to / for %s', (input) => {
    expect(safeNextPath(input)).toBe('/');
  });
});

import { initials } from './initials';

describe('initials (FR-AUTH-08 default avatar)', () => {
  it.each([
    ['Alice Doe', 'AD'],
    ['alice', 'A'],
    ['  Mary   Jane   Watson ', 'MW'],
    ['Ōtani Shōhei', 'ŌS'],
    ['😀 Smile', '😀S'],
    ['', '?'],
    [null, '?'],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

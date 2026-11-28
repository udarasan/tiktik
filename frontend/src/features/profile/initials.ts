const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** First user-perceived character (handles emoji and combining marks). */
function firstGrapheme(word: string | undefined): string {
  if (!word) return '';
  for (const { segment } of segmenter.segment(word)) return segment;
  return '';
}

/** FR-AUTH-08: default avatar = initials (first + last word), max 2 characters. */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const last = words.length > 1 ? firstGrapheme(words.at(-1)) : '';
  return (firstGrapheme(words[0]) + last).toLocaleUpperCase();
}

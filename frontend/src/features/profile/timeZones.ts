/** IANA time zones offered in settings (FR-AUTH-09). UTC first; the browser's zone is suggested. */
export function timeZoneOptions(): string[] {
  const zones =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return ['UTC', ...zones.filter((z) => z !== 'UTC')];
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

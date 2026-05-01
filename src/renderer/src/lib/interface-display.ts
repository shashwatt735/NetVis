const IPV4_IN_PARENS_PATTERN =
  /\s*\(((?:\d{1,3}\.){3}\d{1,3}(?:\s*,\s*(?:\d{1,3}\.){3}\d{1,3})*)\)/g

export function hideInterfaceAddress(displayName: string): string {
  return displayName.replace(IPV4_IN_PARENS_PATTERN, '').trim()
}

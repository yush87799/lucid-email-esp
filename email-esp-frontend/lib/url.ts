export function buildHomeWithToken(token: string): string {
  return `/?token=${encodeURIComponent(token)}`;
}

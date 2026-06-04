/**
 * Clean a list of raw player-name inputs: trim, drop blanks, dedupe
 * case-insensitively (keeping the first occurrence's casing), preserve order,
 * and cap at `max`.
 */
export function normalizePlayerNames(
  raw: string[],
  options: { max: number }
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of raw) {
    const name = value.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(name);

    if (result.length >= options.max) break;
  }

  return result;
}

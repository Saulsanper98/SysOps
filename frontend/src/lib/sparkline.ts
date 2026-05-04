/** Serie pseudoaleatoria determinista (solo UI) para mini sparklines en KPI. */
export function pseudoSeriesFromSeed(seed: string, len = 16): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const out: number[] = [];
  let x = Math.abs(h) || 1;
  for (let i = 0; i < len; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out.push((x % 100) / 100);
  }
  return out;
}

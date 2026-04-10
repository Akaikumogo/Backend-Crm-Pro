export function compareApartmentNumberStrings(a: string, b: string): number {
  const ta = a.trim();
  const tb = b.trim();
  if (!ta && !tb) {
    return 0;
  }
  if (!ta) {
    return 1;
  }
  if (!tb) {
    return -1;
  }
  const da = /^\d+$/.test(ta);
  const db = /^\d+$/.test(tb);
  if (da && db) {
    const ba = BigInt(ta);
    const bb = BigInt(tb);
    return ba < bb ? -1 : ba > bb ? 1 : 0;
  }
  if (da !== db) {
    return da ? -1 : 1;
  }
  return ta.localeCompare(tb, 'en', { numeric: true });
}

export function sortApartmentsByNumber<T extends { number: string }>(
  rows: T[] | undefined,
): T[] {
  if (!rows?.length) {
    return rows ?? [];
  }
  return [...rows].sort((x, y) =>
    compareApartmentNumberStrings(x.number, y.number),
  );
}

export function sortFloorsApartmentsInPlace<
  T extends { apartments?: { number: string }[] },
>(floors: T[] | undefined): void {
  if (!floors) {
    return;
  }
  for (const f of floors) {
    if (f.apartments?.length) {
      f.apartments = sortApartmentsByNumber(f.apartments);
    }
  }
}

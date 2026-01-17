export function parseNusmodsShareLink(shareLink: string): {
  moduleCodes: string[];
} {
  const url = new URL(shareLink);
  const params = url.searchParams;

  const moduleSet = new Set<string>();

  for (const key of params.keys()) {
    // key looks like "CS2040C[LAB]" or "MA1508E[LEC]"
    const moduleCode = key.split("[")[0]?.trim();
    if (moduleCode) moduleSet.add(moduleCode);
  }

  return { moduleCodes: Array.from(moduleSet).sort() };
}

export function validateCompany(c) {
  const errors = [];
  if (!/^[A-Z]{1,6}$/.test(c?.ticker || "")) errors.push("Invalid ticker");
  if (!c?.name || !Array.isArray(c.locations) || !c.locations.length)
    return [...errors, "Missing name or locations"];
  const ids = new Set();
  for (const l of c.locations) {
    if (!l.id || ids.has(l.id)) errors.push("Missing or duplicate location id");
    ids.add(l.id);
    if (
      !Number.isFinite(l.latitude) ||
      Math.abs(l.latitude) > 90 ||
      !Number.isFinite(l.longitude) ||
      Math.abs(l.longitude) > 180
    )
      errors.push(`Invalid coordinates: ${l.id}`);
    for (const key of ["importance", "confidence"])
      if (!Number.isFinite(l[key]) || l[key] < 0 || l[key] > 1)
        errors.push(`Invalid ${key}: ${l.id}`);
    if (!l.source || !/^https:\/\//.test(l.sourceUrl || ""))
      errors.push(`Missing provenance: ${l.id}`);
    if (
      !["confirmed", "supplier-context", "context-only"].includes(
        l.relationship,
      )
    )
      errors.push(`Invalid relationship: ${l.id}`);
    if (l.supplierId && !c.suppliers?.some((s) => s.id === l.supplierId))
      errors.push(`Unknown supplier: ${l.id}`);
    if (l.dependencyId && !c.dependencies?.some((d) => d.id === l.dependencyId))
      errors.push(`Unknown dependency: ${l.id}`);
  }
  for (const s of c.suppliers || [])
    if (!s.sourceUrl || !s.locationIds?.every((id) => ids.has(id)))
      errors.push(`Invalid supplier provenance/locations: ${s.id}`);
  return errors;
}

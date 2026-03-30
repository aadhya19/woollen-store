/** Normalize optional text fields for product identity comparisons. */
export function normalizeProductField(value: string | null | undefined): string | null {
  const t = value?.trim() ?? "";
  return t === "" ? null : t;
}

export type ProductTuple = {
  product_name: string | null;
  product_description: string | null;
  style: string | null;
  fabric: string | null;
};

export function tuplesEqual(a: ProductTuple, b: ProductTuple): boolean {
  return (
    normalizeProductField(a.product_name) === normalizeProductField(b.product_name) &&
    normalizeProductField(a.product_description) ===
      normalizeProductField(b.product_description) &&
    normalizeProductField(a.style) === normalizeProductField(b.style) &&
    normalizeProductField(a.fabric) === normalizeProductField(b.fabric)
  );
}

export function duplicateProductMessage(): string {
  return (
    "A product with the same brand, name, description, style, and fabric already exists. " +
    "Change one of those fields or use the existing product."
  );
}

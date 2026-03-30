export type ProductRow = {
  id: string;
  product_name: string | null;
  product_description: string | null;
  style: string | null;
  fabric: string | null;
  brand_name: string | null;
  created_at: string;
  updated_at: string | null;
};

export type BrandOptionRow = {
  id: string;
  brand_name: string | null;
};

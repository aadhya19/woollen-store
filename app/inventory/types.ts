export type InventoryRow = {
  id: string;
  inventory_number: string | null;
  company_name: string | null;
  agent_name: string | null;
  transport_name: string | null;
  waybill_number: string | null;
  transport_charges: number | null;
  date_of_entry: string | null;
  loading_charges: number | null;
  staff_name: string | null;
  location: string | null;
  invoice_number: string | null;
  number_of_parcels: number | string | null;
  billed_quantity: number | string | null;
  received_quantity: number | string | null;
  tallying: string | null;
  pricing: string | null;
  stickering: string | null;
  supply: string | null;
  created_at: string;
  updated_at: string | null;
  invoice_amount: number | null;
  invoice_date: string | null;
  invoice_image_url: string | null;
  invoice_pdf_url: string | null;
  payment_details: string | null;
  payment_mode: string | null;
  payment_status: string | null;
  debit_note: string | null;
  comments: string | null;
};

export type AgentLookupRow = {
  id: string;
  agent_name: string | null;
};

export type TransportLookupRow = {
  id: string;
  transport_name: string | null;
};

export type UserLookupRow = {
  id: string;
  name: string | null;
};

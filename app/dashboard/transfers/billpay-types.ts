export interface BillPayPayee {
  id: number;
  business_name: string;
  email: string;
  phone: string;
  street_address?: string;
  address_line_2?: string;
  city?: string;
  state_or_territory?: string;
  postal_code?: string;
  country?: string;
  account_number: string;
  routing_number: string;
}

export interface BillPayRule {
  id: number;
  source_internal_id: number;
  payee_id: number;
  amount: number;
  frequency: string;
  start_time: string;
  end_time: string | null;
}

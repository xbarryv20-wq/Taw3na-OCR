export interface PaymentInfo {
  category: string;
  price: string;
  currency: string;
  versment?: string;
}

export interface ClientData {
  last_name: string | null;
  first_name: string | null;
  passport_number: string | null;
  dob: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  place_of_issue: string | null;
  previous_visa_number: string | null;
  visa_from: string | null;
  visa_to: string | null;
  phone_number: string | null;
  client_pic: string | null; // Base64 or URL representation of client photo
  visa_pic: string | null; // Optional separate visa scan picture
  category: string;
  payment: PaymentInfo;
  staff_member: string; // 'BARRY' | 'MOSTAPHA' | 'YOUCEF'
  account_email: string;
  user_id?: string;
}

export interface ClientRecord extends ClientData {
  id: string;
  created_at: string;
}

export interface ConfigPrice {
  id: string;
  category: string;
  price: string; // e.g. "16" (Value representation matching ALG1=16M, etc.)
  description: string;
}

export type StaffMemberType = string;

export interface StaffMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export const DEFAULT_STAFF_MEMBERS: StaffMember[] = [
  { id: "BARRY", name: "Barry", avatarUrl: null },
  { id: "MOSTAPHA", name: "Mostapha", avatarUrl: null },
  { id: "YOUCEF", name: "Youcef", avatarUrl: null },
];

// Standard default price configurations (CONFIG_DB representation)
export const DEFAULT_CONFIG_PRICES: ConfigPrice[] = [
  { id: "1", category: "ALG1", price: "16", description: "Standard Algeria Category 1" },
  { id: "2", category: "ALG2", price: "4", description: "Standard Algeria Category 2" },
  { id: "3", category: "ALG3", price: "2", description: "Standard Algeria Category 3" },
  { id: "4", category: "ORN1", price: "16", description: "Oran District Priority Category 1" },
  { id: "5", category: "ORN2", price: "11", description: "Oran District Standard Category 2" },
  { id: "6", category: "ORN3", price: "5.5", description: "Oran District Economy Category 3" },
];

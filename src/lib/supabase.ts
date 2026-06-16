import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Coupon = {
  id: string;
  code: string;
  status: 'unclaimed' | 'claimed' | 'redeemed';
  created_at: string;
  claimed_at: string | null;
  redeemed_at: string | null;
  claimed_by_phone: string | null;
  generated_by: string | null;
};

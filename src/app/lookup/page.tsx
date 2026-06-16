'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabase, type Coupon } from '@/lib/supabase';
import BrandLogo from '@/components/BrandLogo';

type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; coupons: Coupon[] };

export default function LookupPage() {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<LookupState>({ kind: 'idle' });

  async function handleLookup() {
    const cleanPhone = phone.trim();

    if (!cleanPhone) {
      setState({
        kind: 'error',
        message: 'Enter the phone number you used to claim the coupon.',
      });
      return;
    }

    setState({ kind: 'loading' });

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('claimed_by_phone', cleanPhone)
      .order('claimed_at', { ascending: false });

    if (error) {
      setState({
        kind: 'error',
        message: 'Something went wrong while looking up your coupons.',
      });
      return;
    }

    setState({ kind: 'loaded', coupons: (data ?? []) as Coupon[] });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-cyan-950">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <BrandLogo />
        </div>
        <h1 className="text-xl font-semibold text-center mb-1">
          Find My Coupon
        </h1>
        <p className="text-center text-cyan-600 text-sm mb-8">
          Enter the phone number you used to claim it
        </p>

        <div className="bg-white/80 rounded-2xl p-6 mb-4 border border-cyan-100">
          <label className="block text-xs uppercase tracking-wide text-cyan-700 mb-2">
            Phone number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08X-XXX-XXXX"
            className="w-full rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleLookup}
            className="w-full mt-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold py-3 rounded-xl"
          >
            Find My Coupon
          </button>
        </div>

        {state.kind === 'loading' && (
          <p className="text-center text-cyan-900/60 text-sm">Looking up…</p>
        )}

        {state.kind === 'error' && (
          <p className="text-center text-cyan-700 text-sm">{state.message}</p>
        )}

        {state.kind === 'loaded' && (
          <div className="space-y-3">
            {state.coupons.length === 0 ? (
              <div className="bg-white/80 rounded-2xl p-6 text-center border border-cyan-100">
                <p className="text-cyan-900 font-medium">No coupons found</p>
                <p className="text-cyan-900/60 text-sm mt-2">
                  We couldn&apos;t find any claimed coupons for that phone
                  number.
                </p>
              </div>
            ) : (
              state.coupons.map((coupon) => {
                const isRedeemed = coupon.status === 'redeemed';

                return (
                  <Link
                    key={coupon.id}
                    href={`/claim/${coupon.code}`}
                    className="block bg-white/80 rounded-2xl p-5 border border-cyan-100 hover:border-cyan-300 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-cyan-700 mb-1">
                          {isRedeemed ? 'Already used' : 'Valid — tap to view'}
                        </p>
                        <p className="text-lg font-semibold text-cyan-950">
                          {coupon.code}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                          isRedeemed
                            ? 'bg-cyan-100 text-cyan-900'
                            : 'bg-cyan-500/15 text-cyan-700'
                        }`}
                      >
                        {coupon.status}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-cyan-900/60">
                      Claimed{' '}
                      {coupon.claimed_at
                        ? new Date(coupon.claimed_at).toLocaleString()
                        : 'recently'}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>
    </main>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, type Coupon } from '@/lib/supabase';
import { generateCouponCode } from '@/lib/codeGenerator';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function StaffGeneratorPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { count, error } = await supabase
        .from('coupons')
        .select('*', { count: 'exact', head: true });

      if (!cancelled && !error && count !== null) {
        setRemaining(100 - count);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshRemaining() {
    const { count, error } = await supabase
      .from('coupons')
      .select('*', { count: 'exact', head: true });
    if (!error && count !== null) {
      setRemaining(100 - count);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setActiveCoupon(null);

    const code = generateCouponCode();

    const { data, error } = await supabase
      .from('coupons')
      .insert({ code, generated_by: 'till' })
      .select()
      .single();

    if (error) {
      if (error.message.includes('limit')) {
        setError('All 100 coupons have been given out. None left to generate.');
      } else {
        setError('Something went wrong generating the coupon. Try again.');
      }
      setLoading(false);
      return;
    }

    setActiveCoupon(data as Coupon);
    await refreshRemaining();
    setLoading(false);
  }

  const claimUrl = activeCoupon
    ? `${SITE_URL}/claim/${activeCoupon.code}`
    : null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-center mb-1">
          WeDrink U-Thong
        </h1>
        <p className="text-center text-neutral-400 text-sm mb-6">
          Coffee BOGO — Coupon Generator (Staff Only)
        </p>

        <div className="bg-neutral-900 rounded-2xl p-5 mb-4 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
            Coupons Remaining
          </p>
          <p className="text-3xl font-bold">
            {remaining === null ? '—' : remaining}
          </p>
        </div>

        {!activeCoupon && (
          <button
            onClick={handleGenerate}
            disabled={loading || remaining === 0}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-400 text-neutral-950 font-semibold py-3 rounded-xl transition"
          >
            {loading
              ? 'Generating…'
              : remaining === 0
              ? 'No coupons left'
              : 'Customer bought coffee — Generate Coupon'}
          </button>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center mt-3">{error}</p>
        )}

        {activeCoupon && claimUrl && (
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center mt-4">
            <p className="text-neutral-900 font-medium mb-3 text-sm text-center">
              Have the customer scan this to claim their coupon
            </p>
            <QRCodeSVG value={claimUrl} size={220} />
            <p className="mt-3 text-neutral-500 text-xs">{activeCoupon.code}</p>
            <button
              onClick={() => setActiveCoupon(null)}
              className="mt-5 w-full bg-neutral-900 text-white py-2.5 rounded-xl text-sm font-medium"
            >
              Done — New Customer
            </button>
          </div>
        )}

        <a
          href="/staff-coffee-bogo-gen/redeem"
          className="block text-center text-neutral-500 text-xs mt-8 underline"
        >
          Redeem an existing coupon →
        </a>
        <a
          href="/lookup"
          className="block text-center text-neutral-500 text-xs mt-3 underline"
        >
          Customer lookup / Find My Coupon →
        </a>
      </div>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, type Coupon } from '@/lib/supabase';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'already_claimed_by_other' }
  | { kind: 'ready_to_claim' }
  | { kind: 'claiming' }
  | { kind: 'claim_error'; message: string }
  | { kind: 'claimed'; coupon: Coupon }
  | { kind: 'redeemed'; coupon: Coupon };

export default function ClaimPage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();

  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [phone, setPhone] = useState('');
  const [confirmingClaim, setConfirmingClaim] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!code) return;

      const nextView = await fetchCouponView(code);

      if (!cancelled) {
        setView(nextView);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  async function handleClaim() {
    const cleanPhone = phone.trim();

    if (cleanPhone.length < 9) {
      setView({
        kind: 'claim_error',
        message: 'Please enter a valid phone number.',
      });
      return;
    }

    setView({ kind: 'claiming' });
    setConfirmingClaim(false);

    // Atomic claim: only succeeds if still unclaimed.
    // This prevents two people from claiming the same code at once,
    // and locks the coupon to this phone number permanently.
    const { data, error } = await supabase
      .from('coupons')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        claimed_by_phone: cleanPhone,
      })
      .eq('code', code)
      .eq('status', 'unclaimed')
      .select()
      .single();

    if (error || !data) {
      // Someone else may have already claimed it in the meantime
      setView(await fetchCouponView(code));
      return;
    }

    setView({ kind: 'claimed', coupon: data as Coupon });
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-center mb-1">
          WeDrink U-Thong ☕
        </h1>
        <p className="text-center text-amber-400 text-sm mb-8">
          Buy One Get One Free — Coffee Promo
        </p>

        {view.kind === 'loading' && (
          <p className="text-center text-neutral-400">Loading…</p>
        )}

        {view.kind === 'not_found' && (
          <div className="bg-neutral-900 rounded-2xl p-6 text-center">
            <p className="text-red-400 font-medium">Coupon not found</p>
            <p className="text-neutral-500 text-sm mt-2">
              This link doesn&apos;t match a valid coupon.
            </p>
          </div>
        )}

        {view.kind === 'ready_to_claim' && (
          <div className="bg-neutral-900 rounded-2xl p-6">
            <p className="text-sm text-neutral-300 mb-4">
              Enter your phone number to claim your free drink coupon. This
              coupon can only be used by you.
            </p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08X-XXX-XXXX"
              className="w-full bg-neutral-800 rounded-xl px-4 py-3 text-sm outline-none border border-neutral-700 focus:border-amber-500 mb-3"
            />
            <button
              onClick={() => setConfirmingClaim(true)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold py-3 rounded-xl"
            >
              Claim My Coupon
            </button>
            {confirmingClaim && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left">
                <p className="text-amber-300 text-sm font-medium mb-2">
                  Final step
                </p>
                <p className="text-neutral-300 text-sm">
                  If you claim this coupon, it will be linked to your phone
                  number and cannot be transferred to someone else.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setConfirmingClaim(false)}
                    className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 py-2.5 text-sm text-neutral-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClaim}
                    className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-neutral-950"
                  >
                    Yes, claim it
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {view.kind === 'claiming' && (
          <p className="text-center text-neutral-400">Claiming…</p>
        )}

        {view.kind === 'claim_error' && (
          <div className="bg-neutral-900 rounded-2xl p-6">
            <p className="text-red-400 text-sm mb-4">{view.message}</p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08X-XXX-XXXX"
              className="w-full bg-neutral-800 rounded-xl px-4 py-3 text-sm outline-none border border-neutral-700 focus:border-amber-500 mb-3"
            />
            <button
              onClick={handleClaim}
              className="w-full bg-amber-500 text-neutral-950 font-semibold py-3 rounded-xl"
            >
              Try Again
            </button>
          </div>
        )}

        {view.kind === 'claimed' && (
          <div className="bg-neutral-900 rounded-2xl p-6 text-center">
            <p className="text-green-400 font-semibold mb-2">
              ✓ Coupon Claimed!
            </p>
            <p className="text-neutral-400 text-sm mb-4">
              Show this QR code to staff when you want to redeem your free
              drink.
            </p>
            <div className="bg-white rounded-2xl p-4 flex justify-center">
              <QRCodeSVG value={view.coupon.code} size={176} />
            </div>
            <div className="mt-4 rounded-2xl bg-neutral-800 p-4 text-left">
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Coupon code
              </p>
              <p className="text-neutral-100 font-mono text-lg">
                {view.coupon.code}
              </p>
              <p className="text-neutral-500 text-xs mt-2">
                Linked to {view.coupon.claimed_by_phone} — non-transferable
              </p>
            </div>
            <Link
              href="/lookup"
              className="mt-3 inline-block text-xs text-amber-400 underline underline-offset-4"
            >
              Lost this page? Find your coupon
            </Link>
          </div>
        )}

        {view.kind === 'redeemed' && (
          <div className="bg-neutral-900 rounded-2xl p-6 text-center">
            <p className="text-neutral-300 font-medium">
              This coupon has already been used
            </p>
            <p className="text-neutral-500 text-sm mt-2">
              Redeemed on{' '}
              {new Date(view.coupon.redeemed_at!).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

async function fetchCouponView(code: string): Promise<ViewState> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code)
    .single();

  if (error || !data) {
    return { kind: 'not_found' };
  }

  const coupon = data as Coupon;

  if (coupon.status === 'redeemed') {
    return { kind: 'redeemed', coupon };
  }

  if (coupon.status === 'claimed') {
    return { kind: 'claimed', coupon };
  }

  return { kind: 'ready_to_claim' };
}

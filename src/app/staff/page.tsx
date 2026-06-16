'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { generateCouponCode } from '@/lib/codeGenerator';
import { supabase, type Coupon } from '@/lib/supabase';

type CouponLookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'found'; coupon: Coupon };

type PhoneLookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'found'; coupons: Coupon[] };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function StaffDashboardPage() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedCoupon, setGeneratedCoupon] = useState<Coupon | null>(null);

  const [manualCode, setManualCode] = useState('');
  const [couponState, setCouponState] = useState<CouponLookupState>({
    kind: 'idle',
  });

  const [phoneLookup, setPhoneLookup] = useState('');
  const [phoneState, setPhoneState] = useState<PhoneLookupState>({
    kind: 'idle',
  });
  const [selectedPhoneCoupon, setSelectedPhoneCoupon] = useState<Coupon | null>(
    null
  );

  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

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

  async function generateCoupon() {
    setGenerationLoading(true);
    setGenerationError(null);
    setGeneratedCoupon(null);

    const code = generateCouponCode();

    const { data, error } = await supabase
      .from('coupons')
      .insert({ code, generated_by: 'till' })
      .select()
      .single();

    if (error) {
      setGenerationError(
        error.message.includes('limit')
          ? 'All 100 coupons have been given out.'
          : 'Something went wrong generating the coupon.'
      );
      setGenerationLoading(false);
      return;
    }

    setGeneratedCoupon(data as Coupon);
    await refreshRemaining();
    setGenerationLoading(false);
  }

  async function lookupCouponByCode(rawInput: string) {
    const code = rawInput.trim().split('/').pop()?.toUpperCase();

    if (!code) {
      setCouponState({ kind: 'not_found' });
      return;
    }

    setCouponState({ kind: 'loading' });

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      setCouponState({ kind: 'not_found' });
      return;
    }

    setCouponState({ kind: 'found', coupon: data as Coupon });
  }

  async function lookupByPhone() {
    const cleanPhone = phoneLookup.trim();

    if (!cleanPhone) {
      setPhoneState({ kind: 'not_found' });
      setSelectedPhoneCoupon(null);
      return;
    }

    setPhoneState({ kind: 'loading' });
    setSelectedPhoneCoupon(null);

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('claimed_by_phone', cleanPhone)
      .order('claimed_at', { ascending: false });

    if (error || !data || data.length === 0) {
      setPhoneState({ kind: 'not_found' });
      return;
    }

    const coupons = data as Coupon[];
    setPhoneState({ kind: 'found', coupons });
    setSelectedPhoneCoupon(coupons[0]);
  }

  async function markRedeemed(coupon: Coupon) {
    const { data, error } = await supabase
      .from('coupons')
      .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
      .eq('id', coupon.id)
      .eq('status', 'claimed')
      .select()
      .single();

    if (!error && data) {
      const updated = data as Coupon;
      setCouponState({ kind: 'found', coupon: updated });
      setSelectedPhoneCoupon(updated);
      setPhoneState((current) =>
        current.kind === 'found'
          ? {
              kind: 'found',
              coupons: current.coupons.map((item) =>
                item.id === updated.id ? updated : item
              ),
            }
          : current
      );
    }
  }

  async function startScan() {
    setScanning(true);
    setTimeout(async () => {
      const scanner = new Html5Qrcode('staff-qr-reader');
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 220 },
          async (decodedText) => {
            await scanner.stop();
            setScanning(false);
            await lookupCouponByCode(decodedText);
          },
          undefined
        );
      } catch {
        setScanning(false);
      }
    }, 100);
  }

  async function stopScan() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
    }
    setScanning(false);
  }

  const generatedClaimUrl = generatedCoupon
    ? `${SITE_URL}/claim/${generatedCoupon.code}`
    : null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="pt-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
            WeDrink U-Thong
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Staff Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Generate new coupons, redeem customer coupons, or look up a phone
            number and scan the customer&apos;s QR code from one place.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-neutral-900 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Generate
                </p>
                <h2 className="mt-1 text-xl font-semibold">Create coupon</h2>
              </div>
              <div className="rounded-xl bg-neutral-800 px-4 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                  Remaining
                </p>
                <p className="text-2xl font-bold">
                  {remaining === null ? '—' : remaining}
                </p>
              </div>
            </div>

            <button
              onClick={generateCoupon}
              disabled={generationLoading || remaining === 0}
              className="mt-6 w-full rounded-xl bg-amber-500 py-3 font-semibold text-neutral-950 disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {generationLoading
                ? 'Generating…'
                : remaining === 0
                ? 'No coupons left'
                : 'Generate new coupon'}
            </button>

            {generationError && (
              <p className="mt-3 text-sm text-red-400">{generationError}</p>
            )}

            {generatedCoupon && generatedClaimUrl && (
              <div className="mt-4 rounded-2xl bg-white p-5 text-center">
                <p className="text-sm font-medium text-neutral-900">
                  Customer scans this to claim
                </p>
                <div className="mt-4 flex justify-center">
                  <QRCodeSVG value={generatedClaimUrl} size={220} />
                </div>
                <p className="mt-3 text-xs text-neutral-500">
                  {generatedCoupon.code}
                </p>
                <button
                  onClick={() => setGeneratedCoupon(null)}
                  className="mt-4 w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-neutral-900 p-6">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Redeem
            </p>
            <h2 className="mt-1 text-xl font-semibold">Scan or enter code</h2>

            {!scanning && (
              <button
                onClick={startScan}
                className="mt-4 w-full rounded-xl bg-neutral-800 py-3 font-medium"
              >
                Scan customer QR
              </button>
            )}

            {scanning && (
              <div className="mt-4">
                <div id="staff-qr-reader" className="overflow-hidden rounded-xl" />
                <button
                  onClick={stopScan}
                  className="mt-2 w-full rounded-xl bg-neutral-800 py-2.5 text-sm"
                >
                  Cancel scan
                </button>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="WD-XXXXXX"
                className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm outline-none focus:border-amber-500"
              />
              <button
                onClick={() => lookupCouponByCode(manualCode)}
                className="rounded-xl bg-amber-500 px-4 text-sm font-medium text-neutral-950"
              >
                Check
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">
                Look up by phone
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={phoneLookup}
                  onChange={(e) => setPhoneLookup(e.target.value)}
                  placeholder="08X-XXX-XXXX"
                  className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm outline-none focus:border-amber-500"
                />
                <button
                  onClick={lookupByPhone}
                  className="rounded-xl bg-amber-500 px-4 text-sm font-medium text-neutral-950"
                >
                  Search
                </button>
              </div>
            </div>

            {phoneState.kind === 'loading' && (
              <p className="mt-4 text-sm text-neutral-400">
                Searching phone number…
              </p>
            )}

            {phoneState.kind === 'not_found' && (
              <p className="mt-4 text-sm text-red-400">
                No claimed coupons found for that phone number.
              </p>
            )}

            {phoneState.kind === 'found' && (
              <div className="mt-4 space-y-3">
                {phoneState.coupons.map((coupon) => {
                  const isSelected = selectedPhoneCoupon?.id === coupon.id;
                  const isRedeemed = coupon.status === 'redeemed';

                  return (
                    <button
                      key={coupon.id}
                      onClick={() => setSelectedPhoneCoupon(coupon)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-neutral-500">
                            {isRedeemed ? 'Already used' : 'Valid — tap to view'}
                          </p>
                          <p className="mt-1 font-semibold">{coupon.code}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isRedeemed
                              ? 'bg-red-500/15 text-red-300'
                              : 'bg-amber-500/15 text-amber-300'
                          }`}
                        >
                          {coupon.status}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {selectedPhoneCoupon && (
                  <div className="rounded-2xl bg-neutral-950 p-4">
                    <p className="text-sm text-neutral-300">
                      {selectedPhoneCoupon.status === 'redeemed'
                        ? 'Already redeemed'
                        : 'QR for staff to scan'}
                    </p>
                    <div className="mt-4 flex justify-center rounded-2xl bg-white p-4">
                      <QRCodeSVG value={selectedPhoneCoupon.code} size={176} />
                    </div>
                    <p className="mt-3 text-center text-xs text-neutral-500">
                      {selectedPhoneCoupon.code}
                    </p>
                    {selectedPhoneCoupon.status === 'claimed' && (
                      <button
                        onClick={() => markRedeemed(selectedPhoneCoupon)}
                        className="mt-4 w-full rounded-xl bg-green-500 py-2.5 font-semibold text-neutral-950 hover:bg-green-400"
                      >
                        Redeem for customer
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {couponState.kind === 'loading' && (
              <p className="mt-4 text-sm text-neutral-400">Checking…</p>
            )}

            {couponState.kind === 'not_found' && (
              <p className="mt-4 text-sm text-red-400">
                Coupon not found. Double-check the code.
              </p>
            )}

            {couponState.kind === 'found' && (
              <div className="mt-4 rounded-2xl bg-neutral-950 p-4">
                <CouponResult coupon={couponState.coupon} onRedeem={markRedeemed} />
              </div>
            )}

            <Link
              href="/lookup"
              className="mt-4 block text-center text-xs text-neutral-500 underline"
            >
              Customer lookup page →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function CouponResult({
  coupon,
  onRedeem,
}: {
  coupon: Coupon;
  onRedeem: (c: Coupon) => void;
}) {
  if (coupon.status === 'unclaimed') {
    return (
      <div className="text-sm">
        <p className="mb-1 font-medium text-yellow-400">Not yet claimed</p>
        <p className="text-neutral-400">
          This coupon hasn&apos;t been claimed by a customer yet.
        </p>
      </div>
    );
  }

  if (coupon.status === 'redeemed') {
    return (
      <div className="text-sm">
        <p className="mb-1 font-medium text-red-400">Already redeemed</p>
        <p className="text-neutral-400">
          Used on {new Date(coupon.redeemed_at!).toLocaleString()}.
        </p>
      </div>
    );
  }

  return (
    <div className="text-sm">
      <p className="mb-1 font-medium text-green-400">Valid — ready to redeem</p>
      <p className="mb-3 text-neutral-400">
        Claimed by phone: {coupon.claimed_by_phone}
      </p>
      <button
        onClick={() => onRedeem(coupon)}
        className="w-full rounded-xl bg-green-500 py-2.5 font-semibold text-neutral-950 hover:bg-green-400"
      >
        Redeem for customer
      </button>
    </div>
  );
}

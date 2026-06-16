'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { generateCouponCode } from '@/lib/codeGenerator';
import { supabase, type Coupon } from '@/lib/supabase';
import BrandLogo from '@/components/BrandLogo';

type Screen = 'home' | 'generate' | 'redeem' | 'lookup';

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
  const [screen, setScreen] = useState<Screen>('home');

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_40%),linear-gradient(180deg,_#f7feff_0%,_#ecfeff_100%)] text-cyan-950 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {screen === 'home' && (
          <>
            <header className="pt-4">
              <BrandLogo />
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                WeDrink U-Thong
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Staff Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-cyan-900/60">
                Pick what you want to do. Generate a coupon, redeem one, or
                look up a phone number.
              </p>
            </header>

            <section className="grid gap-4 md:grid-cols-3">
              <button
                onClick={() => setScreen('generate')}
                className="rounded-3xl border border-cyan-100 bg-white/80 p-6 text-left transition hover:-translate-y-0.5 hover:border-cyan-300"
              >
                <p className="text-xs uppercase tracking-wide text-cyan-700">
                  Action 1
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Generate</h2>
                <p className="mt-2 text-sm text-cyan-900/60">
                  Make a new coupon and show the customer QR.
                </p>
              </button>

              <button
                onClick={() => setScreen('redeem')}
                className="rounded-3xl border border-cyan-100 bg-white/80 p-6 text-left transition hover:-translate-y-0.5 hover:border-cyan-300"
              >
                <p className="text-xs uppercase tracking-wide text-cyan-700">
                  Action 2
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Redeem</h2>
                <p className="mt-2 text-sm text-cyan-900/60">
                  Scan a customer QR or enter a coupon code.
                </p>
              </button>

              <button
                onClick={() => setScreen('lookup')}
                className="rounded-3xl border border-cyan-100 bg-white/80 p-6 text-left transition hover:-translate-y-0.5 hover:border-cyan-300"
              >
                <p className="text-xs uppercase tracking-wide text-cyan-700">
                  Action 3
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Lookup</h2>
                <p className="mt-2 text-sm text-cyan-900/60">
                  Search by phone number and pull up the customer&apos;s QR.
                </p>
              </button>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/lookup"
                className="rounded-2xl border border-cyan-100 bg-white/80 px-5 py-4 text-sm text-cyan-900/70 transition hover:border-cyan-300"
              >
                Customer lookup page →
              </Link>
              <Link
                href="/claim"
                className="rounded-2xl border border-cyan-100 bg-white/80 px-5 py-4 text-sm text-cyan-900/70 transition hover:border-cyan-300"
              >
                Claim route for customers →
              </Link>
            </div>
          </>
        )}

        {screen === 'generate' && (
          <ActionFrame
            title="Generate coupon"
              subtitle="Create a new coupon and show the customer QR."
              onBack={() => setScreen('home')}
            >
            <div className="rounded-2xl border border-cyan-100 bg-white/80 p-5 text-center">
              <p className="text-xs uppercase tracking-wide text-cyan-700">
                Coupons Remaining
              </p>
              <p className="mt-2 text-4xl font-bold">
                {remaining === null ? '—' : remaining}
              </p>
            </div>

            <button
              onClick={generateCoupon}
              disabled={generationLoading || remaining === 0}
              className="w-full rounded-2xl bg-cyan-500 py-4 text-lg font-semibold text-white disabled:bg-cyan-200 disabled:text-cyan-900/50"
            >
              {generationLoading
                ? 'Generating…'
                : remaining === 0
                ? 'No coupons left'
                : 'Generate coupon'}
            </button>

            {generationError && (
              <p className="text-sm text-cyan-700">{generationError}</p>
            )}

            {generatedCoupon && generatedClaimUrl && (
              <div className="rounded-3xl bg-white p-5 text-center border border-cyan-100">
                <p className="text-sm font-medium text-cyan-950">
                  Customer scans this QR
                </p>
                <div className="mt-4 flex justify-center">
                  <QRCodeSVG value={generatedClaimUrl} size={240} />
                </div>
                <p className="mt-3 text-xs text-neutral-500">
                  {generatedCoupon.code}
                </p>
                <button
                  onClick={() => setGeneratedCoupon(null)}
                  className="mt-4 w-full rounded-xl bg-cyan-950 py-3 font-medium text-white"
                >
                  Done
                </button>
              </div>
            )}
          </ActionFrame>
        )}

        {screen === 'redeem' && (
          <ActionFrame
            title="Redeem coupon"
            subtitle="Scan the customer QR or type their code."
            onBack={() => setScreen('home')}
          >
            <button
              onClick={startScan}
              disabled={scanning}
              className="w-full rounded-2xl bg-cyan-950 py-4 text-lg font-semibold text-white transition hover:bg-cyan-900 disabled:opacity-60"
            >
              {scanning ? 'Scanning…' : 'Scan customer QR'}
            </button>

            {scanning && (
              <div className="rounded-3xl border border-cyan-100 bg-white/80 p-4">
                <div id="staff-qr-reader" className="overflow-hidden rounded-2xl" />
                <button
                  onClick={stopScan}
                  className="mt-3 w-full rounded-xl bg-cyan-100 py-3 text-sm text-cyan-950"
                >
                  Cancel scan
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="WD-XXXXXX"
                className="flex-1 rounded-2xl border border-cyan-100 bg-white/80 px-4 py-3 text-sm outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => lookupCouponByCode(manualCode)}
                className="rounded-2xl bg-cyan-500 px-5 font-semibold text-white"
              >
                Check
              </button>
            </div>

            {couponState.kind === 'loading' && (
              <p className="text-sm text-cyan-900/60">Checking…</p>
            )}

            {couponState.kind === 'not_found' && (
              <p className="text-sm text-cyan-700">
                Coupon not found. Double-check the code.
              </p>
            )}

            {couponState.kind === 'found' && (
              <CouponResult coupon={couponState.coupon} onRedeem={markRedeemed} />
            )}
          </ActionFrame>
        )}

        {screen === 'lookup' && (
          <ActionFrame
            title="Lookup by phone"
            subtitle="Search the customer&apos;s phone number, then open their coupon."
            onBack={() => setScreen('home')}
          >
            <div className="flex gap-2">
              <input
                value={phoneLookup}
                onChange={(e) => setPhoneLookup(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="flex-1 rounded-2xl border border-cyan-100 bg-white/80 px-4 py-3 text-sm outline-none focus:border-cyan-500"
              />
              <button
                onClick={lookupByPhone}
                className="rounded-2xl bg-cyan-500 px-5 font-semibold text-white"
              >
                Search
              </button>
            </div>

            {phoneState.kind === 'loading' && (
              <p className="text-sm text-cyan-900/60">Searching…</p>
            )}

            {phoneState.kind === 'not_found' && (
              <p className="text-sm text-cyan-700">
                No claimed coupons found for that phone number.
              </p>
            )}

            {phoneState.kind === 'found' && (
              <div className="space-y-3">
                {phoneState.coupons.map((coupon) => {
                  const isSelected = selectedPhoneCoupon?.id === coupon.id;
                  const isRedeemed = coupon.status === 'redeemed';

                  return (
                    <button
                      key={coupon.id}
                      onClick={() => setSelectedPhoneCoupon(coupon)}
                      className={`w-full rounded-3xl border p-5 text-left transition ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-50'
                          : 'border-cyan-100 bg-white/80 hover:border-cyan-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-neutral-500">
                            {isRedeemed ? 'Already used' : 'Valid — tap to view'}
                          </p>
                          <p className="mt-1 text-xl font-semibold">
                            {coupon.code}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isRedeemed
                              ? 'bg-cyan-100 text-cyan-900'
                              : 'bg-cyan-500/15 text-cyan-700'
                          }`}
                        >
                          {coupon.status}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {selectedPhoneCoupon && (
                  <div className="rounded-3xl border border-cyan-100 bg-white/80 p-5">
                    <p className="text-sm text-cyan-900/70">
                      {selectedPhoneCoupon.status === 'redeemed'
                        ? 'Already redeemed'
                        : 'QR for staff to scan'}
                    </p>
                    <div className="mt-4 flex justify-center rounded-2xl bg-white p-4 border border-cyan-100">
                      <QRCodeSVG value={selectedPhoneCoupon.code} size={220} />
                    </div>
                    <p className="mt-3 text-center text-xs text-cyan-900/60">
                      {selectedPhoneCoupon.code}
                    </p>
                    {selectedPhoneCoupon.status === 'claimed' && (
                      <button
                        onClick={() => markRedeemed(selectedPhoneCoupon)}
                        className="mt-4 w-full rounded-2xl bg-cyan-500 py-3 font-semibold text-white hover:bg-cyan-400"
                      >
                        Redeem for customer
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </ActionFrame>
        )}
      </div>
    </main>
  );
}

function ActionFrame({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="pt-4">
        <button
          onClick={onBack}
          className="text-sm text-cyan-700 underline underline-offset-4"
        >
          ← Back to dashboard
        </button>
        <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-cyan-900/60">{subtitle}</p>
      </header>

      <section className="mx-auto w-full max-w-xl space-y-4">{children}</section>
    </>
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
      <div className="rounded-3xl border border-cyan-100 bg-white/80 p-5 text-sm">
        <p className="mb-1 font-medium text-cyan-700">Not yet claimed</p>
        <p className="text-cyan-900/60">
          This coupon hasn&apos;t been claimed by a customer yet.
        </p>
      </div>
    );
  }

  if (coupon.status === 'redeemed') {
    return (
      <div className="rounded-3xl border border-cyan-100 bg-white/80 p-5 text-sm">
        <p className="mb-1 font-medium text-cyan-700">Already redeemed</p>
        <p className="text-cyan-900/60">
          Used on {new Date(coupon.redeemed_at!).toLocaleString()}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-cyan-100 bg-white/80 p-5 text-sm">
      <p className="mb-1 font-medium text-cyan-700">Valid — ready to redeem</p>
      <p className="mb-3 text-cyan-900/60">
        Claimed by phone: {coupon.claimed_by_phone}
      </p>
      <button
        onClick={() => onRedeem(coupon)}
        className="w-full rounded-2xl bg-cyan-500 py-3 font-semibold text-white hover:bg-cyan-400"
      >
        Redeem for customer
      </button>
    </div>
  );
}

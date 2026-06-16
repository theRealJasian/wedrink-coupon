'use client';

import { useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase, type Coupon } from '@/lib/supabase';

type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'found'; coupon: Coupon };

export default function RedeemPage() {
  const [manualCode, setManualCode] = useState('');
  const [state, setState] = useState<LookupState>({ kind: 'idle' });
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  function extractCode(input: string): string {
    // Accept either a raw code (WD-7K2P9X) or a full claim URL ending in it
    const trimmed = input.trim();
    const parts = trimmed.split('/');
    return parts[parts.length - 1].toUpperCase();
  }

  async function lookupCode(rawInput: string) {
    const code = extractCode(rawInput);
    if (!code) return;

    setState({ kind: 'loading' });

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      setState({ kind: 'not_found' });
      return;
    }

    setState({ kind: 'found', coupon: data as Coupon });
  }

  async function markRedeemed(coupon: Coupon) {
    const { data, error } = await supabase
      .from('coupons')
      .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
      .eq('id', coupon.id)
      .eq('status', 'claimed') // only allow redeeming claimed coupons, prevents double calls
      .select()
      .single();

    if (!error && data) {
      setState({ kind: 'found', coupon: data as Coupon });
    }
  }

  async function startScan() {
    setScanning(true);
    const elementId = 'qr-reader';
    setTimeout(async () => {
      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 220 },
          async (decodedText) => {
            await scanner.stop();
            setScanning(false);
            lookupCode(decodedText);
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

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-center mb-1">Redeem Coupon</h1>
        <p className="text-center text-neutral-400 text-sm mb-6">
          Scan customer&apos;s coupon or enter code manually
        </p>

        {!scanning && (
          <button
            onClick={startScan}
            className="w-full bg-neutral-800 hover:bg-neutral-700 py-3 rounded-xl mb-3 font-medium"
          >
            Scan QR Code
          </button>
        )}

        {scanning && (
          <div className="mb-3">
            <div id="qr-reader" className="rounded-xl overflow-hidden" />
            <button
              onClick={stopScan}
              className="w-full bg-neutral-800 py-2.5 rounded-xl mt-2 text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="WD-XXXXXX"
            className="flex-1 bg-neutral-900 rounded-xl px-4 py-2.5 text-sm outline-none border border-neutral-800 focus:border-amber-500"
          />
          <button
            onClick={() => lookupCode(manualCode)}
            className="bg-amber-500 text-neutral-950 font-medium px-4 rounded-xl text-sm"
          >
            Check
          </button>
        </div>

        <a
          href="/lookup"
          className="block text-center text-neutral-500 text-xs mb-4 underline"
        >
          Customer lookup / Find My Coupon →
        </a>

        {state.kind === 'loading' && (
          <p className="text-center text-neutral-400 text-sm">Checking…</p>
        )}

        {state.kind === 'not_found' && (
          <p className="text-center text-red-400 text-sm">
            Coupon not found. Double-check the code.
          </p>
        )}

        {state.kind === 'found' && (
          <CouponResult coupon={state.coupon} onRedeem={markRedeemed} />
        )}
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
      <div className="bg-neutral-900 rounded-xl p-4 text-sm">
        <p className="text-yellow-400 font-medium mb-1">Not yet claimed</p>
        <p className="text-neutral-400">
          This coupon hasn&apos;t been claimed by a customer yet. They need to
          scan it from their purchase first.
        </p>
      </div>
    );
  }

  if (coupon.status === 'redeemed') {
    return (
      <div className="bg-neutral-900 rounded-xl p-4 text-sm">
        <p className="text-red-400 font-medium mb-1">Already redeemed</p>
        <p className="text-neutral-400">
          Used on {new Date(coupon.redeemed_at!).toLocaleString()}. This
          coupon cannot be used again.
        </p>
      </div>
    );
  }

  // status === 'claimed' — valid and ready to redeem
  return (
    <div className="bg-neutral-900 rounded-xl p-4 text-sm">
      <p className="text-green-400 font-medium mb-1">Valid — Ready to redeem</p>
      <p className="text-neutral-400 mb-3">
        Claimed by phone: {coupon.claimed_by_phone}
      </p>
      <button
        onClick={() => onRedeem(coupon)}
        className="w-full bg-green-500 hover:bg-green-400 text-neutral-950 font-semibold py-2.5 rounded-xl"
      >
        Mark as Redeemed (Give Free Drink)
      </button>
    </div>
  );
}

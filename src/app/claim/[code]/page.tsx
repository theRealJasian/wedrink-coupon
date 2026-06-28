'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase, type Coupon } from '@/lib/supabase';
import { formatPhoneNumber, normalizePhoneNumber } from '@/lib/phone';
import BrandLogo from '@/components/BrandLogo';
import {
  COUPON_EXPIRY_LABEL,
  isCouponExpired,
} from '@/lib/couponDeadline';
import couponPreview from '../../../../wedrinkcoffeecoupon.png';

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
  const [celebrate, setCelebrate] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const couponExpired = isCouponExpired(new Date(now));
  const shouldShowExpiryNotice =
    couponExpired && view.kind !== 'redeemed' && view.kind !== 'not_found';

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

  useEffect(() => {
    if (view.kind !== 'claimed' || couponExpired) return;

    let cancelled = false;
    const interval = window.setInterval(async () => {
      const latestView = await fetchCouponView(code);

      if (cancelled) return;

      if (latestView.kind === 'redeemed') {
        setCelebrate(true);
        setView(latestView);
        window.clearInterval(interval);
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [code, couponExpired, view.kind]);

  async function handleClaim() {
    if (isCouponExpired()) {
      setView({
        kind: 'claim_error',
        message: 'คูปองหมดอายุแล้ว ⛔',
      });
      setConfirmingClaim(false);
      return;
    }

    const cleanPhone = normalizePhoneNumber(phone);

    if (cleanPhone.length !== 10) {
      setView({
        kind: 'claim_error',
        message: 'กรุณากรอกเบอร์โทรให้ถูกต้อง 📱',
      });
      return;
    }

    setView({ kind: 'claiming' });
    setConfirmingClaim(false);

    const { data, error } = await supabase
      .from('coupons')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        claimed_by_phone: formatPhoneNumber(cleanPhone),
      })
      .eq('code', code)
      .eq('status', 'unclaimed')
      .select()
      .single();

    if (error || !data) {
      setView(await fetchCouponView(code));
      return;
    }

    setView({ kind: 'claimed', coupon: data as Coupon });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-6 sm:p-6 text-cyan-950">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <BrandLogo />
        </div>
        <div className="mb-4 overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-sm">
          <Image
            src={couponPreview}
            alt="ภาพคูปอง WeDrink"
            className="h-auto w-full object-cover"
            priority
          />
        </div>
        <h1 className="text-xl font-semibold text-center mb-1">
          WeDrink U-Thong ☕✨
        </h1>
        <p className="text-center text-cyan-600 text-sm mb-8">
          ซื้อ 1 แถม 1 — โปรกาแฟ ☕💙
        </p>
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
          คูปองนี้หมดอายุ {COUPON_EXPIRY_LABEL}
        </div>

        {view.kind === 'loading' && (
          <LoadingPanel message="กำลังโหลดคูปอง…" />
        )}

        {view.kind === 'not_found' && (
          <div className="bg-white/80 rounded-2xl p-6 text-center border border-cyan-100">
            <p className="font-medium text-cyan-700">ไม่พบคูปอง 😢</p>
            <p className="text-cyan-900/60 text-sm mt-2">
              ลิงก์นี้ไม่ตรงกับคูปองที่ใช้งานได้
            </p>
          </div>
        )}

        {view.kind === 'ready_to_claim' && (
          shouldShowExpiryNotice ? (
            <ExpiredPanel code={code} />
          ) : (
            <div className="bg-white/80 rounded-2xl p-5 sm:p-6 border border-cyan-100 shadow-sm">
              <p className="text-sm text-cyan-900/70 mb-2">
                ใส่เบอร์โทรเพื่อรับคูปองเครื่องดื่มฟรี คูปองนี้ใช้ได้เฉพาะคุณ
              </p>
              <p className="text-xs text-cyan-900/50 mb-4">
                ต้องรับคูปองก่อน {COUPON_EXPIRY_LABEL}
              </p>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                placeholder="08X-XXX-XXXX"
                className="w-full rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 mb-3"
              />
              <button
                onClick={() => setConfirmingClaim(true)}
                className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-white hover:bg-cyan-400"
              >
                รับคูปองเลย 🎟️
              </button>
              {confirmingClaim && (
                <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-left">
                  <p className="text-cyan-700 text-sm font-medium mb-2">
                    ขั้นตอนสุดท้าย ⚠️
                  </p>
                  <p className="text-cyan-900/70 text-sm">
                    ถ้ากดยืนยัน คูปองจะผูกกับเบอร์โทรนี้ และโอนไม่ได้อีก
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setConfirmingClaim(false)}
                      className="flex-1 rounded-xl border border-cyan-200 bg-white py-2.5 text-sm text-cyan-900/70"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleClaim}
                      className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-white"
                    >
                      ยืนยันรับคูปอง ✅
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {view.kind === 'claiming' && (
          <LoadingPanel message="กำลังรับคูปอง…" />
        )}

        {view.kind === 'claim_error' && (
          shouldShowExpiryNotice ? (
            <ExpiredPanel code={code} />
          ) : (
            <div className="bg-white/80 rounded-2xl p-6 border border-cyan-100">
              <p className="text-cyan-700 text-sm mb-4">{view.message}</p>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                placeholder="08X-XXX-XXXX"
                className="w-full rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 mb-3"
              />
              <button
                onClick={handleClaim}
                className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-white"
              >
                ลองอีกครั้ง
              </button>
            </div>
          )
        )}

        {view.kind === 'claimed' && (
          shouldShowExpiryNotice ? (
            <ExpiredPanel code={view.coupon.code} />
          ) : (
            <div className="bg-white/80 rounded-2xl p-6 text-center border border-cyan-100 shadow-sm">
              <p className="text-cyan-700 font-semibold mb-2">
                ✓ รับคูปองสำเร็จ! 🎉
              </p>
              <p className="text-cyan-900/70 text-sm mb-4">
                แสดง QR นี้ให้พนักงานตอนต้องการใช้สิทธิ์
              </p>
              <div className="bg-white rounded-2xl p-4 sm:p-5 flex min-h-[220px] sm:min-h-[260px] items-center justify-center border border-cyan-100">
                <QRCodeCanvas
                  value={view.coupon.code}
                  size={220}
                  aria-label={`Coupon QR code for ${view.coupon.code}`}
                />
              </div>
              <div className="mt-4 rounded-2xl bg-cyan-50 p-4 text-left">
                <p className="text-xs uppercase tracking-wide text-cyan-700 mb-1">
                  รหัสคูปอง
                </p>
                <p className="font-mono text-lg text-cyan-950">
                  {view.coupon.code}
                </p>
                <p className="text-cyan-900/60 text-xs mt-2">
                  ผูกกับเบอร์ {formatPhoneNumber(view.coupon.claimed_by_phone ?? '')} — โอนไม่ได้
                </p>
                <p className="text-cyan-900/60 text-xs mt-2">
                  ใช้ก่อน {COUPON_EXPIRY_LABEL}
                </p>
              </div>
              <Link
                href="/lookup"
                className="mt-3 inline-block text-xs text-cyan-700 underline underline-offset-4"
              >
                ทำหน้านี้หาย? ค้นหาคูปองได้ที่นี่ 🔎
              </Link>
            </div>
          )
        )}

        {view.kind === 'redeemed' && (
          <div className="relative overflow-hidden rounded-3xl border border-cyan-100 bg-white/80 p-6 text-center shadow-sm">
            {celebrate && <CelebrationBurst />}
            <p className="text-2xl font-bold text-cyan-900">🎉 สำเร็จ! 🎉</p>
            <p className="mt-2 text-lg font-semibold text-cyan-700">
              ใช้คูปองเรียบร้อยแล้ว
            </p>
            <p className="mt-3 text-cyan-900/70 text-sm">
              Enjoy ☕ ขอให้มีความสุขกับกาแฟแก้วฟรีของคุณ
            </p>
            <div className="mt-4 rounded-2xl bg-cyan-50 p-4 text-left">
              <p className="text-xs uppercase tracking-wide text-cyan-700 mb-1">
                รหัสคูปอง
              </p>
              <p className="font-mono text-lg text-cyan-950">
                {view.coupon.code}
              </p>
              <p className="text-cyan-900/60 text-xs mt-2">
                ใช้เมื่อ {new Date(view.coupon.redeemed_at!).toLocaleString()}
              </p>
            </div>
            <Link
              href="/"
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-white"
            >
              กลับหน้าแรก
            </Link>
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

function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-cyan-100 bg-white/80 p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 h-8 w-8 rounded-full border-4 border-cyan-200 border-t-cyan-500 loading-ring" />
      <p className="text-sm font-medium text-cyan-900">{message}</p>
      <p className="mt-1 text-xs text-cyan-900/60">กรุณารอสักครู่…</p>
    </div>
  );
}

function ExpiredPanel({ code }: { code: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
      <p className="text-lg font-semibold text-rose-700">คูปองหมดอายุแล้ว ⛔</p>
      <p className="mt-2 text-sm text-rose-950/70">
        คูปอง {code} ใช้ได้ถึง {COUPON_EXPIRY_LABEL}
      </p>
      <p className="mt-2 text-sm text-rose-950/70">
        หลังจากเวลานี้จะไม่สามารถรับหรือใช้คูปองได้
      </p>
    </div>
  );
}

function CelebrationBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 14 }).map((_, index) => (
        <span
          key={index}
          className="absolute text-2xl opacity-90 animate-[confettiFloat_1.8s_ease-out_forwards]"
          style={{
            left: `${(index * 7) % 100}%`,
            top: `${(index * 11) % 100}%`,
            animationDelay: `${index * 90}ms`,
          }}
        >
          {index % 4 === 0 ? '🎉' : index % 4 === 1 ? '✨' : index % 4 === 2 ? '💙' : '☕'}
        </span>
      ))}
    </div>
  );
}

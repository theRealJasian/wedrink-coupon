'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { generateCouponCode } from '@/lib/codeGenerator';
import { supabase, type Coupon } from '@/lib/supabase';
import BrandLogo from '@/components/BrandLogo';
import couponPreview from '../../../wedrinkcoffeecoupon.png';

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
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
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
    setBusyMessage('กำลังสร้างคูปอง…');
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
          ? 'คูปองครบ 100 ใบแล้ว 🎉'
          : 'เกิดข้อผิดพลาดตอนสร้างคูปอง 😅'
      );
      setGenerationLoading(false);
      setBusyMessage(null);
      return;
    }

    setGeneratedCoupon(data as Coupon);
    await refreshRemaining();
    setGenerationLoading(false);
    setBusyMessage(null);
  }

  async function lookupCouponByCode(rawInput: string) {
    const code = rawInput.trim().split('/').pop()?.toUpperCase();

    if (!code) {
      setBusyMessage(null);
      setCouponState({ kind: 'not_found' });
      return;
    }

    setCouponState({ kind: 'loading' });
    setBusyMessage('กำลังตรวจสอบรหัส…');

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      setCouponState({ kind: 'not_found' });
      setBusyMessage(null);
      return;
    }

    setCouponState({ kind: 'found', coupon: data as Coupon });
    setBusyMessage(null);
  }

  async function lookupByPhone() {
    const cleanPhone = phoneLookup.trim();

    if (!cleanPhone) {
      setBusyMessage(null);
      setPhoneState({ kind: 'not_found' });
      setSelectedPhoneCoupon(null);
      return;
    }

    setPhoneState({ kind: 'loading' });
    setSelectedPhoneCoupon(null);
    setBusyMessage('กำลังค้นหาเบอร์โทร…');

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('claimed_by_phone', cleanPhone)
      .order('claimed_at', { ascending: false });

    if (error || !data || data.length === 0) {
      setPhoneState({ kind: 'not_found' });
      setBusyMessage(null);
      return;
    }

    const coupons = data as Coupon[];
    setPhoneState({ kind: 'found', coupons });
    setSelectedPhoneCoupon(coupons[0]);
    setBusyMessage(null);
  }

  async function markRedeemed(coupon: Coupon) {
    setBusyMessage('กำลังใช้คูปอง…');
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
    setBusyMessage(null);
  }

  async function startScan() {
    setScanning(true);
    setBusyMessage('กำลังเปิดกล้องสแกน…');
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
        setBusyMessage(null);
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
    setBusyMessage(null);
  }

  const generatedClaimUrl = generatedCoupon
    ? `${SITE_URL}/claim/${generatedCoupon.code}`
    : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_40%),linear-gradient(180deg,_#f7feff_0%,_#ecfeff_100%)] px-4 py-5 sm:p-6 text-cyan-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {busyMessage && <LoadingOverlay message={busyMessage} />}

        {screen === 'home' && (
          <>
            <header className="pt-4">
              <BrandLogo />
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-700">
                WeDrink U-Thong ☕✨
              </p>
              <h1 className="mt-2 text-3xl font-semibold">แดชบอร์ดพนักงาน 🧑‍💼</h1>
              <p className="mt-2 max-w-2xl text-sm text-cyan-900/60">
                เลือกสิ่งที่ต้องการทำ สร้างคูปอง ใช้คูปอง หรือค้นหาตามเบอร์โทร
              </p>
              <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-cyan-100 bg-white/80 px-4 py-2 text-sm font-medium text-cyan-900 shadow-sm">
                <span className="rounded-full bg-cyan-500 px-2 py-1 text-xs font-semibold text-white">
                  เหลือ
                </span>
                <span>{remaining === null ? '—' : remaining}</span>
                <span>คูปอง 🎟️</span>
              </div>
            </header>

            <section className="grid gap-4 md:grid-cols-2">
              <button
                onClick={() => setScreen('generate')}
                className="min-h-44 rounded-3xl border border-cyan-100 bg-white/80 p-6 text-left transition hover:-translate-y-0.5 hover:border-cyan-300 md:col-span-1 sm:min-h-48 sm:p-7"
              >
                <p className="text-xs uppercase tracking-wide text-cyan-700">
                  ตัวเลือก 1
                </p>
                <h2 className="mt-3 text-3xl font-semibold">สร้าง QR คูปอง 🎟️</h2>
                <p className="mt-2 text-sm text-cyan-900/60">
                  สร้างคูปองใหม่และแสดง QR ให้ลูกค้า
                </p>
              </button>

              <button
                onClick={() => setScreen('redeem')}
                className="min-h-44 rounded-3xl border border-cyan-100 bg-white/80 p-6 text-left transition hover:-translate-y-0.5 hover:border-cyan-300 md:col-span-1 sm:min-h-48 sm:p-7"
              >
                <p className="text-xs uppercase tracking-wide text-cyan-700">
                  ตัวเลือก 2
                </p>
                <h2 className="mt-3 text-3xl font-semibold">สแกน QR ลูกค้า 📲</h2>
                <p className="mt-2 text-sm text-cyan-900/60">
                  สแกน QR ของลูกค้าหรือกรอกรหัสคูปอง
                </p>
              </button>

              <button
                onClick={() => setScreen('lookup')}
                className="rounded-3xl border border-cyan-100 bg-white/80 p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300 md:col-span-2"
              >
                <p className="text-xs uppercase tracking-wide text-cyan-700">
                  ตัวเลือก 3
                </p>
                <h2 className="mt-2 text-xl font-semibold">ค้นหาคูปอง 🔎</h2>
                <p className="mt-2 text-sm text-cyan-900/60">
                  ค้นหาจากเบอร์โทร แล้วดึง QR ของลูกค้าออกมา
                </p>
              </button>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/lookup"
                className="rounded-2xl border border-cyan-100 bg-white/80 px-5 py-4 text-sm text-cyan-900/70 transition hover:border-cyan-300 active:scale-[0.99]"
              >
                หน้าลูกค้าค้นหาคูปอง →
              </Link>
              <Link
                href="/claim"
                className="rounded-2xl border border-cyan-100 bg-white/80 px-5 py-4 text-sm text-cyan-900/70 transition hover:border-cyan-300 active:scale-[0.99]"
              >
                เส้นทางรับคูปองของลูกค้า →
              </Link>
            </div>

            <div className="overflow-hidden rounded-3xl border border-cyan-100 bg-white/80 shadow-sm">
              <Image
                src={couponPreview}
                alt="ภาพตัวอย่างคูปอง WeDrink"
                className="h-auto w-full object-cover"
                priority
              />
              <div className="p-4">
                <p className="text-sm font-medium text-cyan-950">
                  ตัวอย่างคูปอง 🎟️
                </p>
                <p className="mt-1 text-sm text-cyan-900/60">
                  ภาพนี้ช่วยให้พนักงานเห็นหน้าตาคูปองได้ชัดขึ้น
                </p>
              </div>
            </div>
          </>
        )}

        {screen === 'generate' && (
          <ActionFrame
            title="สร้างคูปอง 🎟️"
            subtitle="สร้างคูปองใหม่และแสดง QR ให้ลูกค้า"
            onBack={() => setScreen('home')}
          >
            <div className="rounded-2xl border border-cyan-100 bg-white/80 p-5 text-center">
              <p className="text-xs uppercase tracking-wide text-cyan-700">
                คูปองที่เหลือ
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
                ? 'กำลังสร้าง…'
                : remaining === 0
                ? 'คูปองหมดแล้ว'
                : 'สร้างคูปอง'}
            </button>

            {generationError && (
              <p className="text-sm text-cyan-700">{generationError}</p>
            )}

            {generatedCoupon && generatedClaimUrl && (
              <div className="rounded-3xl border border-cyan-100 bg-white p-5 text-center">
                <p className="text-sm font-medium text-cyan-950">
                  ให้ลูกค้าสแกน QR นี้ 📲
                </p>
                <div className="mt-4 flex justify-center">
                  <QRCodeSVG value={generatedClaimUrl} size={200} />
                </div>
                <p className="mt-3 text-xs text-cyan-900/60">
                  {generatedCoupon.code}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => setGeneratedCoupon(null)}
                    className="w-full rounded-xl bg-cyan-950 py-3 font-medium text-white"
                  >
                    เสร็จแล้ว
                  </button>
                  <button
                    onClick={() => setScreen('home')}
                    className="w-full rounded-xl border border-cyan-200 bg-white py-3 font-semibold text-cyan-950"
                  >
                    กลับหน้าหลัก
                  </button>
                </div>
              </div>
            )}
          </ActionFrame>
        )}

        {screen === 'redeem' && (
          <ActionFrame
            title="ใช้คูปอง ✅"
            subtitle="สแกน QR ของลูกค้าหรือกรอกรหัส"
            onBack={() => setScreen('home')}
          >
            <button
              onClick={startScan}
              disabled={scanning}
              className="w-full rounded-2xl bg-cyan-950 py-4 text-lg font-semibold text-white transition hover:bg-cyan-900 disabled:opacity-60"
            >
              {scanning ? 'กำลังสแกน…' : 'สแกน QR ลูกค้า'}
            </button>

            {scanning && (
              <div className="rounded-3xl border border-cyan-100 bg-white/80 p-4">
                <div id="staff-qr-reader" className="overflow-hidden rounded-2xl" />
                <button
                  onClick={stopScan}
                  className="mt-3 w-full rounded-xl bg-cyan-100 py-3 text-sm text-cyan-950"
                >
                  ยกเลิกการสแกน
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
                ตรวจสอบ
              </button>
            </div>

            {couponState.kind === 'loading' && (
              <p className="text-sm text-cyan-900/60">กำลังตรวจสอบ…</p>
            )}

            {couponState.kind === 'not_found' && (
              <p className="text-sm text-cyan-700">
                ไม่พบคูปอง ตรวจสอบรหัสอีกครั้ง
              </p>
            )}

            {couponState.kind === 'found' && (
              <CouponResult
                coupon={couponState.coupon}
                onRedeem={markRedeemed}
                onHome={() => setScreen('home')}
              />
            )}
          </ActionFrame>
        )}

        {screen === 'lookup' && (
          <ActionFrame
            title="ค้นหาคูปอง 🔎"
            subtitle="ค้นหาจากเบอร์โทร แล้วเปิดคูปองของลูกค้า"
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
                ค้นหา
              </button>
            </div>

            {phoneState.kind === 'loading' && (
              <p className="text-sm text-cyan-900/60">กำลังค้นหา…</p>
            )}

            {phoneState.kind === 'not_found' && (
              <p className="text-sm text-cyan-700">
                ไม่พบคูปองที่รับไว้สำหรับเบอร์นี้
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
                          <p className="text-sm text-cyan-700">
                            {isRedeemed ? 'ใช้แล้ว ✅' : 'ใช้ได้ — แตะเพื่อดู 👆'}
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
                        ? 'ใช้แล้ว ✅'
                        : 'QR สำหรับพนักงานสแกน 📲'}
                    </p>
                    <div className="mt-4 flex justify-center rounded-2xl bg-white p-4 border border-cyan-100">
                      <QRCodeSVG value={selectedPhoneCoupon.code} size={220} />
                    </div>
                    <p className="mt-3 text-center text-xs text-cyan-900/60">
                      {selectedPhoneCoupon.code}
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {selectedPhoneCoupon.status === 'claimed' && (
                        <button
                          onClick={() => markRedeemed(selectedPhoneCoupon)}
                          className="w-full rounded-2xl bg-cyan-500 py-3 font-semibold text-white hover:bg-cyan-400"
                        >
                          ใช้คูปอง
                        </button>
                      )}
                      <button
                        onClick={() => setScreen('home')}
                        className="w-full rounded-2xl border border-cyan-200 bg-white py-3 font-semibold text-cyan-950"
                      >
                        กลับหน้าหลัก
                      </button>
                    </div>
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

function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cyan-950/20 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-cyan-100 bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-cyan-200 border-t-cyan-500 loading-ring" />
        <p className="text-lg font-semibold text-cyan-950">{message}</p>
        <p className="mt-1 text-sm text-cyan-900/60">กรุณารอสักครู่…</p>
      </div>
    </div>
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
          className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-3 text-base font-semibold text-white shadow-md shadow-cyan-200 transition hover:bg-cyan-400"
        >
          ← กลับหน้าหลัก
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
  onHome,
}: {
  coupon: Coupon;
  onRedeem: (c: Coupon) => void;
  onHome: () => void;
}) {
  if (coupon.status === 'unclaimed') {
    return (
      <div className="rounded-3xl border border-cyan-100 bg-white/80 p-5 text-sm">
        <p className="mb-1 font-medium text-cyan-700">ยังไม่ได้รับคูปอง</p>
        <p className="text-cyan-900/60">
          คูปองนี้ยังไม่มีลูกค้ามารับสิทธิ์
        </p>
      </div>
    );
  }

  if (coupon.status === 'redeemed') {
    return (
      <div className="rounded-3xl border border-cyan-100 bg-white/80 p-5 text-sm">
        <p className="mb-1 font-medium text-cyan-700">ใช้แล้ว ✅</p>
        <p className="text-cyan-900/60">
          ใช้เมื่อ {new Date(coupon.redeemed_at!).toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-cyan-100 bg-white/80 p-5 text-sm">
      <p className="mb-1 font-medium text-cyan-700">ใช้ได้ — พร้อมใช้ ✅</p>
      <p className="mb-3 text-cyan-900/60">
        ผูกกับเบอร์: {coupon.claimed_by_phone}
      </p>
      <button
        onClick={() => onRedeem(coupon)}
        className="w-full rounded-2xl bg-cyan-500 py-3 font-semibold text-white hover:bg-cyan-400"
      >
        ใช้คูปอง
      </button>
      <button
        onClick={onHome}
        className="mt-3 w-full rounded-2xl border border-cyan-200 bg-white py-3 font-semibold text-cyan-950"
      >
        กลับหน้าหลัก
      </button>
    </div>
  );
}

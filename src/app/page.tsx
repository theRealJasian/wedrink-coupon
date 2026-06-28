import Link from 'next/link';
import { COUPON_EXPIRY_LABEL } from '@/lib/couponDeadline';

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_38%),linear-gradient(180deg,_#f7feff_0%,_#ecfeff_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col items-center justify-center">
        <div className="w-full rounded-[2rem] border border-cyan-100 bg-white/80 p-6 text-center shadow-sm backdrop-blur sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-700">
            WeDrink U-Thong ☕✨
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-cyan-950 sm:text-4xl">
            ระบบคูปองกาแฟ 1 แถม 1
          </h1>
          <p className="mt-3 text-cyan-900/70">
            คูปองทั้งหมดหมดอายุ {COUPON_EXPIRY_LABEL}
          </p>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            ใช้คูปองให้ทันก่อนเวลานี้ หากเลยกำหนดแล้วจะไม่สามารถรับหรือใช้คูปองได้
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/lookup"
              className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-white transition hover:bg-cyan-400"
            >
              ค้นหาคูปองของฉัน
            </Link>
            <Link
              href="/staff"
              className="inline-flex items-center justify-center rounded-2xl border border-cyan-200 bg-white px-5 py-3 font-semibold text-cyan-950 transition hover:border-cyan-300"
            >
              หน้าพนักงาน
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

// July 12, 2026 at 11:59:59.999 PM Thailand time.
const COUPON_EXPIRY_INSTANT = new Date('2026-07-12T16:59:59.999Z');
export const COUPON_EXPIRY_LABEL = 'July 12, 2026 at 11:59 PM Thailand time (UTC+7)';

export function isCouponExpired(referenceTime = new Date()) {
  return referenceTime.getTime() > COUPON_EXPIRY_INSTANT.getTime();
}

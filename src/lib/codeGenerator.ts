// Generates short, human-typeable, unambiguous codes like "WD-7K2P9X"
// Avoids 0/O, 1/I/L to reduce manual-entry mistakes.
const CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateCouponCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `WD-${code}`;
}

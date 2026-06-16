import Image from 'next/image';
import logo from '../../logo.png';

export default function BrandLogo() {
  return (
    <Image
      src={logo}
      alt="โลโก้ WeDrink"
      priority
      className="h-auto w-24"
    />
  );
}

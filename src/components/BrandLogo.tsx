import Image from 'next/image';
import logo from '../../logo.png';

export default function BrandLogo() {
  return (
    <Image
      src={logo}
      alt="WeDrink logo"
      priority
      className="h-auto w-24"
    />
  );
}

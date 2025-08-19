/*import '@/app/ui/global.css';
import { inter } from '@/app/ui/fonts';
import { Metadata } from 'next';
 
export const metadata: Metadata = {
  title: {
    template: '%s | ModalAI',
    default: 'ModalAI Burn-In-Rack',
  },
  description: 'The official grid of ModalAI Burn-In-Rack',
  metadataBase: new URL('https://nextjs-dashboardwww.vercel.app/'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}*/
// app/layout.tsx
import '@/app/ui/global.css'
import type { Metadata } from 'next';
import Image from 'next/image';


export const metadata = {
  title: 'BIR',
  description: 'A Burn-In-Rack application',
  icons: {
    icon: '/logo.jpg', // must be in /public
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

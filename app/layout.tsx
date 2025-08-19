import '@/app/ui/global.css';
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
}

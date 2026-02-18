import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Burden of Proof',
  description: 'A courtroom strategy card game',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="m-0 p-0 overflow-hidden bg-[#1A1A2E]">{children}</body>
    </html>
  );
}

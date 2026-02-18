'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace('/game'); }, [router]);
  return (
    <div className="flex items-center justify-center h-screen bg-[#1A1A2E]">
      <p className="text-[#D4AF37] font-serif text-xl">Loading Burden of Proof...</p>
    </div>
  );
}

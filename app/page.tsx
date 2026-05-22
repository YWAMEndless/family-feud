import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8"
         style={{ background: 'linear-gradient(180deg, #0B1437 0%, #1a3c7f 50%, #0B1437 100%)' }}>

      {/* Logo */}
      <div className="text-center">
        <Image src="/logo.png" alt="Family Feud" width={480} height={320}
               priority style={{ height: 160, width: 'auto', objectFit: 'contain', margin: '0 auto' }} />
        <div className="mt-2 text-base tracking-[0.3em] uppercase"
             style={{ color: '#f5c842', opacity: 0.7, fontFamily: 'Arial' }}>
          Interactive Edition
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-4 w-full max-w-sm mt-4">
        <Link href="/host"
              className="block text-center py-5 px-8 rounded-lg text-2xl font-display tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #f5c842, #c99a00)',
                color: '#0B1437',
                boxShadow: '0 4px 20px rgba(245,200,66,0.4)',
              }}>
          HOST CONTROLS
        </Link>

        <Link href="/game"
              className="block text-center py-5 px-8 rounded-lg text-2xl font-display tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #1d5db8, #1a3c7f)',
                color: 'white',
                border: '2px solid #f5c842',
                boxShadow: '0 4px 20px rgba(29,93,184,0.4)',
              }}>
          DISPLAY SCREEN
        </Link>

        <Link href="/buzz/display"
              className="block text-center py-5 px-8 rounded-lg text-2xl font-display tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #4c1d95)',
                color: 'white',
                border: '2px solid rgba(167,139,250,0.5)',
                boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
              }}>
          BUZZER DISPLAY
        </Link>

        <Link href="/buzz"
              className="block text-center py-4 px-8 rounded-lg text-lg font-display tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(124,58,237,0.2)',
                color: 'rgba(167,139,250,0.9)',
                border: '1px solid rgba(167,139,250,0.3)',
              }}>
          TEAM BUZZER
        </Link>

        <Link href="/reader"
              className="block text-center py-4 px-8 rounded-lg text-lg font-display tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(5,150,105,0.2)',
                color: 'rgba(52,211,153,0.9)',
                border: '1px solid rgba(52,211,153,0.3)',
              }}>
          QUESTION READER
        </Link>
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center max-w-md text-sm leading-relaxed"
           style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial, sans-serif' }}>
        <p>🎛 <strong className="text-white">Host Controls</strong> — soundbooth operator</p>
        <p className="mt-1">📺 <strong className="text-white">Display Screen</strong> — drag to projector</p>
        <p className="mt-1">📖 <strong className="text-white">Question Reader</strong> — MC&apos;s phone</p>
        <p className="mt-1">🔔 <strong className="text-white">/buzz?team=1/2/3</strong> — team phones</p>
        <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Password: shown at login · Display screen needs no password</p>
      </div>
    </div>
  )
}

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8"
         style={{ background: 'linear-gradient(180deg, #0B1437 0%, #1a3c7f 50%, #0B1437 100%)' }}>

      {/* Logo */}
      <div className="text-center">
        <div className="text-6xl md:text-8xl font-display tracking-wider"
             style={{ color: '#f5c842', textShadow: '0 0 20px rgba(245,200,66,0.5), 3px 3px 0 #c99a00' }}>
          FAMILY
        </div>
        <div className="text-6xl md:text-8xl font-display tracking-wider mt-1"
             style={{ color: 'white', textShadow: '3px 3px 0 #1a3c7f, 0 0 20px rgba(255,255,255,0.2)' }}>
          FEUD
        </div>
        <div className="mt-4 text-lg tracking-[0.3em] uppercase"
             style={{ color: '#f5c842', opacity: 0.8 }}>
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
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center max-w-md text-sm leading-relaxed"
           style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial, sans-serif' }}>
        <p>Open <strong className="text-white">Host Controls</strong> on your laptop.</p>
        <p className="mt-1">Open <strong className="text-white">Display Screen</strong> in a second window and drag it to your projector.</p>
        <p className="mt-3 text-xs">Both windows must be open on the same device for sync to work.</p>
      </div>
    </div>
  )
}

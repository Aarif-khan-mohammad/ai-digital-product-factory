export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/store" className="font-bold text-white text-lg tracking-tight">
            Digital Products
          </a>
          <a href="/dashboard" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
            Dashboard →
          </a>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10">
        {children}
      </main>
      <footer className="border-t border-slate-800 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-xs text-slate-600">
          Powered by AI Digital Product Factory
        </div>
      </footer>
    </div>
  )
}

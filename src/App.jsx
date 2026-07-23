import { HardHat } from 'lucide-react'

function App() {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-6">
      <div className="card bg-base-100 shadow-xl w-full max-w-md">
        <div className="card-body items-center text-center gap-4">
          <HardHat className="size-12 text-primary" aria-hidden />
          <h1 className="card-title text-2xl">SiteMan</h1>
          <p className="text-base-content/70">
            Vite + React + Tailwind + DaisyUI scaffold is ready.
          </p>
          <div className="badge badge-outline">Stack OK</div>
        </div>
      </div>
    </div>
  )
}

export default App

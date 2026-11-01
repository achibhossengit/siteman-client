import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'sweetalert2/dist/sweetalert2.min.css'
import { ThemeProvider } from './providers/ThemeProvider.jsx'
import { AuthProvider } from './providers/AuthProvider.jsx'
import ToastLayer from './components/ToastLayer.jsx'
import { MobileAppShell } from './layouts/MobileAppShell.jsx'
import './index.css'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <MobileAppShell>
              <App />
              <ToastLayer />
            </MobileAppShell>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)

const hideAppSplash = () => {
  const splash = document.getElementById('app-splash')
  if (!splash) return
  splash.classList.add('app-splash--hide')
  window.setTimeout(() => splash.remove(), 400)
}

// Keep splash visible briefly so the boot animation can play.
window.setTimeout(hideAppSplash, 900)

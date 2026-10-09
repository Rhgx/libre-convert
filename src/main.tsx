import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Static hosts like GitHub Pages can't send the COOP/COEP headers LibreOffice needs, so the service
  // worker adds them. They only apply after a reload once the worker controls the page.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!crossOriginIsolated) {
      location.reload()
    }
  })
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error: unknown) => {
    console.error('Service worker registration failed', error)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

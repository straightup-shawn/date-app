import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/index.css'

// Auto-update the PWA: when a new version is deployed, take it immediately and
// reload once so users are never stuck on a stale/broken cached bundle.
registerSW({
  immediate: true,
  onNeedRefresh() {
    // A new build is available — reload to use it right away.
    window.location.reload()
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

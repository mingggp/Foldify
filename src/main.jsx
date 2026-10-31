import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// self-hosted fonts (bundled, so no font CDN is needed — school networks often block them)
import '@fontsource/anuphan/thai-400.css'
import '@fontsource/anuphan/thai-500.css'
import '@fontsource/anuphan/thai-600.css'
import '@fontsource/anuphan/latin-400.css'
import '@fontsource/anuphan/latin-500.css'
import '@fontsource/anuphan/latin-600.css'
import '@fontsource/bai-jamjuree/thai-600.css'
import '@fontsource/bai-jamjuree/thai-700.css'
import '@fontsource/bai-jamjuree/latin-600.css'
import '@fontsource/bai-jamjuree/latin-700.css'
import './index.css'

// No browser right-click menu (save image, inspect…) anywhere in the app,
// except in text fields so links can still be copied and pasted.
document.addEventListener('contextmenu', (e) => {
  if (!(e.target instanceof Element) || !e.target.closest('input:not([type=range]):not([type=checkbox]):not([type=color]), textarea, [contenteditable="true"]')) e.preventDefault()
})

import { ErrorBoundary } from './components/ErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

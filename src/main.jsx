import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ImageSearchProvider } from './components/ImageSearchContext'

import { GoogleOAuthProvider } from '@react-oauth/google';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <ImageSearchProvider>
          <App />
        </ImageSearchProvider>
      </GoogleOAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

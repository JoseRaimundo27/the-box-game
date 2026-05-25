import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// Se você removeu o BrowserRouter e o Provider para testar, coloque de volta assim:
import { BrowserRouter } from 'react-router-dom'
import { GameProvider } from './context/GameContext'
import './i18n'; //para traducao

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <GameProvider>
        <App />
      </GameProvider>
    </BrowserRouter>
  </React.StrictMode>
)
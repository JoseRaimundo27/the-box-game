import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Lobby from './pages/Lobby';
import Selection from './pages/Selection';
import Game from './pages/Game'
import Results from './pages/Results';
import LanguageSelector from './pages/LanguageSelector';


function App() {
  return (
    <div className="App">
      <LanguageSelector />
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/selection" element={<Selection />} />
        <Route path="/game" element={<Game />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </div>
  );
}

export default App;
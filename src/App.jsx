import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Lobby from './pages/Lobby';
import Selection from './pages/Selection';
import Game from './pages/Game'


function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/selection" element={<Selection />} />
        <Route path="/game" element={<Game />} />
      </Routes>
    </div>
  );
}

export default App;
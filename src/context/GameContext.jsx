import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase/config';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [myStation, setMyStation] = useState(null); // A, B, C, D ou E

  useEffect(() => {
    // Autenticação anônima automática ao abrir o app
    signInAnonymously(auth);
    onAuthStateChanged(auth, (user) => {
      if (user) setUser(user);
    });
  }, []);

  return (
    <GameContext.Provider value={{ 
      user, 
      currentRoom, 
      setCurrentRoom, 
      myStation, 
      setMyStation 
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);
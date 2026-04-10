import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/api';
import { useAuth } from './AuthContext';

const HouseholdContext = createContext(null);

export function HouseholdProvider({ children }) {
  const { user } = useAuth();
  const [households, setHouseholds] = useState([]);
  const [currentHouseholdId, setCurrentHouseholdId] = useState(() => {
    const saved = localStorage.getItem('currentHouseholdId');
    return saved ? Number(saved) : null;
  });
  const [personalEmoji, setPersonalEmojiState] = useState(
    () => localStorage.getItem('personal_emoji') || '🗂️'
  );

  function setPersonalEmoji(emoji) {
    localStorage.setItem('personal_emoji', emoji);
    setPersonalEmojiState(emoji);
  }

  const loadHouseholds = useCallback(async () => {
    if (!user) return;
    try {
      const list = await api.households.list();
      setHouseholds(list);
      // If saved household no longer exists for this user, reset to personal
      if (currentHouseholdId && !list.find(h => h.id === currentHouseholdId)) {
        switchHousehold(null);
      }
    } catch {
      setHouseholds([]);
    }
  }, [user]);

  useEffect(() => { loadHouseholds(); }, [loadHouseholds]);

  function switchHousehold(id) {
    setCurrentHouseholdId(id);
    if (id === null) {
      localStorage.removeItem('currentHouseholdId');
    } else {
      localStorage.setItem('currentHouseholdId', String(id));
    }
  }

  const currentHousehold = households.find(h => h.id === currentHouseholdId) || null;

  // Query params to pass to inventory/books API calls
  const householdParams = currentHouseholdId ? { household_id: currentHouseholdId } : {};

  return (
    <HouseholdContext.Provider value={{
      households,
      currentHousehold,
      currentHouseholdId,
      switchHousehold,
      householdParams,
      reloadHouseholds: loadHouseholds,
      personalEmoji,
      setPersonalEmoji,
    }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  return useContext(HouseholdContext);
}

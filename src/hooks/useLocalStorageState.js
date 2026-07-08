import { useEffect, useState } from 'react';

function readStoredValue(key, initialValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return initialValue;
    return JSON.parse(raw);
  } catch {
    return initialValue;
  }
}

export function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => readStoredValue(key, initialValue));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // localStorage 不可用或配额满时静默忽略
    }
  }, [key, state]);

  return [state, setState];
}

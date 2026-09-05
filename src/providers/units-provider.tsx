import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { deviceUnitSystem, type UnitSystem } from '@/lib/units';

type UnitsContextValue = {
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => Promise<void>;
};

const UnitsContext = createContext<UnitsContextValue>({
  unitSystem: 'metric',
  setUnitSystem: async () => {},
});

export function UnitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Starts from the device locale so an American sees pounds on the very first screen, before any
  // preference has been saved; the stored value takes over as soon as it loads.
  const [unitSystem, setLocalUnitSystem] = useState<UnitSystem>(deviceUnitSystem);

  useEffect(() => {
    if (!user) return;
    let isCancelled = false;

    supabase
      .from('profile_stats')
      .select('unit_system')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!isCancelled && (data?.unit_system === 'metric' || data?.unit_system === 'imperial')) {
          setLocalUnitSystem(data.unit_system);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [user]);

  const setUnitSystem = useCallback(
    async (system: UnitSystem) => {
      setLocalUnitSystem(system);
      if (!user) return;
      await supabase.from('profile_stats').upsert({
        user_id: user.id,
        unit_system: system,
        updated_at: new Date().toISOString(),
      });
    },
    [user],
  );

  return (
    <UnitsContext.Provider value={{ unitSystem, setUnitSystem }}>{children}</UnitsContext.Provider>
  );
}

export function useUnits() {
  return useContext(UnitsContext);
}

import { useEffect, useState } from 'react';
import { type Device, listDevices } from '../api/device-api';

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const result = await listDevices();
        if (active) {
          setDevices(result);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return { devices, loading };
}

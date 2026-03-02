import { apiFetch } from '#shared/api/client';

export interface Device {
  id: string;
  name: string;
  hostname: string;
  createdAt: string;
  status: 'online' | 'offline';
  daemonId: string | null;
  version: string | null;
  connectedAt: number | null;
}

export async function listDevices(): Promise<Device[]> {
  const data = await apiFetch<{ devices: Device[] }>('/devices');
  return data.devices;
}

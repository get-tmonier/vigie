import { describe, expect, it } from 'bun:test';
import type { Device } from '#entities/device/api/device-api';

// Pure logic extracted from DeviceSelector for unit testing
function getOnlineDevices(devices: Device[]): Device[] {
  return devices.filter((d) => d.status === 'online' && d.daemonId);
}

function getSelected(devices: Device[], selectedId: string | null): Device | undefined {
  return selectedId ? devices.find((d) => d.daemonId === selectedId) : undefined;
}

const offlineDevice: Device = {
  id: 'key-1',
  name: 'CLI (my-mac.local)',
  hostname: 'my-mac.local',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'offline',
  daemonId: null,
  version: null,
  connectedAt: null,
};

const onlineDevice: Device = {
  id: 'key-2',
  name: 'CLI (work-mac.local)',
  hostname: 'work-mac.local',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'online',
  daemonId: 'daemon-abc',
  version: '0.3.0',
  connectedAt: 1700000000000,
};

describe('DeviceSelector — getSelected', () => {
  it('returns undefined when selectedId is null (no device selected)', () => {
    expect(getSelected([offlineDevice], null)).toBeUndefined();
  });

  it('does not match offline device (daemonId: null) when selectedId is null', () => {
    // Regression: null === null was matching offline devices before the fix
    const result = getSelected([offlineDevice, onlineDevice], null);
    expect(result).toBeUndefined();
  });

  it('returns the matching online device when selectedId matches its daemonId', () => {
    const result = getSelected([offlineDevice, onlineDevice], 'daemon-abc');
    expect(result).toBe(onlineDevice);
  });

  it('returns undefined when selectedId does not match any device', () => {
    expect(getSelected([offlineDevice, onlineDevice], 'daemon-unknown')).toBeUndefined();
  });
});

describe('DeviceSelector — getOnlineDevices', () => {
  it('excludes offline devices', () => {
    expect(getOnlineDevices([offlineDevice])).toHaveLength(0);
  });

  it('includes online devices with a daemonId', () => {
    const result = getOnlineDevices([offlineDevice, onlineDevice]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(onlineDevice);
  });

  it('excludes online devices missing a daemonId', () => {
    const noId: Device = { ...onlineDevice, daemonId: null };
    expect(getOnlineDevices([noId])).toHaveLength(0);
  });

  it('returns empty array when no devices', () => {
    expect(getOnlineDevices([])).toHaveLength(0);
  });
});

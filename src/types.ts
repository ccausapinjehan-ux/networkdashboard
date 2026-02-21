export interface Device {
  id: number;
  name: string;
  ip: string;
  type: 'switch' | 'router' | 'server' | 'ap';
  status: 'online' | 'offline' | 'unknown';
  last_seen: string | null;
  location: string;
  latency: number;
  downtime_start: string | null;
}

export interface DeviceLog {
  id: number;
  device_id: number;
  status: string;
  latency: number;
  timestamp: string;
}

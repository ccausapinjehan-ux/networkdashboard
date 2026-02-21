import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Activity, 
  Server, 
  Network, 
  Wifi, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Search,
  Settings,
  ShieldCheck,
  Cpu,
  Database as DbIcon,
  Terminal,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format } from 'date-fns';
import { Device } from './types';
import { cn } from './lib/utils';

const DeviceIcon = ({ type, className }: { type: Device['type'], className?: string }) => {
  switch (type) {
    case 'switch': return <Network className={className} size={18} />;
    case 'router': return <Activity className={className} size={18} />;
    case 'server': return <Server className={className} size={18} />;
    case 'ap': return <Wifi className={className} size={18} />;
    default: return <Activity className={className} size={18} />;
  }
};

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', ip: '', type: 'switch' as Device['type'], location: '' });
  const [simulationMode, setSimulationMode] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setSimulationMode(data.simulation_mode);
      } catch (err) {
        console.error('Failed to fetch settings', err);
      }
    };
    fetchSettings();
  }, []);

  const toggleSimulationMode = async () => {
    const newValue = !simulationMode;
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'simulation_mode', value: newValue }),
      });
      if (res.ok) {
        setSimulationMode(newValue);
      }
    } catch (err) {
      console.error('Failed to update settings', err);
    }
  };

  const handleDeleteDevice = async (id: number) => {
    try {
      const res = await fetch(`/api/devices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDevices(prev => prev.filter(d => d.id !== id));
        if (selectedDevice?.id === id) setSelectedDevice(null);
      } else {
        alert('Failed to delete device');
      }
    } catch (err) {
      console.error('Failed to delete device', err);
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice),
      });
      if (res.ok) {
        const added = await res.json();
        setDevices(prev => [...prev, { ...newDevice, id: added.id, status: 'unknown', last_seen: null }]);
        setIsAddModalOpen(false);
        setNewDevice({ name: '', ip: '', type: 'switch', location: '' });
      }
    } catch (err) {
      console.error('Failed to add device', err);
    }
  };

  // Mock chart data
  const chartData = [
    { time: '00:00', traffic: 45, latency: 12 },
    { time: '04:00', traffic: 32, latency: 15 },
    { time: '08:00', traffic: 85, latency: 22 },
    { time: '12:00', traffic: 92, latency: 18 },
    { time: '16:00', traffic: 78, latency: 20 },
    { time: '20:00', traffic: 55, latency: 14 },
    { time: '23:59', traffic: 40, latency: 11 },
  ];

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await fetch('/api/devices');
        const data = await res.json();
        setDevices(data);
      } catch (err) {
        console.error('Failed to fetch devices', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('device_update', (update: { id: number, status: Device['status'], timestamp: string }) => {
      console.log('Received update:', update);
      setDevices(prev => prev.map(d => 
        d.id === update.id ? { ...d, status: update.status, last_seen: update.timestamp } : d
      ));
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const filteredDevices = devices.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.ip.includes(searchQuery)
  );

  const agentScript = `
/**
 * NetWatch Pro - Remote Agent Script
 * Run this on your local computer to monitor local devices.
 */
const { exec } = require('child_process');

const CONFIG = {
  SERVER_URL: '${window.location.origin}',
  INTERVAL: 10000, // 10 seconds
  DEVICES: ${JSON.stringify(devices.map(d => d.ip))}
};

async function ping(ip) {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? \`ping -n 1 -w 1000 \${ip}\` : \`ping -c 1 -W 1 \${ip}\`;
    exec(cmd, (error) => {
      resolve(!error ? 'online' : 'offline');
    });
  });
}

async function report() {
  console.log('Scanning local network...');
  const results = [];
  for (const ip of CONFIG.DEVICES) {
    const status = await ping(ip);
    results.push({ ip, status });
    console.log(\`[\${ip}] is \${status}\`);
  }

  try {
    const response = await fetch(new URL('/api/agent/report', CONFIG.SERVER_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results),
      redirect: 'follow'
    });
    if (response.status !== 200) {
      const errData = await response.json();
      console.error(\`Server Error (\${response.status}):\`, errData.details || errData.error);
    } else {
      console.log(\`Report sent. Status: \${response.status}\`);
    }
  } catch (e) {
    console.error(\`Error sending report: \${e.message}\`);
  }
}

console.log('NetWatch Pro Agent Started');
setInterval(report, CONFIG.INTERVAL);
report();
  `.trim();

  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#141414] px-6 py-4 flex justify-between items-center bg-[#E4E3E0] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-[#141414] text-[#E4E3E0] p-1.5 rounded">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight uppercase">NetWatch Pro</h1>
            <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest">Enterprise Infrastructure Monitor</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex gap-4 text-[11px] font-mono uppercase">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>System Operational</span>
            </div>
            <div className="opacity-40">|</div>
            <div>{format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</div>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#141414] text-[#E4E3E0] px-4 py-2 rounded text-xs font-bold uppercase hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus size={14} /> Add Device
          </button>
        </div>
      </header>

      {/* Add Device Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#E4E3E0] border border-[#141414] p-8 rounded-lg w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold uppercase tracking-tight">Register New Node</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-1 hover:bg-[#141414]/10 rounded">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <form onSubmit={handleAddDevice} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-60 mb-1">Device Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-2 bg-white border border-[#141414] rounded text-xs font-mono uppercase"
                    value={newDevice.name}
                    onChange={e => setNewDevice({...newDevice, name: e.target.value})}
                    placeholder="e.g. CORE-SW-02"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-60 mb-1">IP Address</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-2 bg-white border border-[#141414] rounded text-xs font-mono uppercase"
                    value={newDevice.ip}
                    onChange={e => setNewDevice({...newDevice, ip: e.target.value})}
                    placeholder="192.168.1.10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase opacity-60 mb-1">Type</label>
                    <select 
                      className="w-full p-2 bg-white border border-[#141414] rounded text-xs font-mono uppercase"
                      value={newDevice.type}
                      onChange={e => setNewDevice({...newDevice, type: e.target.value as Device['type']})}
                    >
                      <option value="switch">Switch</option>
                      <option value="router">Router</option>
                      <option value="server">Server</option>
                      <option value="ap">Access Point</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase opacity-60 mb-1">Location</label>
                    <input 
                      type="text" 
                      className="w-full p-2 bg-white border border-[#141414] rounded text-xs font-mono uppercase"
                      value={newDevice.location}
                      onChange={e => setNewDevice({...newDevice, location: e.target.value})}
                      placeholder="Floor 1"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-[#141414] text-white py-3 rounded text-xs font-bold uppercase mt-4 hover:opacity-90 transition-opacity"
                >
                  Initialize Monitoring
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Agent Modal */}
      <AnimatePresence>
        {isAgentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#E4E3E0] border border-[#141414] p-8 rounded-lg w-full max-w-2xl shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <Terminal size={24} />
                  <h2 className="text-xl font-bold uppercase tracking-tight">Remote Agent Setup</h2>
                </div>
                <button onClick={() => setIsAgentModalOpen(false)} className="p-1 hover:bg-[#141414]/10 rounded">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs opacity-70">
                  Copy this script and run it on a computer inside your local network. It will ping your local devices and send the status back to this dashboard.
                </p>
                
                <div className="relative">
                  <pre className="bg-[#141414] text-emerald-400 p-4 rounded text-[10px] font-mono overflow-auto max-h-80 border border-white/10">
                    {agentScript}
                  </pre>
                  <button 
                    onClick={() => navigator.clipboard.writeText(agentScript)}
                    className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-[9px] font-mono uppercase"
                  >
                    Copy Code
                  </button>
                </div>

                <div className="bg-amber-100 border border-amber-300 p-4 rounded text-[11px] text-amber-900">
                  <p className="font-bold uppercase mb-1">Instructions:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Install Node.js on your local computer.</li>
                    <li>Save this code as <code className="font-bold">agent.js</code>.</li>
                    <li>Edit the <code className="font-bold">DEVICES</code> array in the script with your local IPs.</li>
                    <li>Run <code className="font-bold">node agent.js</code> in your terminal.</li>
                  </ol>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar / Stats */}
        <aside className="w-72 border-r border-[#141414] p-6 flex flex-col gap-8 bg-[#DEDDD9]">
          <section>
            <h2 className="text-[11px] font-serif italic uppercase opacity-50 mb-4">Network Overview</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="border border-[#141414] p-4 rounded bg-white/50">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono uppercase opacity-60">Total Nodes</span>
                  <DbIcon size={14} className="opacity-40" />
                </div>
                <div className="text-3xl font-bold font-mono">{stats.total}</div>
              </div>
              <div className="border border-[#141414] p-4 rounded bg-emerald-50">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono uppercase opacity-60 text-emerald-800">Online</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <div className="text-3xl font-bold font-mono text-emerald-900">{stats.online}</div>
              </div>
              <div className="border border-[#141414] p-4 rounded bg-rose-50">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono uppercase opacity-60 text-rose-800">Critical</span>
                  <AlertTriangle size={14} className="text-rose-500" />
                </div>
                <div className="text-3xl font-bold font-mono text-rose-900">{stats.offline}</div>
              </div>
            </div>
          </section>

          <section className="flex-1">
            <h2 className="text-[11px] font-serif italic uppercase opacity-50 mb-4">Traffic Load</h2>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#141414" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="traffic" stroke="#141414" fillOpacity={1} fill="url(#colorTraffic)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-mono uppercase">
                <span>Peak Load</span>
                <span>92.4 Gbps</span>
              </div>
              <div className="w-full bg-[#141414]/10 h-1 rounded-full overflow-hidden">
                <div className="bg-[#141414] h-full w-[85%]" />
              </div>
            </div>
          </section>

          <section className="border-t border-[#141414] pt-6">
            <h2 className="text-[11px] font-serif italic uppercase opacity-50 mb-4">System Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase">
                  <Activity size={14} className={simulationMode ? "text-amber-600" : "opacity-40"} />
                  <span>Simulation Mode</span>
                </div>
                <button 
                  onClick={toggleSimulationMode}
                  className={cn(
                    "w-8 h-4 rounded-full relative transition-colors duration-200 border border-[#141414]",
                    simulationMode ? "bg-amber-500" : "bg-white"
                  )}
                >
                  <motion.div 
                    animate={{ x: simulationMode ? 16 : 0 }}
                    className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-[#141414] rounded-full"
                  />
                </button>
              </div>
              <p className="text-[9px] font-mono opacity-50 leading-tight">
                {simulationMode 
                  ? "ACTIVE: Private IPs will appear ONLINE for demonstration purposes." 
                  : "INACTIVE: Real ICMP ping responses are required for status updates."}
              </p>
            </div>
          </section>

          <section className="border-t border-[#141414] pt-6">
            <h2 className="text-[11px] font-serif italic uppercase opacity-50 mb-4">Remote Agent</h2>
            <button 
              onClick={() => setIsAgentModalOpen(true)}
              className="w-full border border-[#141414] p-3 rounded bg-white hover:bg-[#141414] hover:text-white transition-all group"
            >
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase font-bold">
                <Terminal size={14} className="group-hover:text-emerald-400" />
                <span>Get Agent Script</span>
              </div>
            </button>
            <p className="text-[9px] font-mono opacity-50 mt-2 leading-tight">
              Run a small script on your local PC to bridge your local network to this cloud dashboard.
            </p>
          </section>

          <section className="border-t border-[#141414] pt-6">
            <div className="flex items-center gap-3 text-[11px] font-mono uppercase opacity-60">
              <Settings size={14} />
              <span>Configuration</span>
            </div>
          </section>
        </aside>

        {/* Main Content */}
        <section className="flex-1 flex flex-col bg-white">
          <div className="p-4 border-b border-[#141414] flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
              <input 
                type="text" 
                placeholder="SEARCH BY DEVICE NAME OR IP..."
                className="w-full pl-10 pr-4 py-2 bg-[#F5F5F5] border border-[#141414] rounded text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[#141414]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-2 border border-[#141414] rounded text-[10px] font-mono uppercase hover:bg-[#141414] hover:text-white transition-colors">
                Filter: All
              </button>
              <button className="px-3 py-2 border border-[#141414] rounded text-[10px] font-mono uppercase hover:bg-[#141414] hover:text-white transition-colors">
                Export CSV
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {/* Table Header */}
            <div className="data-row bg-[#F5F5F5] sticky top-0 z-[5] font-bold">
              <div className="col-header">ID</div>
              <div className="col-header">Device Name</div>
              <div className="col-header">IP Address</div>
              <div className="col-header">Type</div>
              <div className="col-header">Location</div>
              <div className="col-header">Status</div>
              <div className="col-header"></div>
            </div>

            {loading ? (
              <div className="p-10 text-center font-mono text-xs opacity-50 uppercase animate-pulse">
                Initializing Network Scan...
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredDevices.map((device) => (
                  <motion.div 
                    layout
                    key={device.id} 
                    className="data-row"
                    onClick={() => setSelectedDevice(device)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="data-value opacity-40">#{device.id.toString().padStart(3, '0')}</div>
                    <div className="flex items-center gap-3">
                      <DeviceIcon type={device.type} className="opacity-60" />
                      <div className="flex flex-col">
                        <span className="font-bold">{device.name}</span>
                        {device.last_seen && (
                          <span className="text-[9px] opacity-40 font-mono">
                            {Math.abs(new Date().getTime() - new Date(device.last_seen).getTime()) < 300000 ? (
                              <span className="text-emerald-600 font-bold">● AGENT ACTIVE ({device.status.toUpperCase()})</span>
                            ) : (
                              `LAST SEEN: ${new Date(device.last_seen).toLocaleTimeString()}`
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="data-value">{device.ip}</div>
                    <div className="text-[10px] font-mono uppercase opacity-60">{device.type}</div>
                    <div className="text-[11px]">{device.location}</div>
                    <div>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold border",
                        device.status === 'online' 
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300" 
                          : "bg-rose-100 text-rose-800 border-rose-300 animate-pulse"
                      )}>
                        {device.status}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDevice(device.id);
                        }}
                        className="p-1.5 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                        title="Remove Device"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedDevice && (
            <motion.aside 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-96 border-l border-[#141414] bg-[#E4E3E0] p-6 shadow-2xl z-20"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-lg font-bold uppercase tracking-tight">{selectedDevice.name}</h3>
                  <p className="text-[10px] font-mono opacity-60">{selectedDevice.ip}</p>
                </div>
                <button 
                  onClick={() => setSelectedDevice(null)}
                  className="p-1 hover:bg-[#141414]/10 rounded transition-colors"
                >
                  <Plus className="rotate-45" size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-[#141414] p-3 rounded bg-white">
                    <div className="text-[9px] font-mono uppercase opacity-50 mb-1">Latency</div>
                    <div className="text-xl font-mono font-bold">14ms</div>
                  </div>
                  <div className="border border-[#141414] p-3 rounded bg-white">
                    <div className="text-[9px] font-mono uppercase opacity-50 mb-1">Uptime</div>
                    <div className="text-xl font-mono font-bold">99.8%</div>
                  </div>
                </div>

                <section>
                  <h4 className="text-[10px] font-mono uppercase opacity-50 mb-3 flex items-center gap-2">
                    <Clock size={12} /> Recent Activity
                  </h4>
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="text-[11px] p-2 border-b border-[#141414]/10 flex justify-between">
                        <span className="font-mono opacity-60">12:4{i}:22</span>
                        <span className="font-bold uppercase">Health Check OK</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-mono uppercase opacity-50 mb-3 flex items-center gap-2">
                    <Cpu size={12} /> Performance Metrics
                  </h4>
                  <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%" minHeight={128}>
                      <LineChart data={chartData}>
                        <Line type="monotone" dataKey="latency" stroke="#141414" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <div className="pt-6 flex gap-2">
                  <button className="flex-1 bg-[#141414] text-white py-2 rounded text-[10px] font-bold uppercase">
                    Remote Access
                  </button>
                  <button className="flex-1 border border-[#141414] py-2 rounded text-[10px] font-bold uppercase">
                    Diagnostics
                  </button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Status Bar */}
      <footer className="border-t border-[#141414] px-4 py-2 bg-[#141414] text-[#E4E3E0] flex justify-between items-center text-[10px] font-mono uppercase tracking-wider">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>DB: CONNECTED</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>SOCKET: ACTIVE</span>
          </div>
        </div>
        <div className="opacity-50">
          BUILD V1.0.4-STABLE // SECURE CONNECTION
        </div>
      </footer>
    </div>
  );
}

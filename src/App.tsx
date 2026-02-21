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
import { Device, DeviceLog } from './types';
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
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('agp_auth') === 'true');
  const [loginForm, setLoginForm] = useState({ username: 'princetopher', password: '1274cOc72' });
  const [loginError, setLoginError] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedDeviceLogs, setSelectedDeviceLogs] = useState<DeviceLog[]>([]);
  const [globalDowntimeLogs, setGlobalDowntimeLogs] = useState<(DeviceLog & { device_name: string, device_ip: string })[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', ip: '', type: 'switch' as Device['type'], location: '' });

  const fetchGlobalDowntime = async () => {
    try {
      const res = await fetch('/api/logs-global/downtime');
      const data = await res.json();
      setGlobalDowntimeLogs(data);
    } catch (err) {
      console.error('Failed to fetch global downtime logs', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchGlobalDowntime();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      if (res.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('agp_auth', 'true');
      } else {
        setLoginError('Invalid credentials. Please try again.');
      }
    } catch (err) {
      setLoginError('Server connection failed.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('agp_auth');
    setDevices([]);
    setLoading(true);
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
    if (selectedDevice) {
      const fetchLogs = async () => {
        try {
          const res = await fetch(`/api/logs/${selectedDevice.id}`);
          const data = await res.json();
          setSelectedDeviceLogs(data);
        } catch (err) {
          console.error('Failed to fetch logs', err);
        }
      };
      fetchLogs();
    } else {
      setSelectedDeviceLogs([]);
    }
  }, [selectedDevice]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchDevices = async () => {
      setLoading(true);
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

    newSocket.on('device_update', (update: { id: number, status: Device['status'], latency: number, downtime_start: string | null, timestamp: string }) => {
      console.log('Received update:', update);
      setDevices(prev => prev.map(d => 
        d.id === update.id ? { 
          ...d, 
          status: update.status, 
          latency: update.latency, 
          downtime_start: update.downtime_start, 
          last_seen: update.timestamp 
        } : d
      ));
      if (update.status === 'offline') {
        fetchGlobalDowntime();
      }
    });

    return () => {
      newSocket.close();
    };
  }, [isAuthenticated]);

  const filteredDevices = devices.filter(d => 
    (d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.ip.includes(searchQuery)) &&
    (filterType === 'all' || d.type === filterType)
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
    exec(cmd, (error, stdout) => {
      if (error) {
        resolve({ status: 'offline', latency: 0 });
      } else {
        // Extract latency
        let latency = 0;
        const match = stdout.match(/time[=<](\d+(?:\.\d+)?)/i);
        if (match) latency = Math.round(parseFloat(match[1]));
        resolve({ status: 'online', latency });
      }
    });
  });
}

async function report() {
  console.log('Scanning local network...');
  const results = [];
  for (const ip of CONFIG.DEVICES) {
    const { status, latency } = await ping(ip);
    results.push({ ip, status, latency });
    console.log(\`[\${ip}] is \${status} (\${latency}ms)\`);
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-brand-gray flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-brand-dark/10 p-8 rounded-lg w-full max-w-md shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <img 
              src="https://media.licdn.com/dms/image/v2/D4D0BAQF_EJ9WP_ZXog/company-logo_200_200/company-logo_200_200/0/1738346357475/ag_p_americas_inc_logo?e=2147483647&v=beta&t=25UpHlgHLtn4pKtcfM3oX6G-fSBdHLEXaTMMws51PXc" 
              alt="AG&P Logo" 
              className="h-16 w-auto mb-4"
              referrerPolicy="no-referrer"
            />
            <h1 className="text-xl font-bold uppercase tracking-tight text-brand-dark">Infrastructure Login</h1>
            <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest">AG&P Americas Inc.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase opacity-60 mb-1">Username</label>
              <input 
                type="text" 
                className="w-full p-3 bg-brand-gray border border-brand-dark/10 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-red/20"
                value={loginForm.username}
                onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase opacity-60 mb-1">Password</label>
              <input 
                type="password" 
                className="w-full p-3 bg-brand-gray border border-brand-dark/10 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-red/20"
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                required
              />
            </div>
            
            {loginError && (
              <div className="text-[10px] text-brand-red font-bold uppercase bg-brand-red/5 p-2 rounded border border-brand-red/10">
                {loginError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-brand-red text-white py-3 rounded text-xs font-bold uppercase mt-4 hover:bg-brand-red/90 transition-all shadow-md"
            >
              Authenticate Session
            </button>
          </form>
          
          <p className="text-[9px] font-mono opacity-30 text-center mt-6 uppercase">
            Secure Access Terminal // AG&P Americas Network
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-brand-dark px-6 py-4 flex justify-between items-center bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <img 
            src="https://media.licdn.com/dms/image/v2/D4D0BAQF_EJ9WP_ZXog/company-logo_200_200/company-logo_200_200/0/1738346357475/ag_p_americas_inc_logo?e=2147483647&v=beta&t=25UpHlgHLtn4pKtcfM3oX6G-fSBdHLEXaTMMws51PXc" 
            alt="AG&P Americas Logo" 
            className="h-10 w-auto"
            referrerPolicy="no-referrer"
          />
          <div className="h-8 w-[1px] bg-brand-dark/20" />
          <div>
            <h1 className="text-xl font-bold tracking-tight uppercase text-brand-dark">Infrastructure Monitor</h1>
            <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest">AG&P Americas Inc. • Enterprise Network</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex gap-4 text-[11px] font-mono uppercase">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold">System Operational</span>
            </div>
            <div className="opacity-40">|</div>
            <div className="opacity-60">{format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</div>
          </div>
          <button 
            onClick={handleLogout}
            className="text-[10px] font-mono uppercase opacity-40 hover:opacity-100 transition-opacity border border-brand-dark/10 px-2 py-1 rounded"
          >
            Logout
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-brand-red text-white px-4 py-2 rounded text-xs font-bold uppercase hover:bg-brand-red/90 transition-all flex items-center gap-2 shadow-sm"
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
        <aside className="w-72 border-r border-brand-dark/10 p-6 flex flex-col gap-8 bg-white">
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4">Network Overview</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="border border-brand-dark/10 p-4 rounded bg-brand-gray">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono uppercase opacity-60">Total Nodes</span>
                  <DbIcon size={14} className="opacity-40" />
                </div>
                <div className="text-3xl font-bold font-mono text-brand-dark">{stats.total}</div>
              </div>
              <div className="border border-emerald-100 p-4 rounded bg-emerald-50/30">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono uppercase opacity-60 text-emerald-800">Online</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <div className="text-3xl font-bold font-mono text-emerald-900">{stats.online}</div>
              </div>
              <div className="border border-brand-red/10 p-4 rounded bg-brand-red/5">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono uppercase opacity-60 text-brand-red">Critical</span>
                  <AlertTriangle size={14} className="text-brand-red" />
                </div>
                <div className="text-3xl font-bold font-mono text-brand-red">{stats.offline}</div>
              </div>
            </div>
          </section>

          <section className="flex-1">
            <h2 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4">Traffic Load</h2>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e31e24" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#e31e24" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="traffic" stroke="#e31e24" fillOpacity={1} fill="url(#colorTraffic)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-mono uppercase">
                <span>Peak Load</span>
                <span className="font-bold">92.4 Gbps</span>
              </div>
              <div className="w-full bg-brand-dark/10 h-1 rounded-full overflow-hidden">
                <div className="bg-brand-red h-full w-[85%]" />
              </div>
            </div>
          </section>

          <section className="border-t border-brand-dark/10 pt-6">
            <h2 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4">Remote Agent</h2>
            <button 
              onClick={() => setIsAgentModalOpen(true)}
              className="w-full border border-brand-dark/10 p-3 rounded bg-white hover:bg-brand-dark hover:text-white transition-all group shadow-sm"
            >
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase font-bold">
                <Terminal size={14} className="group-hover:text-brand-red" />
                <span>Get Agent Script</span>
              </div>
            </button>
            <p className="text-[9px] font-mono opacity-50 mt-2 leading-tight">
              Bridge your local network to the AG&P Americas cloud dashboard.
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
          <div className="p-4 border-b border-brand-dark/10 flex gap-4 bg-brand-gray/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
              <input 
                type="text" 
                placeholder="SEARCH BY DEVICE NAME OR IP..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-brand-dark/10 rounded text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-brand-red/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-brand-dark/10 rounded text-[10px] font-mono uppercase bg-white focus:outline-none"
              >
                <option value="all">Filter: All</option>
                <option value="switch">Switch</option>
                <option value="router">Router</option>
                <option value="server">Server</option>
                <option value="ap">Access Point</option>
              </select>
              <button className="px-3 py-2 border border-brand-dark/10 rounded text-[10px] font-mono uppercase hover:bg-brand-dark hover:text-white transition-colors">
                Export CSV
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {/* Table Header */}
            <div className="data-row bg-brand-gray sticky top-0 z-[5] font-bold border-b-2 border-brand-dark">
              <div className="col-header border-none bg-transparent">ID</div>
              <div className="col-header border-none bg-transparent">Device Name</div>
              <div className="col-header border-none bg-transparent">IP Address</div>
              <div className="col-header border-none bg-transparent">Type</div>
              <div className="col-header border-none bg-transparent">Location</div>
              <div className="col-header border-none bg-transparent">Status</div>
              <div className="col-header border-none bg-transparent"></div>
            </div>

            {loading ? (
              <div className="p-10 text-center font-mono text-xs opacity-50 uppercase animate-pulse">
                Initializing Network Scan...
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="p-20 text-center font-mono text-xs opacity-30 uppercase">
                No active nodes detected in this sector.
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
                        {device.status === 'offline' && device.downtime_start && (
                          <span className="text-[9px] text-rose-600 font-mono font-bold ml-2">
                            DOWN SINCE: {new Date(device.downtime_start).toLocaleTimeString()}
                          </span>
                        )}
                        {device.status === 'online' && device.latency > 0 && (
                          <span className="text-[9px] text-emerald-600 font-mono font-bold ml-2">
                            LATENCY: {device.latency}ms
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

          {/* Downtime History Section */}
          <div className="h-1/3 border-t border-brand-dark/10 flex flex-col overflow-hidden bg-brand-gray/30">
            <div className="p-3 border-b border-brand-dark/10 bg-brand-dark/5 flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle size={14} className="text-brand-red" /> Global Downtime History
              </h3>
              <span className="text-[9px] font-mono opacity-40 uppercase">Last 100 Incidents</span>
            </div>
            
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr] border-b border-brand-dark/10 bg-brand-red/5 text-[9px] font-bold uppercase tracking-wider p-2 sticky top-0 z-[1]">
                <div>Device Name</div>
                <div>IP Address</div>
                <div>Date & Time</div>
                <div className="text-right">Event</div>
              </div>
              
              <div className="divide-y divide-brand-dark/5">
                {globalDowntimeLogs.length > 0 ? globalDowntimeLogs.map((log) => (
                  <div key={log.id} className="grid grid-cols-[1fr_1fr_1fr_1fr] items-center p-2 hover:bg-brand-red/5 transition-colors">
                    <div className="text-xs font-bold">{log.device_name}</div>
                    <div className="font-mono text-[10px] opacity-60">{log.device_ip}</div>
                    <div className="font-mono text-[10px] opacity-60">
                      {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-bold uppercase text-brand-red bg-brand-red/10 px-2 py-0.5 rounded border border-brand-red/20">
                        OFFLINE
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="p-8 text-center text-[10px] opacity-40 italic uppercase">
                    No downtime incidents recorded.
                  </div>
                )}
              </div>
            </div>
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
              className="w-96 border-l border-brand-dark/20 bg-white p-6 shadow-2xl z-20"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-tight text-brand-dark">{selectedDevice.name}</h2>
                  <p className="text-[10px] font-mono opacity-40 uppercase">{selectedDevice.ip}</p>
                </div>
                <button onClick={() => setSelectedDevice(null)} className="p-2 hover:bg-brand-gray rounded-full transition-colors">
                  <Plus className="rotate-45" size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-brand-gray p-4 rounded border border-brand-dark/5">
                    <span className="text-[9px] font-mono uppercase opacity-40 block mb-1 text-brand-dark">Latency</span>
                    <div className="text-xl font-bold font-mono text-brand-dark">{selectedDevice.latency}ms</div>
                  </div>
                  <div className="bg-brand-gray p-4 rounded border border-brand-dark/5">
                    <span className="text-[9px] font-mono uppercase opacity-40 block mb-1 text-brand-dark">Uptime</span>
                    <div className="text-xl font-bold font-mono text-emerald-600">99.8%</div>
                  </div>
                </div>

                <section>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                    <Clock size={12} /> Recent Activity
                  </h4>
                  <div className="space-y-2">
                    {selectedDeviceLogs.length > 0 ? selectedDeviceLogs.slice(0, 5).map(log => (
                      <div key={log.id} className="text-[11px] p-2 border-b border-brand-dark/5 flex justify-between items-center">
                        <span className="font-mono opacity-60">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className={cn(
                          "font-bold uppercase text-[9px] px-2 py-0.5 rounded",
                          log.status === 'online' ? "text-emerald-700 bg-emerald-50" : "text-brand-red bg-brand-red/5"
                        )}>
                          {log.status} {log.latency > 0 && `(${log.latency}ms)`}
                        </span>
                      </div>
                    )) : (
                      <div className="text-[10px] opacity-40 italic p-2">No activity logs found.</div>
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                    <Cpu size={12} /> Performance Metrics
                  </h4>
                  <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%" minHeight={128}>
                      <LineChart data={chartData}>
                        <Line type="monotone" dataKey="latency" stroke="#e31e24" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <div className="pt-6 flex gap-2">
                  <button className="flex-1 bg-brand-dark text-white py-2 rounded text-[10px] font-bold uppercase hover:bg-brand-red transition-colors">
                    Remote Access
                  </button>
                  <button className="flex-1 border border-brand-dark py-2 rounded text-[10px] font-bold uppercase hover:bg-brand-gray transition-colors">
                    Diagnostics
                  </button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Status Bar */}
      <footer className="border-t border-brand-dark px-4 py-2 bg-brand-dark text-white flex justify-between items-center text-[10px] font-mono uppercase tracking-wider">
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
          AG&P AMERICAS INC. // SECURE NETWORK MONITOR V1.0.4
        </div>
      </footer>
    </div>
  );
}

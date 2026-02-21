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
  Trash2,
  Sun,
  Moon,
  Menu,
  X,
  Map
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
  const [theme, setTheme] = useState<'light' | 'dark'>(localStorage.getItem('agp_theme') as 'light' | 'dark' || 'light');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'topology'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('agp_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

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
    <div className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
      {/* Header */}
      <header className="border-b border-[var(--border-color)] px-4 lg:px-6 py-3 lg:py-4 flex justify-between items-center bg-[var(--header-bg)] sticky top-0 z-40">
        <div className="flex items-center gap-3 lg:gap-4">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 hover:bg-[var(--border-color)] rounded transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <img 
            src="https://media.licdn.com/dms/image/v2/D4D0BAQF_EJ9WP_ZXog/company-logo_200_200/company-logo_200_200/0/1738346357475/ag_p_americas_inc_logo?e=2147483647&v=beta&t=25UpHlgHLtn4pKtcfM3oX6G-fSBdHLEXaTMMws51PXc" 
            alt="AG&P Americas Logo" 
            className="h-8 lg:h-10 w-auto"
            referrerPolicy="no-referrer"
          />
          <div className="hidden sm:block h-8 w-[1px] bg-[var(--border-color)]" />
          <div className="hidden sm:block">
            <h1 className="text-sm lg:text-xl font-bold tracking-tight uppercase">Infrastructure Monitor</h1>
            <p className="text-[8px] lg:text-[10px] font-mono opacity-60 uppercase tracking-widest">AG&P Americas Inc.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-6">
          <div className="hidden lg:flex gap-4 text-[11px] font-mono uppercase">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold">System Operational</span>
            </div>
            <div className="opacity-40">|</div>
            <div className="opacity-60">{format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-[var(--border-color)] rounded-full transition-colors"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} className="text-amber-400" />}
            </button>
            <button 
              onClick={handleLogout}
              className="hidden sm:block text-[10px] font-mono uppercase opacity-40 hover:opacity-100 transition-opacity border border-[var(--border-color)] px-2 py-1 rounded"
            >
              Logout
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-brand-red text-white px-3 lg:px-4 py-1.5 lg:py-2 rounded text-[10px] lg:text-xs font-bold uppercase hover:bg-brand-red/90 transition-all flex items-center gap-2 shadow-sm"
            >
              <Plus size={14} /> <span className="hidden xs:inline">Add Device</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-64 bg-[var(--bg-sidebar)] z-50 lg:hidden p-6 flex flex-col gap-8 border-r border-[var(--border-color)]"
            >
              <div className="flex justify-between items-center">
                <img 
                  src="https://media.licdn.com/dms/image/v2/D4D0BAQF_EJ9WP_ZXog/company-logo_200_200/company-logo_200_200/0/1738346357475/ag_p_americas_inc_logo?e=2147483647&v=beta&t=25UpHlgHLtn4pKtcfM3oX6G-fSBdHLEXaTMMws51PXc" 
                  alt="Logo" 
                  className="h-8 w-auto"
                />
                <button onClick={() => setIsMobileMenuOpen(false)}><X size={20} /></button>
              </div>
              
              <nav className="flex flex-col gap-2">
                <button 
                  onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded text-xs font-bold uppercase transition-colors",
                    activeTab === 'dashboard' ? "bg-brand-red text-white" : "hover:bg-[var(--border-color)]"
                  )}
                >
                  <Activity size={18} /> Dashboard
                </button>
                <button 
                  onClick={() => { setActiveTab('topology'); setIsMobileMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded text-xs font-bold uppercase transition-colors",
                    activeTab === 'topology' ? "bg-brand-red text-white" : "hover:bg-[var(--border-color)]"
                  )}
                >
                  <Map size={18} /> Topology
                </button>
              </nav>

              <div className="mt-auto pt-6 border-t border-[var(--border-color)]">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 p-3 rounded text-xs font-bold uppercase text-brand-red hover:bg-brand-red/10 transition-colors"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Device Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 lg:p-8 rounded-lg w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold uppercase tracking-tight">Register New Node</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-1 hover:bg-[var(--border-color)] rounded transition-colors">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <form onSubmit={handleAddDevice} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-60 mb-1">Device Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-brand-red/20"
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
                    className="w-full p-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-brand-red/20"
                    value={newDevice.ip}
                    onChange={e => setNewDevice({...newDevice, ip: e.target.value})}
                    placeholder="192.168.1.10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase opacity-60 mb-1">Type</label>
                    <select 
                      className="w-full p-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded text-xs font-mono uppercase focus:outline-none"
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
                      className="w-full p-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded text-xs font-mono uppercase focus:outline-none"
                      value={newDevice.location}
                      onChange={e => setNewDevice({...newDevice, location: e.target.value})}
                      placeholder="Floor 1"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-brand-red text-white py-3 rounded text-xs font-bold uppercase mt-4 hover:bg-brand-red/90 transition-all shadow-md"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 lg:p-8 rounded-lg w-full max-w-2xl shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <Terminal size={24} className="text-brand-red" />
                  <h2 className="text-xl font-bold uppercase tracking-tight">Remote Agent Setup</h2>
                </div>
                <button onClick={() => setIsAgentModalOpen(false)} className="p-1 hover:bg-[var(--border-color)] rounded transition-colors">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs opacity-70">
                  Copy this script and run it on a computer inside your local network. It will ping your local devices and send the status back to this dashboard.
                </p>
                
                <div className="relative">
                  <pre className="bg-brand-dark text-emerald-400 p-4 rounded text-[10px] font-mono overflow-auto max-h-80 border border-white/10">
                    {agentScript}
                  </pre>
                  <button 
                    onClick={() => navigator.clipboard.writeText(agentScript)}
                    className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-[9px] font-mono uppercase"
                  >
                    Copy Code
                  </button>
                </div>

                <div className="bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 p-4 rounded text-[11px] text-amber-900 dark:text-amber-200">
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

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar / Stats */}
        <aside className="hidden lg:flex w-72 border-r border-[var(--border-color)] p-6 flex-col gap-8 bg-[var(--bg-sidebar)]">
          <nav className="flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "flex items-center gap-3 p-3 rounded text-[10px] font-bold uppercase tracking-widest transition-colors",
                activeTab === 'dashboard' ? "bg-brand-red text-white" : "hover:bg-[var(--border-color)] opacity-60"
              )}
            >
              <Activity size={16} /> Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('topology')}
              className={cn(
                "flex items-center gap-3 p-3 rounded text-[10px] font-bold uppercase tracking-widest transition-colors",
                activeTab === 'topology' ? "bg-brand-red text-white" : "hover:bg-[var(--border-color)] opacity-60"
              )}
            >
              <Map size={16} /> Topology
            </button>
          </nav>

          {activeTab === 'dashboard' && (
            <>
              <section>
                <h2 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4">Network Overview</h2>
                <div className="grid grid-cols-1 gap-4">
                  <div className="border border-[var(--border-color)] p-4 rounded bg-[var(--bg-main)]">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-mono uppercase opacity-60">Total Nodes</span>
                      <DbIcon size={14} className="opacity-40" />
                    </div>
                    <div className="text-3xl font-bold font-mono">{stats.total}</div>
                  </div>
                  <div className="border border-emerald-100 dark:border-emerald-900/30 p-4 rounded bg-emerald-50/30 dark:bg-emerald-900/10">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-mono uppercase opacity-60 text-emerald-800 dark:text-emerald-400">Online</span>
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    </div>
                    <div className="text-3xl font-bold font-mono text-emerald-900 dark:text-emerald-100">{stats.online}</div>
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
              </section>

              <section className="border-t border-[var(--border-color)] pt-6">
                <h2 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4">Remote Agent</h2>
                <button 
                  onClick={() => setIsAgentModalOpen(true)}
                  className="w-full border border-[var(--border-color)] p-3 rounded bg-[var(--bg-card)] hover:bg-brand-dark hover:text-white dark:hover:bg-brand-red transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase font-bold">
                    <Terminal size={14} className="group-hover:text-brand-red dark:group-hover:text-white" />
                    <span>Get Agent Script</span>
                  </div>
                </button>
              </section>
            </>
          )}
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'dashboard' ? (
            <section className="flex-1 flex flex-col bg-[var(--bg-card)]">
              <div className="p-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row gap-4 bg-[var(--bg-main)]/50">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
                  <input 
                    type="text" 
                    placeholder="SEARCH DEVICES..."
                    className="w-full pl-10 pr-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-brand-red/20"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select 
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="flex-1 sm:flex-none px-3 py-2 border border-[var(--border-color)] rounded text-[10px] font-mono uppercase bg-[var(--bg-card)] focus:outline-none"
                  >
                    <option value="all">Filter: All</option>
                    <option value="switch">Switch</option>
                    <option value="router">Router</option>
                    <option value="server">Server</option>
                    <option value="ap">Access Point</option>
                  </select>
                  <button className="px-3 py-2 border border-[var(--border-color)] rounded text-[10px] font-mono uppercase hover:bg-brand-dark hover:text-white transition-colors">
                    Export
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {/* Table Header - Hidden on mobile */}
                <div className="hidden sm:grid data-row bg-[var(--bg-main)] sticky top-0 z-[5] font-bold border-b-2 border-brand-dark dark:border-brand-red">
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
                        className="data-row flex flex-col sm:grid sm:grid-cols-[40px_1.5fr_1fr_1fr_1fr_100px_40px] gap-2 sm:gap-0 p-4 sm:p-3 border-b border-[var(--border-color)]"
                        onClick={() => setSelectedDevice(device)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <div className="text-[10px] font-mono opacity-40 sm:opacity-100">#{device.id.toString().padStart(3, '0')}</div>
                        <div className="font-bold flex items-center gap-2">
                          <DeviceIcon type={device.type} className={cn(
                            device.status === 'online' ? "text-emerald-500" : "text-brand-red"
                          )} />
                          {device.name}
                        </div>
                        <div className="text-[10px] font-mono opacity-60">{device.ip}</div>
                        <div className="text-[10px] font-mono uppercase opacity-60 sm:opacity-100">{device.type}</div>
                        <div className="text-[10px] font-mono opacity-60">{device.location || 'N/A'}</div>
                        <div>
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-2 py-0.5 rounded border",
                            device.status === 'online' 
                              ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" 
                              : "text-brand-red bg-brand-red/5 border-brand-red/20"
                          )}>
                            {device.status} {device.latency > 0 && `(${device.latency}ms)`}
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteDevice(device.id); }}
                            className="p-1.5 hover:bg-brand-red hover:text-white rounded transition-colors opacity-0 group-hover:opacity-100 sm:opacity-20 sm:hover:opacity-100"
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
              <div className="h-1/3 border-t border-[var(--border-color)] flex flex-col overflow-hidden bg-[var(--bg-main)]/30">
                <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-main)]/50 flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle size={14} className="text-brand-red" /> Global Downtime History
                  </h3>
                </div>
                
                <div className="flex-1 overflow-auto">
                  <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr] border-b border-[var(--border-color)] bg-brand-red/5 text-[9px] font-bold uppercase tracking-wider p-2 sticky top-0 z-[1]">
                    <div>Device Name</div>
                    <div>IP Address</div>
                    <div>Date & Time</div>
                    <div className="text-right">Event</div>
                  </div>
                  
                  <div className="divide-y divide-[var(--border-color)]">
                    {globalDowntimeLogs.length > 0 ? globalDowntimeLogs.map((log) => (
                      <div key={log.id} className="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_1fr_1fr] items-start sm:items-center p-3 sm:p-2 hover:bg-brand-red/5 transition-colors gap-1 sm:gap-0">
                        <div className="text-xs font-bold">{log.device_name}</div>
                        <div className="font-mono text-[10px] opacity-60">{log.device_ip}</div>
                        <div className="font-mono text-[10px] opacity-60">
                          {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                        </div>
                        <div className="w-full sm:w-auto text-right">
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
          ) : (
            <section className="flex-1 flex flex-col bg-[var(--bg-card)] items-center justify-center p-10 text-center">
              <div className="max-w-md">
                <div className="bg-brand-red/10 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <Map size={48} className="text-brand-red" />
                </div>
                <h2 className="text-2xl font-bold uppercase tracking-tight mb-2">Network Topology</h2>
                <p className="text-sm opacity-60 mb-8 font-mono uppercase">
                  Visual mapping of the AG&P Americas infrastructure is currently under development.
                </p>
                <div className="p-4 border border-brand-red/20 rounded bg-brand-red/5 text-[10px] font-mono uppercase text-brand-red">
                  Status: Module Initializing // Pending Asset Mapping
                </div>
              </div>
            </section>
          )}
        </div>

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

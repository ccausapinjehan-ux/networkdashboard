import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import ping from "ping";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("network_monitor.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ip TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'unknown',
    last_seen DATETIME,
    location TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    status TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(device_id) REFERENCES devices(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('simulation_mode', 'false');
`);

// Seed initial data if empty
const deviceCount = db.prepare("SELECT COUNT(*) as count FROM devices").get() as { count: number };
if (deviceCount.count === 0) {
  const insert = db.prepare("INSERT INTO devices (name, ip, type, status, location) VALUES (?, ?, ?, ?, ?)");
  insert.run("Core Switch 01", "192.168.1.1", "switch", "online", "Data Center A");
  insert.run("Edge Router", "10.0.0.1", "router", "online", "Main Office");
  insert.run("Access Point North", "192.168.1.50", "ap", "online", "Floor 2");
  insert.run("Backup Server", "192.168.1.100", "server", "offline", "Basement");
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/devices", (req, res) => {
    const devices = db.prepare("SELECT * FROM devices").all();
    res.json(devices);
  });

  app.post("/api/devices", (req, res) => {
    const { name, ip, type, location } = req.body;
    const info = db.prepare("INSERT INTO devices (name, ip, type, location) VALUES (?, ?, ?, ?)").run(name, ip, type, location);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/devices/:id", (req, res) => {
    const { id } = req.params;
    console.log(`Deleting device ${id}`);
    db.prepare("DELETE FROM logs WHERE device_id = ?").run(id);
    db.prepare("DELETE FROM devices WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/logs/:deviceId", (req, res) => {
    const logs = db.prepare("SELECT * FROM logs WHERE device_id = ? ORDER BY timestamp DESC LIMIT 50").all(req.params.deviceId);
    res.json(logs);
  });

  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value === 'true';
      return acc;
    }, {});
    res.json(settingsObj);
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, String(value));
    res.json({ success: true });
  });

  app.post("/api/agent/report", (req, res) => {
    const reports = req.body; // Array of { ip: string, status: string }
    const now = new Date().toISOString();
    
    if (!Array.isArray(reports)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    reports.forEach(report => {
      const devices = db.prepare("SELECT * FROM devices WHERE ip = ?").all() as any[];
      
      devices.forEach(device => {
        const normalizedStatus = report.status.toLowerCase();
        console.log(`[AGENT REPORT] Device ${device.id} (${device.ip}): ${device.status} -> ${normalizedStatus}`);
        
        // Always update last_seen and status when agent reports
        db.prepare("UPDATE devices SET last_seen = ?, status = ? WHERE id = ?").run(now, normalizedStatus, device.id);

        // Log if status changed
        if (device.status !== normalizedStatus) {
          db.prepare("INSERT INTO logs (device_id, status, timestamp) VALUES (?, ?, ?)").run(device.id, normalizedStatus, now);
        }
        
        io.emit("device_update", {
          id: device.id,
          status: normalizedStatus,
          timestamp: now
        });
      });
    });

    res.json({ success: true });
  });

  // Real monitoring logic
  setInterval(async () => {
    const simulationMode = db.prepare("SELECT value FROM settings WHERE key = 'simulation_mode'").get() as { value: string };
    const isSimulation = simulationMode?.value === 'true';

    const devices = db.prepare("SELECT * FROM devices").all() as any[];
    const now = new Date();

    for (const device of devices) {
      try {
        // Skip server-side ping if device was updated by an agent in the last 10 minutes
        // This prevents clock drift from causing flickering
        if (device.last_seen && !isSimulation) {
          const lastSeen = new Date(device.last_seen); 
          const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;
          if (diffSeconds < 600) continue; 
        }

        let newStatus: string;
        
        if (isSimulation) {
          // In simulation mode, we pretend private IPs are online
          // or just make everything online for the demo feel
          newStatus = "online";
        } else {
          const res = await ping.promise.probe(device.ip, {
            timeout: 2,
          });
          newStatus = res.alive ? "online" : "offline";
        }
        
        if (newStatus !== device.status) {
          db.prepare("UPDATE devices SET status = ?, last_seen = ? WHERE id = ?").run(newStatus, now.toISOString(), device.id);
          db.prepare("INSERT INTO logs (device_id, status, timestamp) VALUES (?, ?, ?)").run(device.id, newStatus, now.toISOString());
          
          io.emit("device_update", {
            id: device.id,
            status: newStatus,
            timestamp: now.toISOString()
          });
        }
      } catch (err) {
        console.error(`Failed to ping ${device.ip}:`, err);
      }
    }
  }, 10000); // Check every 10 seconds

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

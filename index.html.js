// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  users;
  vpnServers;
  connections;
  userIdCounter;
  serverIdCounter;
  connectionIdCounter;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.vpnServers = /* @__PURE__ */ new Map();
    this.connections = /* @__PURE__ */ new Map();
    this.userIdCounter = 1;
    this.serverIdCounter = 1;
    this.connectionIdCounter = 1;
    this.initializeVpnServers();
  }
  // Initialize some VPN servers
  initializeVpnServers() {
    const servers = [
      {
        name: "USA - New York",
        country: "United States",
        countryCode: "us",
        hostname: "nyc.vpn.example.com",
        ip: "104.12.xx.xx",
        ping: 32,
        uptime: 99.8,
        load: 45,
        users: 124,
        isFavorite: false,
        protocol: "openvpn",
        port: 1194,
        status: "online"
      },
      {
        name: "Netherlands - Amsterdam",
        country: "Netherlands",
        countryCode: "nl",
        hostname: "ams.vpn.example.com",
        ip: "82.54.xx.xx",
        ping: 48,
        uptime: 99.9,
        load: 28,
        users: 87,
        isFavorite: true,
        protocol: "openvpn",
        port: 1194,
        status: "online"
      },
      {
        name: "Japan - Tokyo",
        country: "Japan",
        countryCode: "jp",
        hostname: "tokyo.vpn.example.com",
        ip: "145.87.xx.xx",
        ping: 112,
        uptime: 99.7,
        load: 67,
        users: 53,
        isFavorite: false,
        protocol: "openvpn",
        port: 1194,
        status: "online"
      },
      {
        name: "Germany - Frankfurt",
        country: "Germany",
        countryCode: "de",
        hostname: "frankfurt.vpn.example.com",
        ip: "94.26.xx.xx",
        ping: 41,
        uptime: 99.9,
        load: 52,
        users: 96,
        isFavorite: false,
        protocol: "openvpn",
        port: 1194,
        status: "online"
      },
      {
        name: "Singapore",
        country: "Singapore",
        countryCode: "sg",
        hostname: "sg.vpn.example.com",
        ip: "128.53.xx.xx",
        ping: 95,
        uptime: 99.6,
        load: 35,
        users: 61,
        isFavorite: false,
        protocol: "openvpn",
        port: 1194,
        status: "online"
      },
      {
        name: "UK - London",
        country: "United Kingdom",
        countryCode: "gb",
        hostname: "london.vpn.example.com",
        ip: "78.46.xx.xx",
        ping: 55,
        uptime: 99.5,
        load: 87,
        users: 178,
        isFavorite: false,
        protocol: "openvpn",
        port: 1194,
        status: "online"
      }
    ];
    servers.forEach((server) => {
      this.createServer(server);
    });
  }
  // User methods
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = this.userIdCounter++;
    const createdAt = /* @__PURE__ */ new Date();
    const user = { ...insertUser, id, createdAt };
    this.users.set(id, user);
    return user;
  }
  // VPN Server methods
  async getAllServers() {
    return Array.from(this.vpnServers.values());
  }
  async getServer(id) {
    return this.vpnServers.get(id);
  }
  async createServer(insertServer) {
    const id = this.serverIdCounter++;
    const server = { ...insertServer, id };
    this.vpnServers.set(id, server);
    return server;
  }
  async updateServer(id, data) {
    const server = this.vpnServers.get(id);
    if (!server) return void 0;
    const updatedServer = { ...server, ...data };
    this.vpnServers.set(id, updatedServer);
    return updatedServer;
  }
  async toggleFavorite(id) {
    const server = this.vpnServers.get(id);
    if (!server) return void 0;
    const updatedServer = { ...server, isFavorite: !server.isFavorite };
    this.vpnServers.set(id, updatedServer);
    return updatedServer;
  }
  // Connection methods
  async getAllConnections(sessionId) {
    return Array.from(this.connections.values()).filter((connection) => connection.sessionId === sessionId);
  }
  async getConnection(id) {
    return this.connections.get(id);
  }
  async createConnection(insertConnection) {
    const id = this.connectionIdCounter++;
    const connection = { ...insertConnection, id };
    this.connections.set(id, connection);
    const server = this.vpnServers.get(connection.serverId);
    if (server) {
      this.updateServer(server.id, { users: server.users + 1 });
    }
    return connection;
  }
  async updateConnection(id, data) {
    const connection = this.connections.get(id);
    if (!connection) return void 0;
    const updatedConnection = { ...connection, ...data };
    this.connections.set(id, updatedConnection);
    return updatedConnection;
  }
  async endConnection(id, dataUsed) {
    const connection = this.connections.get(id);
    if (!connection) return void 0;
    const connectionEnd = /* @__PURE__ */ new Date();
    const durationMs = connectionEnd.getTime() - connection.connectionStart.getTime();
    const durationMinutes = Math.floor(durationMs / 1e3 / 60);
    const updatedConnection = {
      ...connection,
      connectionEnd,
      duration: durationMinutes,
      dataUsed,
      status: "completed"
    };
    this.connections.set(id, updatedConnection);
    const server = this.vpnServers.get(connection.serverId);
    if (server) {
      this.updateServer(server.id, { users: Math.max(0, server.users - 1) });
    }
    return updatedConnection;
  }
};
var storage = new MemStorage();

// server/routes.ts
import { nanoid } from "nanoid";
import { ZodError } from "zod";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import crypto from "crypto";
var sessionCache = /* @__PURE__ */ new Map();
function generateOpenVpnConfig(serverHost, port) {
  return `client
dev tun
proto udp
remote ${serverHost} ${port}
resolv-retry infinite
nobind
persist-key
persist-tun
cipher AES-256-GCM
auth SHA256
verb 3
key-direction 1

<ca>
-----BEGIN CERTIFICATE-----
MIIDQDCCAiigAwIBAgIJALY5JGxmHFz5MA0GCSqG...
-----END CERTIFICATE-----
</ca>
`;
}
function generateWireGuardConfig(serverHost, port) {
  return `[Interface]
PrivateKey = ${crypto.randomBytes(32).toString("base64")}
Address = 10.0.0.2/24
DNS = 8.8.8.8, 8.8.4.4

[Peer]
PublicKey = ${crypto.randomBytes(32).toString("base64")}
Endpoint = ${serverHost}:${port}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;
}
async function registerRoutes(app2) {
  const httpServer = createServer(app2);
  app2.use((req, res, next) => {
    let sessionId = req.headers["x-session-id"];
    if (!sessionId || !sessionCache.has(sessionId)) {
      sessionId = nanoid();
      sessionCache.set(sessionId, { created: /* @__PURE__ */ new Date() });
      res.setHeader("X-Session-Id", sessionId);
    }
    req.sessionId = sessionId;
    next();
  });
  setInterval(() => {
    const now = /* @__PURE__ */ new Date();
    for (const [sessionId, session] of sessionCache.entries()) {
      if (now.getTime() - session.created.getTime() > 24 * 60 * 60 * 1e3) {
        sessionCache.delete(sessionId);
      }
    }
  }, 36e5);
  app2.get("/api/servers", async (req, res) => {
    try {
      const servers = await storage.getAllServers();
      const updatedServers = servers.map((server) => {
        if (Math.random() > 0.7) {
          const ping = Math.max(20, Math.min(150, server.ping + Math.floor(Math.random() * 11) - 5));
          const load = Math.max(5, Math.min(95, server.load + Math.floor(Math.random() * 11) - 5));
          const users = Math.max(5, server.users + Math.floor(Math.random() * 5) - 2);
          storage.updateServer(server.id, { ping, load, users });
          return { ...server, ping, load, users };
        }
        return server;
      });
      res.json(updatedServers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch VPN servers" });
    }
  });
  app2.get("/api/servers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const server = await storage.getServer(id);
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }
      res.json(server);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch VPN server" });
    }
  });
  app2.post("/api/servers/:id/favorite", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const server = await storage.toggleFavorite(id);
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }
      res.json(server);
    } catch (error) {
      res.status(500).json({ message: "Failed to update favorite status" });
    }
  });
  app2.post("/api/servers/:id/config", async (req, res) => {
    try {
      const sessionId = req.sessionId;
      const id = parseInt(req.params.id);
      const server = await storage.getServer(id);
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }
      const { protocol = "openvpn", connectionType = "udp" } = req.body;
      let config = "";
      if (protocol === "wireguard") {
        config = generateWireGuardConfig(server.hostname, server.port);
      } else {
        config = generateOpenVpnConfig(server.hostname, server.port);
      }
      await storage.createConnection({
        userId: null,
        serverId: server.id,
        connectionStart: /* @__PURE__ */ new Date(),
        connectionEnd: null,
        duration: 0,
        dataUsed: 0,
        status: "connected",
        sessionId
      });
      res.json({
        config,
        serverId: server.id,
        serverName: server.name,
        serverIp: server.ip,
        countryCode: server.countryCode,
        protocol,
        connectionType
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate configuration" });
    }
  });
  app2.post("/api/connections/:serverId/end", async (req, res) => {
    try {
      const sessionId = req.sessionId;
      const serverId = parseInt(req.params.serverId);
      const { dataUsed = Math.floor(Math.random() * 200) + 1 } = req.body;
      const connections = await storage.getAllConnections(sessionId);
      const activeConnection = connections.find(
        (c) => c.serverId === serverId && c.status === "connected"
      );
      if (!activeConnection) {
        return res.status(404).json({ message: "No active connection found" });
      }
      const updatedConnection = await storage.endConnection(activeConnection.id, dataUsed);
      res.json(updatedConnection);
    } catch (error) {
      res.status(500).json({ message: "Failed to end connection" });
    }
  });
  app2.get("/api/connections/history", async (req, res) => {
    try {
      const sessionId = req.sessionId;
      const connections = await storage.getAllConnections(sessionId);
      const connectionsWithServerDetails = await Promise.all(
        connections.map(async (connection) => {
          const server = await storage.getServer(connection.serverId);
          return {
            ...connection,
            server: server || { name: "Unknown Server", countryCode: "unknown" }
          };
        })
      );
      res.json(connectionsWithServerDetails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch connection history" });
    }
  });
  app2.get("/api/session", (req, res) => {
    const sessionId = req.sessionId;
    const session = sessionCache.get(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    const created = session.created;
    const expiresAt = new Date(created.getTime() + 24 * 60 * 60 * 1e3);
    const now = /* @__PURE__ */ new Date();
    const hoursRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1e3 * 60 * 60)));
    res.json({
      sessionId,
      created: created.toISOString(),
      expiresAt: expiresAt.toISOString(),
      hoursRemaining
    });
  });
  app2.post("/api/contact", async (req, res) => {
    try {
      const contactSchema = z.object({
        name: z.string().optional(),
        email: z.string().email(),
        subject: z.string().optional(),
        message: z.string().min(10),
        category: z.string().optional(),
        agreeToTerms: z.boolean().refine((val) => val === true, {
          message: "You must agree to the terms and conditions"
        })
      });
      const validatedData = contactSchema.parse(req.body);
      res.json({
        success: true,
        message: "Your message has been sent successfully!"
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({
          success: false,
          message: validationError.message
        });
      }
      res.status(500).json({
        success: false,
        message: "Failed to submit contact form"
      });
    }
  });
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid as nanoid2 } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid2()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();

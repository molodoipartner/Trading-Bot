// ws/client.js
const WebSocket = require("ws");
const crypto = require("crypto");

// ================= ENV =================
const API_KEY = process.env.BYBIT_API_KEY;
const API_SECRET = process.env.BYBIT_API_SECRET;

const WS_URL = "wss://stream.bybit.com/v5/private";

// ======================================
class BybitWSClient {
  constructor({
    onPositionOpen,
    onPositionClose,
    onExecution,
  } = {}) {
    this.ws = null;

    this.onPositionOpen = onPositionOpen;
    this.onPositionClose = onPositionClose;
    this.onExecution = onExecution;

    this.isInPosition = false;

    // ⭐ reconnect control
    this.reconnectDelay = 2000;
    this.maxReconnectDelay = 30000;

    this.pingInterval = null;
    this.reconnectTimeout = null;
  }

  // ---------- CONNECT ----------
  connect() {
    console.log("🔌 Connecting to Bybit Private WS...");

    this.ws = new WebSocket(WS_URL);

    this.ws.on("open", () => {
      console.log("✅ WS connected");
      this.authenticate();
    });

    this.ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      this.handleMessage(msg);
    });

    this.ws.on("error", (err) => {
      console.error("❌ WS error:", err.message);
    });

    // ⭐ CLOSE — ЕДИНСТВЕННОЕ МЕСТО
    this.ws.on("close", (code, reason) => {
      console.warn("⚠️ WS closed", {
        code,
        reason: reason?.toString()
      });

      this.cleanup();
      this.scheduleReconnect();
    });
  }

  // ---------- CLEANUP ----------
  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ---------- RECONNECT ----------
  scheduleReconnect() {
    if (this.reconnectTimeout) return;

    console.log(`🔁 Reconnecting in ${this.reconnectDelay / 1000}s...`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay
      );
    }, this.reconnectDelay);
  }

  // ---------- AUTH ----------
  authenticate() {
    const expires = Date.now() + 10_000;

    const signature = crypto
      .createHmac("sha256", API_SECRET)
      .update(`GET/realtime${expires}`)
      .digest("hex");

    console.log("🔐 Sending auth...");

    this.ws.send(JSON.stringify({
      op: "auth",
      args: [API_KEY, expires, signature]
    }));
  }

  // ---------- SUBSCRIBE ----------
  subscribe() {
    console.log("📡 Subscribing to private topics...");

    this.ws.send(JSON.stringify({
      op: "subscribe",
      args: [
        "order",
        "execution",
        "position"
      ]
    }));
  }

  // ---------- MESSAGE ROUTER ----------
  handleMessage(msg) {

    // AUTH OK
    if (msg.op === "auth" && msg.success) {
      console.log("🔓 Auth success");
      this.startPing();
      this.subscribe();

      // ⭐ успешное соединение → сбрасываем backoff
      this.reconnectDelay = 2000;
      return;
    }

    if (msg.op === "pong") {
      console.log("🏓 pong");
      return;
    }

    // SUBSCRIBE OK
    if (msg.op === "subscribe" && msg.success) {
      console.log("✅ Subscribe success");
      return;
    }

    if (msg.topic === "order") {
      this.handleOrder(msg.data);
      return;
    }

    if (msg.topic === "execution") {
      this.handleExecution(msg.data);
      return;
    }

    if (msg.topic === "position") {
      this.handlePosition(msg.data);
      return;
    }
  }

  // ---------- PING ----------
  startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: "ping" }));
        console.log("📡 ping");
      }
    }, 20_000);
  }

  // ---------- HANDLERS ----------

  handleOrder(orders) {
    orders.forEach(o => {
      if (o.orderStatus === "Filled") {
        console.log("✅ ORDER FILLED:", {
          symbol: o.symbol,
          side: o.side,
          qty: o.qty,
          avgPrice: o.avgPrice,
          orderId: o.orderId
        });
      }

      if (o.orderStatus === "Cancelled") {
        console.log("❌ ORDER CANCELLED:", o.orderId);
      }
    });
  }

  handleExecution(executions) {
    executions.forEach(e => {
      console.log("💰 EXECUTION:", {
        symbol: e.symbol,
        side: e.side,
        qty: e.execQty,
        price: e.execPrice,
      });

      this.onExecution?.(e);
    });
  }

  handlePosition(positions) {
    positions.forEach(p => {
      const size = Number(p.size);

      if (size > 0 && !this.isInPosition) {
        this.isInPosition = true;
        console.log("📈 POSITION OPENED:", p.symbol);
        this.onPositionOpen?.(p);
        return;
      }

      if (size === 0 && this.isInPosition) {
        this.isInPosition = false;
        console.log("🏁 POSITION CLOSED:", p.symbol);
        this.onPositionClose?.(p);
      }
    });
  }
}

module.exports = { BybitWSClient };

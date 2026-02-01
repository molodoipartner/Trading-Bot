const WebSocket = require("ws");
const crypto = require("crypto");

// ================= ENV =================
const API_KEY = process.env.BYBIT_API_KEY;
const API_SECRET = process.env.BYBIT_API_SECRET;

const WS_URL = "wss://stream.bybit.com/v5/private";

// ======================================
class BybitWSClient {
  constructor({ onPositionOpen, onPositionClose } = {}) {
    this.ws = null;
    this.onPositionOpen = onPositionOpen;
    this.onPositionClose = onPositionClose;
    this.isInPosition = false;
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

    this.ws.on("close", () => {
      console.warn("⚠️ WS closed");
    });
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

    // ORDER EVENTS
    if (msg.topic === "order") {
      this.handleOrder(msg.data);
      return;
    }

    // EXECUTION EVENTS (REAL TRADES)
    if (msg.topic === "execution") {
      this.handleExecution(msg.data);
      return;
    }

    // POSITION EVENTS
    if (msg.topic === "position") {
      this.handlePosition(msg.data);
      return;
    }

    this.ws.on("close", () => {
      console.warn("⚠️ WS closed");
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    });
  }

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
        orderId: e.orderId
      });
    });
  }

  handlePosition(positions) {
    positions.forEach(p => {
      const size = Number(p.size);

      // 📈 позиция открылась
      if (size > 0 && !this.isInPosition) {
        this.isInPosition = true;

        console.log("📈 POSITION OPENED:", {
          symbol: p.symbol,
          size: p.size,
          entryPrice: p.entryPrice
        });

        this.onPositionOpen?.(p);
      }

      // 📉 позиция закрылась
      if (size === 0 && this.isInPosition) {
        this.isInPosition = false;

        console.log("🏁 POSITION CLOSED:", {
          symbol: p.symbol,
          side: p.side
        });

        this.onPositionClose?.(p);
      }
    });
  }

}

// ---------- EXPORT ----------
module.exports = { BybitWSClient };

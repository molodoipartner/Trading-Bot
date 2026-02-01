const axios = require("axios");
const crypto = require("crypto");

const API_KEY = process.env.BYBIT_API_KEY;
const API_SECRET = process.env.BYBIT_API_SECRET;
const BASE_URL = "https://api.bybit.com";

let timeOffset = 0;

// ---------- TIME SYNC ----------
async function syncServerTime() {
  const res = await axios.get(`${BASE_URL}/v5/market/time`);
  timeOffset = res.data.result.timeSecond * 1000 - Date.now();
  console.log("⏱ Server time synced");
}

// ---------- PUBLIC ----------
async function publicRequest(path, params = {}) {
  const res = await axios.get(`${BASE_URL}${path}`, { params });

  if (res.data.retCode !== 0) {
    throw new Error(res.data.retMsg);
  }

  return res.data;
}

async function privateRequest(method, path, params = {}) {
  const timestamp = Date.now() + timeOffset;
  const recvWindow = 5000;

  let queryString = "";
  let bodyString = "";

  if (method === "GET") {
    queryString = new URLSearchParams(params).toString();
  } else {
    bodyString = JSON.stringify(params);
  }

  const signString =
    timestamp +
    API_KEY +
    recvWindow +
    (method === "GET" ? queryString : bodyString);

  const signature = crypto
    .createHmac("sha256", API_SECRET)
    .update(signString)
    .digest("hex");

  const res = await axios({
    method,
    url: `${BASE_URL}${path}${queryString ? `?${queryString}` : ""}`,
    headers: {
      "X-BAPI-API-KEY": API_KEY,
      "X-BAPI-SIGN": signature,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "X-BAPI-SIGN-TYPE": "2",
      "Content-Type": "application/json",
    },
    data: method === "GET" ? undefined : params,
  });

  if (res.data.retCode !== 0) {
    throw new Error(res.data.retMsg);
  }

  return res.data;
}

// ---------- EXPORTS ----------
module.exports = {
  syncServerTime,
  publicRequest,
  privateRequest,
};

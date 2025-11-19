import express from "express";
import cors from "cors";
import helmet from "helmet";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// -----------------------
// 🔌 SUPABASE CONNECT
// -----------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false }
  }
);

// -----------------------
// 🚀 EXPRESS INIT
// -----------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// -----------------------
// 📁 PATH SETUP
// -----------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  app.use(express.static(__dirname));
}

app.get("/", (req, res) => {
  const indexFile = fs.existsSync(path.join(distPath, "index.html"))
    ? path.join(distPath, "index.html")
    : path.join(__dirname, "index.html");

  res.sendFile(indexFile);
});

// -----------------------
// 📡 STATUS ENDPOINT
// -----------------------
app.get("/api/status", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ======================================================
//            🔥 API ROUTE-LAR (SUPABASE VERSION) 
// ======================================================

// -----------------------
// 📌 1) CREATE / UPSERT ORDER
// -----------------------
app.post("/api/order", async (req, res) => {
  try {
    const { tokenId, price, sellerAddress, seaportOrder, orderHash, image } =
      req.body;

    if (!tokenId || (!price && price !== 0) || !sellerAddress || !seaportOrder) {
      return res.status(400).json({ success: false, error: "Missing parameters" });
    }

    const id = nanoid();
    const createdAt = new Date().toISOString();

    const { error } = await supabase.from("orders").upsert(
      {
        id,
        tokenId: tokenId.toString(),
        price,
        nftContract: process.env.NFT_CONTRACT_ADDRESS,
        marketplaceContract: process.env.SEAPORT_CONTRACT_ADDRESS,
        seller: sellerAddress.toLowerCase(),
        seaportOrder: seaportOrder,
        orderHash: orderHash || null,
        onChain: false,
        status: "active",
        image: image || null,
        createdAt,
        updatedAt: createdAt,
      },
      { onConflict: "orderHash" }
    );

    if (error) throw error;

    res.json({ success: true, order: { id, tokenId, price, seller: sellerAddress } });
  } catch (err) {
    console.error("POST /api/order error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// -----------------------
// 📌 2) GET ALL ORDERS
// -----------------------
app.get("/api/orders", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "active")
      .order("createdAt", { ascending: false })
      .limit(500);

    if (error) throw error;

    res.json({ success: true, orders: data });
  } catch (err) {
    console.error("GET /api/orders error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// -----------------------
// 📌 3) BUY CALLBACK
// -----------------------
app.post("/api/buy", async (req, res) => {
  try {
    const { orderHash, buyerAddress } = req.body;

    if (!orderHash || !buyerAddress) {
      return res.status(400).json({
        success: false,
        error: "Missing orderHash or buyerAddress",
      });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        onChain: true,
        buyerAddress: buyerAddress.toLowerCase(),
        status: "sold",
        updatedAt: new Date().toISOString(),
      })
      .eq("orderHash", orderHash)
      .select();

    if (error) throw error;

    res.json({ success: true, order: data[0] });
  } catch (err) {
    console.error("POST /api/buy error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// -----------------------
// 🚀 START SERVER
// -----------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend ${PORT}-də işləyir`);
});
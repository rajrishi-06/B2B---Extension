// server.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";


dotenv.config(); // load .env variables

const app = express();

// resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Add this to serve upload.html as the root page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "upload.html"));
});

// Endpoint to send your Supabase config
app.get("/config", (req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file");
    return res.status(500).json({ error: "Server configuration missing." });
  }
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
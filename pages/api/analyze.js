// api/analyze.js — Vercel serverless function for feedback analysis
// Uses Claude Sonnet 4 with per-IP and global rate limiting

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RATE_LIMIT_MAX = 2;          // per IP per day
const GLOBAL_RATE_LIMIT_MAX = 5;   // total across all IPs per day
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const GLOBAL_KEY = "__global__";

// ⚠️  PRODUCTION WARNING: This in-memory Map is NOT persistent across cold starts.
// The frontend localStorage limit is the only reliable enforcement until you add
// Vercel KV (Redis). To upgrade:
//   1. vercel kv create rate-limit-store
//   2. npm install @vercel/kv
//   3. Replace Map reads/writes with kv.get / kv.set calls.
const rateLimitStore = new Map();

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function checkRateLimit(ip) {
  const now = Date.now();

  // ── Global daily cap ─────────────────────────────────────────────────────
  const global = rateLimitStore.get(GLOBAL_KEY);
  if (global && now < global.resetTime && global.count >= GLOBAL_RATE_LIMIT_MAX) {
    return { allowed: false, used: global.count, resetTime: global.resetTime, reason: "global" };
  }

  // ── Per-IP daily cap ─────────────────────────────────────────────────────
  const stored = rateLimitStore.get(ip);

  // Clean up stale entry
  if (stored && now - stored.firstRequestTime > RATE_LIMIT_WINDOW_MS + 3600000) {
    rateLimitStore.delete(ip);
  }

  const ipEntry = rateLimitStore.get(ip);

  if (!ipEntry) {
    const resetTime = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(ip, { count: 1, firstRequestTime: now, resetTime });

    if (!global || now >= global.resetTime) {
      rateLimitStore.set(GLOBAL_KEY, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    } else {
      global.count += 1;
    }

    return { allowed: true, used: 1, resetTime };
  }

  ipEntry.count += 1;
  const allowed = ipEntry.count <= RATE_LIMIT_MAX;

  if (allowed) {
    if (!global || now >= global.resetTime) {
      rateLimitStore.set(GLOBAL_KEY, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    } else {
      global.count += 1;
    }
  }

  return { allowed, used: ipEntry.count, resetTime: ipEntry.resetTime };
}

async function callClaudeAPI(userMessage, systemPrompt) {
  if (!ANTHROPIC_API_KEY) {
    throw { statusCode: 500, message: "ANTHROPIC_API_KEY environment variable is not set." };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.error?.message || `Claude API error: ${response.status}`;
    if (response.status === 429) throw { statusCode: 429, message: "Claude API rate limited. Please try again later." };
    if (response.status === 401) throw { statusCode: 500, message: "Authentication failed. Check ANTHROPIC_API_KEY." };
    throw { statusCode: 500, message };
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || "";
  if (!content) throw { statusCode: 500, message: "Claude returned an empty response." };
  return content;
}

function parseClaudeResponse(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw { statusCode: 400, message: "Claude did not return valid JSON. Please try again." };
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    throw { statusCode: 400, message: `Failed to parse Claude response: ${e.message}` };
  }
}

function shapeResult(parsed) {
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  if (!parsed.themes || !Array.isArray(parsed.themes)) {
    throw { statusCode: 400, message: "Invalid response format: missing 'themes' array." };
  }

  return parsed.themes
    .map((th) => ({
      id: generateId(),
      themeName: th.themeName || "General",
      summary: th.summary || "",
      tasks: (th.tasks || [])
        .map((t) => ({
          id: generateId(),
          text: t.text || "",
          xp: Math.max(3, Math.min(35, Number(t.xp) || 15)),
          importance: t.importance || "moderate",
          sources: Array.isArray(t.sources) ? t.sources : [],
          done: false,
        }))
        .filter((t) => t.text),
    }))
    .filter((th) => th.tasks.length > 0);
}

function getCORSHeaders(req) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "http://localhost:3000",
    "http://localhost:3001",
  ].filter(Boolean);

  const isAllowed = !origin || allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? (origin || "*") : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "3600",
  };
}

module.exports = async function handler(req, res) {
  const corsHeaders = getCORSHeaders(req);

  // Preflight
  if (req.method === "OPTIONS") {
    Object.entries(corsHeaders).forEach(([k, v]) => { if (v) res.setHeader(k, v); });
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed. Use POST." } });
  }

  Object.entries(corsHeaders).forEach(([k, v]) => { if (v) res.setHeader(k, v); });
  res.setHeader("Content-Type", "application/json");

  try {
    // Rate limit check
    const ip = getClientIP(req);
    const rl = checkRateLimit(ip);

    if (!rl.allowed) {
      const msUntilReset = Math.max(0, rl.resetTime - Date.now());
      return res.status(429).json({
        error: {
          message: rl.reason === "global"
            ? "The tool has reached its global daily limit. Check back tomorrow at midnight UTC."
            : "Your daily limit has been reached. Check back tomorrow at midnight UTC.",
          resetTime: new Date(rl.resetTime).toISOString(),
          secondsUntilReset: Math.ceil(msUntilReset / 1000),
        },
      });
    }

    // Parse body (Vercel auto-parses JSON, but fall back manually)
    let body = req.body;
    if (!body) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    }

    const { system, user } = body;

    if (!user || typeof user !== "string") {
      return res.status(400).json({ error: { message: "Missing or invalid 'user' field." } });
    }
    if (!system || typeof system !== "string") {
      return res.status(400).json({ error: { message: "Missing or invalid 'system' field." } });
    }

    const claudeResponse = await callClaudeAPI(user, system);
    const parsed = parseClaudeResponse(claudeResponse);
    const shaped = shapeResult(parsed);

    return res.status(200).json({ text: claudeResponse, themes: shaped });

  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: { message: error.message } });
    }
    console.error("Unexpected error in /api/analyze:", error);
    return res.status(500).json({
      error: {
        message: "Internal server error. Please try again later.",
        ...(process.env.NODE_ENV === "development" && { details: error.message }),
      },
    });
  }
};

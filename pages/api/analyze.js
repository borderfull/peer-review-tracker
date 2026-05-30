// pages/api/analyze.js — Vercel serverless function for feedback analysis
// Uses Claude Sonnet 4.6 with rate limiting per IP address

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// ⚠️  PRODUCTION WARNING: This in-memory Map is NOT persistent.
// Vercel serverless functions are stateless — each cold start gets a fresh empty Map,
// so this rate limit resets on every new function instance, not just deployments.
// The frontend localStorage limit is the only reliable enforcement until you add persistence.
//
// To add real server-side persistence, use Vercel KV (Redis):
//   1. Run: vercel kv create rate-limit-store
//   2. npm install @vercel/kv
//   3. Replace Map reads/writes below with:
//      import { kv } from "@vercel/kv";
//      const stored = await kv.get(`rl:${ip}`);
//      await kv.set(`rl:${ip}`, newState, { exat: Math.floor(resetTime / 1000) });
const rateLimitStore = new Map();

/**
 * Get the client IP address from the request
 */
function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/**
 * Check and update rate limit for an IP address
 * Returns { allowed: boolean, used: number, resetTime: number }
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const stored = rateLimitStore.get(ip);

  // Clean up old entries (older than 25 hours)
  if (stored && now - stored.firstRequestTime > RATE_LIMIT_WINDOW_MS + 3600000) {
    rateLimitStore.delete(ip);
    return { allowed: true, used: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
  }

  if (!stored) {
    const resetTime = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(ip, {
      count: 1,
      firstRequestTime: now,
      resetTime: resetTime,
    });
    return { allowed: true, used: 1, resetTime };
  }

  // Increment count
  stored.count += 1;
  const allowed = stored.count <= RATE_LIMIT_MAX;

  return { allowed, used: stored.count, resetTime: stored.resetTime };
}

/**
 * Call Claude API to synthesize feedback
 */
async function callClaudeAPI(userMessage, systemPrompt) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
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
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const statusText = response.statusText || "Unknown Error";
    const message =
      error.error?.message ||
      error.message ||
      `Claude API error: ${response.status} ${statusText}`;

    if (response.status === 429) {
      throw { statusCode: 429, message: "Claude API rate limited. Please try again later." };
    }
    if (response.status === 401) {
      throw { statusCode: 500, message: "Authentication failed with Claude API. Check ANTHROPIC_API_KEY." };
    }

    throw { statusCode: 500, message };
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || "";

  if (!content) {
    throw { statusCode: 500, message: "Claude returned empty response" };
  }

  return content;
}

/**
 * Parse and validate the feedback synthesis response
 */
function parseClaudeResponse(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw {
      statusCode: 400,
      message: "Claude did not return valid JSON. Please try again.",
    };
  }

  try {
    const parsed = JSON.parse(match[0]);
    return parsed;
  } catch (e) {
    throw {
      statusCode: 400,
      message: `Failed to parse Claude response as JSON: ${e.message}`,
    };
  }
}

/**
 * Validate and shape the parsed themes
 */
function shapeResult(parsed) {
  const generateId = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  if (!parsed.themes || !Array.isArray(parsed.themes)) {
    throw {
      statusCode: 400,
      message: "Invalid response format: missing 'themes' array",
    };
  }

  return (parsed.themes || [])
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

/**
 * CORS headers for same-origin requests
 */
function getCORSHeaders(req) {
  const origin = req.headers.origin;
  // VERCEL_URL is auto-set by Vercel to the deployment URL (no https://).
  // Also set NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app in the Vercel dashboard
  // to cover your custom/production domain.
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "http://localhost:3000",
    "http://localhost:3001",
  ].filter(Boolean);

  const isAllowed = !origin || allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin || "*" : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "3600",
  };
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  const corsHeaders = getCORSHeaders(req);

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      if (value) res.setHeader(key, value);
    });
    return res.end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed. Use POST." } });
    return;
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (value) res.setHeader(key, value);
  });
  res.setHeader("Content-Type", "application/json");

  try {
    // Check rate limit
    const ip = getClientIP(req);
    const rateLimitCheck = checkRateLimit(ip);

    if (!rateLimitCheck.allowed) {
      const resetTime = rateLimitCheck.resetTime;
      const msUntilReset = Math.max(0, resetTime - Date.now());
      const secondsUntilReset = Math.ceil(msUntilReset / 1000);

      return res.status(429).json({
        error: {
          message: "Daily request limit exceeded. Check back tomorrow at midnight UTC.",
          resetTime: new Date(resetTime).toISOString(),
          secondsUntilReset,
        },
      });
    }

    // Validate request body
    const { system, user } = req.body;

    if (!user || typeof user !== "string") {
      return res.status(400).json({
        error: { message: "Missing or invalid 'user' field in request body" },
      });
    }

    if (!system || typeof system !== "string") {
      return res.status(400).json({
        error: { message: "Missing or invalid 'system' field in request body" },
      });
    }

    // Call Claude API
    const claudeResponse = await callClaudeAPI(user, system);

    // Parse and validate response
    const parsed = parseClaudeResponse(claudeResponse);
    const shaped = shapeResult(parsed);

    return res.status(200).json({
      text: claudeResponse,
      themes: shaped,
    });
  } catch (error) {
    // Handle thrown errors with statusCode
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: { message: error.message },
      });
    }

    // Handle unknown errors
    console.error("Unexpected error in /api/analyze:", error);
    return res.status(500).json({
      error: {
        message: "Internal server error. Please try again later.",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
    });
  }
}

// Simple in-memory rate limiter
interface RateLimitStore {
  [key: string]: number[];
}

const store: RateLimitStore = {};
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 5; // 5 requests per window

/**
 * Check if a request from an IP exceeds rate limit
 * @param ip The IP address of the requester
 * @param maxRequests Maximum requests allowed (default: 5)
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(ip: string, maxRequests = MAX_REQUESTS): boolean {
  const now = Date.now();
  
  if (!store[ip]) {
    store[ip] = [];
  }
  
  // Remove old requests outside the window
  store[ip] = store[ip].filter(timestamp => now - timestamp < WINDOW_MS);
  
  // Check if limit exceeded
  if (store[ip].length >= maxRequests) {
    return false;
  }
  
  // Add current request
  store[ip].push(now);
  return true;
}

/**
 * Get remaining requests for an IP
 */
export function getRemainingRequests(ip: string, maxRequests = MAX_REQUESTS): number {
  const now = Date.now();
  
  if (!store[ip]) {
    return maxRequests;
  }
  
  const validRequests = store[ip].filter(timestamp => now - timestamp < WINDOW_MS);
  return Math.max(0, maxRequests - validRequests.length);
}

/**
 * Reset rate limit for an IP (admin function)
 */
export function resetRateLimit(ip: string): void {
  delete store[ip];
}

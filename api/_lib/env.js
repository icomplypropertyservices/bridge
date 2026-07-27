/** @deprecated use server/handlers.mjs — kept for any legacy imports */
export { sanitizeError, rewriteLogoHosts, UPSTREAM } from '../../server/handlers.mjs'

export function env(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim()
}

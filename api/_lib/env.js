export function env(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim()
}

export function sanitizeError(msg) {
  return String(msg)
    .replace(/https?:\/\/api\.xrpl\.to/gi, 'bridge-api')
    .replace(/\bxrpl\.to\b/gi, 'bridge')
}

export function rewriteLogoHosts(text) {
  return String(text).replace(/content-api\.bridge\.io/g, 'content-api.changenow.io')
}

export const UPSTREAM = 'https://api.xrpl.to/v1'
export const XUMM_API = 'https://xumm.app/api/v1/platform/payload'

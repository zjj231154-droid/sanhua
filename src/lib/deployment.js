export function isCloudDeployment(hostname = typeof window === 'undefined' ? '' : window.location.hostname) {
  const host = String(hostname || '').toLowerCase()
  return Boolean(host) && !['localhost', '127.0.0.1', '::1'].includes(host)
}
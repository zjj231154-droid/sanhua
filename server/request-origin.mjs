export const forwardedProtocol = headers => {
  const value = String(headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase()
  return ['http', 'https'].includes(value) ? value : 'http'
}

export const externalRequestUrl = (request, port = 3000) => `${forwardedProtocol(request.headers)}://${request.headers.host || `localhost:${port}`}${request.url}`

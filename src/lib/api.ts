const DEFAULT_API_BASE_URL = 'http://localhost:8000'
const ACCESS_TOKEN_STORAGE_KEY = 'aether_flow_access_token'

type ApiResponseType = 'json' | 'blob' | 'text' | 'void'

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  auth?: boolean
  body?: BodyInit | object | null
  responseType?: ApiResponseType
}

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || DEFAULT_API_BASE_URL

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
}

function isFormData(body: ApiRequestOptions['body']): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData
}

function buildBody(body: ApiRequestOptions['body']) {
  if (!body || isFormData(body) || body instanceof Blob || typeof body === 'string') {
    return body
  }

  return JSON.stringify(body)
}

async function parseErrorResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null)
  }

  return response.text().catch(() => null)
}

function getErrorMessage(details: unknown, fallback: string) {
  if (details && typeof details === 'object' && 'detail' in details) {
    const detail = (details as { detail?: unknown }).detail

    if (typeof detail === 'string') {
      return detail
    }
  }

  return fallback
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = false, body, headers, responseType = 'json', ...init } = options
  const requestHeaders = new Headers(headers)
  const requestBody = buildBody(body)

  if (body && !isFormData(body) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  if (auth) {
    const token = getAccessToken()

    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`)
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    body: requestBody,
    headers: requestHeaders,
  })

  if (!response.ok) {
    const details = await parseErrorResponse(response)
    const message = getErrorMessage(details, `API request failed with status ${response.status}`)

    throw new ApiError(message, response.status, details)
  }

  if (responseType === 'void' || response.status === 204) {
    return undefined as T
  }

  if (responseType === 'blob') {
    return response.blob() as Promise<T>
  }

  if (responseType === 'text') {
    return response.text() as Promise<T>
  }

  return response.json() as Promise<T>
}

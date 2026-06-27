import type { AppPage } from '../types'

const PAGE_TO_PATH: Record<AppPage, string> = {
  landing: '/',
  dashboard: '/dashboard',
  documents: '/documents',
  stats: '/stats',
  candidates: '/candidates',
  settings: '/settings',
  pricing: '/pricing',
  offer: '/offer',
  'admin-agencies': '/admin/agencies',
  'admin-invite-codes': '/admin/invite-codes',
  'admin-feature-requests': '/admin/feature-requests',
}

const PATH_TO_PAGE = Object.fromEntries(
  Object.entries(PAGE_TO_PATH).map(([page, path]) => [path, page]),
) as Record<string, AppPage>

function normalizePathname(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

export function pageToPath(page: AppPage) {
  return PAGE_TO_PATH[page]
}

export function pathToPage(pathname: string): AppPage | null {
  return PATH_TO_PAGE[normalizePathname(pathname)] ?? null
}

export function getInitialAppPage() {
  return pathToPage(window.location.pathname) ?? 'landing'
}

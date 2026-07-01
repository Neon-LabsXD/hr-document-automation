import {
  BarChart3,
  Building2,
  ChevronDown,
  CreditCard,
  FileText,
  Home,
  KeyRound,
  Lightbulb,
  LogOut,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { getPricingPlanById, resolvePricingPlanId } from '../data/pricingPlans'
import type { AppPage } from '../types'

interface NavigationItem {
  label: string
  page: AppPage
  icon: LucideIcon
}

interface SidebarProps {
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
}

const navigationItems: NavigationItem[] = [
  { label: 'Pulpit', page: 'dashboard', icon: Home },
  { label: 'Dokumenty', page: 'documents', icon: FileText },
  { label: 'Statystyki', page: 'stats', icon: BarChart3 },
  { label: 'Kandydaci', page: 'candidates', icon: Users },
  { label: 'Plany i cennik', page: 'pricing', icon: CreditCard },
  { label: 'Ustawienia agencji', page: 'settings', icon: Settings },
  { label: 'Zaproponuj funkcję', page: 'offer', icon: Lightbulb },
]

const superAdminNavigationItems: NavigationItem[] = [
  { label: 'Agencje', page: 'admin-agencies', icon: Building2 },
  { label: 'Generator kodów', page: 'admin-invite-codes', icon: KeyRound },
  { label: 'Sugerowane funkcje', page: 'admin-feature-requests', icon: Lightbulb },
]

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { currentUserEmail, logout, organizationProfile, role } = useAppContext()
  const visibleNavigationItems = role === 'super_admin' ? superAdminNavigationItems : navigationItems
  const companyName =
    role === 'super_admin'
      ? 'Aether Flow Admin'
      : organizationProfile?.name?.trim() || 'Twoja agencja'
  const companySubtitle =
    role === 'super_admin' ? 'SUPER ADMIN' : organizationProfile?.nip?.trim() || '—'
  const signatureLimit =
    organizationProfile?.signatures_limit ??
    getPricingPlanById(resolvePricingPlanId(organizationProfile?.subscription_plan)).signatureLimit
  const usedSignatures = organizationProfile?.signatures_used ?? 0
  const usagePercent = signatureLimit > 0 ? Math.min((usedSignatures / signatureLimit) * 100, 100) : 0
  const profileInitials = currentUserEmail
    ? currentUserEmail
        .split('@')[0]
        .slice(0, 2)
        .toUpperCase()
    : '—'
  const profileName = currentUserEmail?.split('@')[0] ?? 'Użytkownik'

  const handleLogout = () => {
    logout()
    onNavigate('landing')
  }

  return (
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => onNavigate('landing')}>
        <div className="brand-mark">
          <Sparkles />
        </div>
        <div>
          <p className="brand-title">Aether Flow</p>
          <p className="brand-subtitle">DOCUMENTS & HIRING</p>
        </div>
      </button>

      <button className="company-switcher" type="button">
        <span>
          <span className="company-name">{companyName}</span>
          <span className="company-nip">{companySubtitle}</span>
        </span>
        <ChevronDown />
      </button>

      <p className="nav-eyebrow">{role === 'super_admin' ? 'Panel właściciela' : 'Obszar roboczy'}</p>
      <nav className="nav-list">
        {visibleNavigationItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.page

          return (
            <button
              key={item.label}
              className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              type="button"
              onClick={() => onNavigate(item.page)}
            >
              <Icon />
              {item.label}
            </button>
          )
        })}
      </nav>

      <button className="sidebar-logout-button" type="button" onClick={handleLogout}>
        <LogOut />
        Wyloguj się
      </button>

      <div className="sidebar-footer">
        {role !== 'super_admin' && (
          <div className="usage-card">
            <div className="usage-row">
              <span>Zużycie</span>
              <span>
                {usedSignatures} / {signatureLimit} podpisów
              </span>
            </div>
            <div className="usage-track">
              <div className="usage-bar" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        )}

        <div className="profile-card">
          <div className="profile-avatar">{role === 'super_admin' ? 'SA' : profileInitials}</div>
          <div className="profile-copy">
            <p>{role === 'super_admin' ? 'Super Admin' : profileName}</p>
            <span>{currentUserEmail ?? 'Administrator'}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { AppProvider, useAppContext } from './context/AppContext'
import { getInitialAppPage, pageToPath, pathToPage } from './lib/appRoutes'
import { AdminAgencies } from './pages/AdminAgencies'
import { AdminFeatureRequests } from './pages/AdminFeatureRequests'
import { AdminInviteCodes } from './pages/AdminInviteCodes'
import { CandidateForm } from './pages/CandidateForm'
import { Candidates } from './pages/Candidates'
import { Dashboard } from './pages/Dashboard'
import { Documents } from './pages/Documents'
import { Landing } from './pages/Landing'
import { Offer } from './pages/Offer'
import { Pricing } from './pages/Pricing'
import { PublicOfferPage } from './pages/PublicOfferPage'
import { Settings } from './pages/Settings'
import { SignPage } from './pages/SignPage'
import { Stats } from './pages/Stats'
import type { AppPage } from './types'
import './App.css'

function renderPage(page: AppPage) {
  if (page === 'documents') {
    return <Documents />
  }

  if (page === 'stats') {
    return <Stats />
  }

  if (page === 'settings') {
    return <Settings />
  }

  if (page === 'pricing') {
    return <Pricing />
  }

  if (page === 'candidates') {
    return <Candidates />
  }

  if (page === 'offer') {
    return <Offer />
  }

  if (page === 'admin-agencies') {
    return <AdminAgencies />
  }

  if (page === 'admin-invite-codes') {
    return <AdminInviteCodes />
  }

  if (page === 'admin-feature-requests') {
    return <AdminFeatureRequests />
  }

  return <Dashboard />
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState<AppPage>(getInitialAppPage)
  const { role, authReady } = useAppContext()
  const isSignRoute = window.location.pathname === '/sign' || window.location.hash === '#sign'
  const isCandidateFormRoute =
    window.location.pathname.startsWith('/f/') || window.location.hash.startsWith('#/f/')

  const navigate = useCallback((page: AppPage) => {
    const path = pageToPath(page)

    if (window.location.pathname !== path) {
      window.history.pushState({ page }, '', path)
    }

    setCurrentPage(page)
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(pathToPage(window.location.pathname) ?? 'landing')
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  if (!authReady && !isSignRoute && !isCandidateFormRoute) {
    return null
  }

  if (isCandidateFormRoute) {
    return <CandidateForm />
  }

  if (isSignRoute) {
    return <SignPage />
  }

  if (currentPage === 'landing') {
    return <Landing onNavigate={navigate} />
  }

  if (currentPage === 'offer' && role === 'guest') {
    return <PublicOfferPage onNavigate={navigate} />
  }

  if (role === 'guest') {
    return <Landing onNavigate={navigate} />
  }

  return (
    <div className="admin-shell">
      <Sidebar currentPage={currentPage} onNavigate={navigate} />
      <main className="main-content">{renderPage(currentPage)}</main>
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default App

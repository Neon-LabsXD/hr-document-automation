import { useEffect, useState } from 'react'

const COOKIE_STORAGE_KEY = 'aether_flow_cookies'
const SHOW_DELAY_MS = 1500
const HIDE_ANIMATION_MS = 300

type CookieChoice = 'accepted' | 'declined'

export function CookieBanner() {
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const storedChoice = window.localStorage.getItem(COOKIE_STORAGE_KEY)

    if (storedChoice) {
      return
    }

    const showTimer = window.setTimeout(() => {
      setShouldRender(true)
      window.requestAnimationFrame(() => {
        setIsVisible(true)
      })
    }, SHOW_DELAY_MS)

    return () => {
      window.clearTimeout(showTimer)
    }
  }, [])

  const saveChoice = (choice: CookieChoice) => {
    window.localStorage.setItem(COOKIE_STORAGE_KEY, choice)
    setIsVisible(false)

    window.setTimeout(() => {
      setShouldRender(false)
    }, HIDE_ANIMATION_MS)
  }

  if (!shouldRender) {
    return null
  }

  return (
    <aside
      role="dialog"
      aria-live="polite"
      aria-label="Zgoda na pliki cookies"
      className={`fixed bottom-4 left-4 right-4 z-50 mx-auto w-full max-w-md rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-md transition-all duration-300 ease-out sm:left-auto sm:right-4 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <p className="text-sm font-medium leading-relaxed text-slate-600">
        Nasza strona używa plików cookies w celu zapewnienia prawidłowego działania serwisu,
        personalizacji treści oraz analizy ruchu. Możesz zaakceptować wszystkie pliki cookies lub
        odrzucić te, które nie są niezbędne.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={() => saveChoice('declined')}
        >
          Odrzuć
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-full bg-[#0d1d33] px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(13,29,51,0.18)] transition hover:-translate-y-0.5 hover:bg-[#132743]"
          onClick={() => saveChoice('accepted')}
        >
          Zaakceptuj
        </button>
      </div>
    </aside>
  )
}

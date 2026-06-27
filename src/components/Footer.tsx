import { useState } from 'react'
import { FileText, Mail, ShieldCheck, Sparkles, X } from 'lucide-react'
import { PrivacyPolicyContent } from './PrivacyPolicyContent'
import { RegulaminContent } from './RegulaminContent'

type FooterModalType = 'regulamin' | 'privacy' | null

const modalCopy: Record<Exclude<FooterModalType, null>, { title: string; kicker: string }> = {
  regulamin: {
    title: 'Regulamin platformy',
    kicker: 'Dokument prawny B2B',
  },
  privacy: {
    title: 'Polityka Prywatności (RODO)',
    kicker: 'Ochrona danych osobowych',
  },
}

export function Footer() {
  const [activeModal, setActiveModal] = useState<FooterModalType>(null)
  const modalContent = activeModal ? modalCopy[activeModal] : null

  return (
    <footer className="landing-footer">
      <div className="landing-footer-grid">
        <section className="footer-brand-column" aria-label="Aether Flow">
          <a className="footer-brand" href="#hero" aria-label="Aether Flow">
            <span>
              <Sparkles />
            </span>
            <div>
              <strong>Aether Flow</strong>
              <small>Aetherflow.pl</small>
            </div>
          </a>
          <p>Bezpieczna automatyzacja dokumentów HR i zaawansowany e-podpis dla agencji rekrutacyjnych.</p>
          <small className="footer-copyright">© 2026 Aether Flow. Wszelkie prawa zastrzeżone.</small>
        </section>

        <section className="footer-company-column" aria-labelledby="footer-company-title">
          <h2 id="footer-company-title">Dane rejestrowe</h2>
          <address>
            Aether Systems Sp. z o.o. (w organizacji)
            <br />
            ul. Marszałkowska 10/2, 00-001 Warszawa
            <br />
            NIP: [NIP_PLACEHOLDER] | REGON: [REGON_PLACEHOLDER]
            <br />
            KRS: [KRS_PLACEHOLDER]
            <br />
            Kapitał zakładowy: [KAPITAL_PLACEHOLDER] PLN
          </address>
        </section>

        <section className="footer-links-column" aria-labelledby="footer-links-title">
          <h2 id="footer-links-title">Linki</h2>
          <button type="button" onClick={() => setActiveModal('regulamin')}>
            <FileText />
            Regulamin platformy
          </button>
          <button type="button" onClick={() => setActiveModal('privacy')}>
            <ShieldCheck />
            Polityka Prywatności (RODO)
          </button>
          <a href="mailto:aetherflowbiznes@gmail.com">
            <Mail />
            Kontakt: aetherflowbiznes@gmail.com
          </a>
        </section>
      </div>

      {modalContent && (
        <div className="footer-modal-backdrop" role="presentation" onMouseDown={() => setActiveModal(null)}>
          <section
            className="footer-modal footer-modal-legal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="footer-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="footer-modal-close" type="button" aria-label="Zamknij okno" onClick={() => setActiveModal(null)}>
              <X />
            </button>
            <span className="footer-modal-kicker">{modalContent.kicker}</span>
            <h2 id="footer-modal-title">{modalContent.title}</h2>
            <div className="footer-modal-scroll">
              {activeModal === 'regulamin' ? <RegulaminContent /> : <PrivacyPolicyContent />}
            </div>
            <button className="footer-modal-action" type="button" onClick={() => setActiveModal(null)}>
              Zamknij
            </button>
          </section>
        </div>
      )}
    </footer>
  )
}

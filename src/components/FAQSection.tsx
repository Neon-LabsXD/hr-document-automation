import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

const faqItems: FAQItem[] = [
  {
    question: 'Czy e-podpis w Aether Flow jest prawnie wiążący w Polsce?',
    answer:
      'Tak. System generuje zaawansowany podpis elektroniczny zgodny z rozporządzeniem eIDAS oraz polskim Kodeksem Cywilnym. Każdy podpisany dokument posiada pełną ścieżkę audytu (IP, timestamp, weryfikacja OTP), co stanowi twardy dowód w celach dowodowych.',
  },
  {
    question: 'Jak system dba o bezpieczeństwo danych i RODO?',
    answer:
      'Bezpieczeństwo to nasz priorytet. Dane każdego agencji są całkowicie odizolowane na poziomie bazy danych (Supabase RLS). Wszystkie pliki umów są przechowywane w zaszyfrowanym, prywatnym magazynie w chmurze na terenie Unii Europejskiej, co zapewnia 100% zgodności z RODO.',
  },
  {
    question: 'Czy kandydaci muszą zakładać konto w systemie, aby podpisać umowę?',
    answer:
      'Absolutnie nie. Kandydat otrzymuje bezpieczny link za pośrednictwem wiadomości e-mail. Jedyne, co musi zrobić, to kliknąć w link, potwierdzić swoją tożsamość jednorazowym kodem OTP i złożyć podpis na ekranie swojego telefonu lub komputera. Cały proces zajmuje mniej niż minutę.',
  },
  {
    question: 'Czy mogę wgrać własne, niestandardowe szablony umów?',
    answer:
      'Tak, w wyższych pakietach możesz elastycznie zarządzać bazą własnych szablonów w formacie DOCX/PDF. Nasz system automatycznie podstawi dane kandydata, rekrutera oraz stawkę do umowy, eliminując potrzebę ręcznego edytowania dokumentów.',
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="faq-section">
      <div className="section-heading">
        <p className="eyebrow">FAQ</p>
        <h2>Najczęstsze pytania przed wdrożeniem e-podpisu w agencji.</h2>
      </div>

      <div className="faq-list">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index
          const answerId = `faq-answer-${index}`

          return (
            <article key={item.question} className={`faq-item ${isOpen ? 'faq-item-open' : ''}`}>
              <button
                aria-controls={answerId}
                aria-expanded={isOpen}
                className="faq-question"
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span>{item.question}</span>
                <ChevronDown />
              </button>
              <div className="faq-answer" id={answerId}>
                <p>{item.answer}</p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

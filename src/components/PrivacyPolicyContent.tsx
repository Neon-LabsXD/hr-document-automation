type PrivacyBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }

interface PrivacySection {
  id: string
  title: string
  blocks: PrivacyBlock[]
}

export const PRIVACY_VERSION = '1.0'
export const PRIVACY_EFFECTIVE_DATE = '27.06.2026'

const sections: PrivacySection[] = [
  {
    id: 'priv-1',
    title: '1. Administrator Danych',
    blocks: [
      {
        kind: 'paragraph',
        text:
          'Administratorem danych osobowych w rozumieniu art. 4 pkt 7 RODO jest Aether Systems Sp. z o.o. z siedzibą w Polsce, wpisana do Rejestru Przedsiębiorców Krajowego Rejestru Sądowego (KRS) pod numerem KRS: [KRS_PLACEHOLDER], NIP: [NIP_PLACEHOLDER], REGON: [REGON_PLACEHOLDER] („Administrator”).',
      },
      {
        kind: 'paragraph',
        text:
          'W odniesieniu do danych osobowych Kandydatów i innych osób wprowadzanych do Platformy przez Klienta (agencję), Administratorem tych danych pozostaje Klient, a Aether Systems Sp. z o.o. przetwarza je wyłącznie jako podmiot przetwarzający (procesor) na podstawie umowy powierzenia (art. 28 RODO).',
      },
    ],
  },
  {
    id: 'priv-2',
    title: '2. Cele przetwarzania',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Dane osobowe przetwarzane są w następujących celach:',
      },
      {
        kind: 'list',
        items: [
          'świadczenie usług drogą elektroniczną w modelu SaaS oraz zapewnienie funkcjonowania Platformy;',
          'zawarcie, wykonanie i rozliczenie umowy z Klientem, w tym obsługa konta i płatności;',
          'obsługa systemu uwierzytelniania i weryfikacji tożsamości za pomocą kodów jednorazowych (OTP);',
          'wysyłka powiadomień transakcyjnych e-mail oraz powiadomień SMS za pośrednictwem dostawcy SMSAPI;',
          'realizacja obowiązków prawnych (m.in. podatkowych i rachunkowych) ciążących na Administratorze;',
          'marketing własnych usług, kontakt biznesowy oraz ustalanie, dochodzenie i obrona roszczeń.',
        ],
      },
    ],
  },
  {
    id: 'priv-3',
    title: '3. Podstawa prawna',
    blocks: [
      {
        kind: 'list',
        items: [
          'Art. 6 ust. 1 lit. b RODO – przetwarzanie niezbędne do wykonania umowy lub do podjęcia działań przed jej zawarciem;',
          'Art. 6 ust. 1 lit. c RODO – wypełnienie obowiązków prawnych ciążących na Administratorze (np. wystawianie faktur);',
          'Art. 6 ust. 1 lit. f RODO – prawnie uzasadniony interes Administratora, w szczególności marketing własnych usług, kontakt biznesowy, zapewnienie bezpieczeństwa oraz dochodzenie roszczeń.',
        ],
      },
    ],
  },
  {
    id: 'priv-4',
    title: '4. Odbiorcy danych i podmioty przetwarzające',
    blocks: [
      {
        kind: 'paragraph',
        text:
          'Administrator korzysta ze starannie dobranych dostawców (podmiotów przetwarzających), działających na jego polecenie i na podstawie umów powierzenia:',
      },
      {
        kind: 'list',
        items: [
          'Supabase – dostawca infrastruktury bazodanowej i hostingu danych (serwery w Unii Europejskiej);',
          'Google (Gmail SMTP) – wysyłka wiadomości e-mail oraz kodów OTP;',
          'SMSAPI – wysyłka powiadomień SMS;',
          'dostawcy usług płatniczych oraz biuro rachunkowe – w zakresie rozliczeń i obowiązków księgowych.',
        ],
      },
    ],
  },
  {
    id: 'priv-5',
    title: '5. Bezpieczeństwo i izolacja danych',
    blocks: [
      {
        kind: 'paragraph',
        text:
          'Administrator stosuje środki techniczne i organizacyjne zapewniające ochronę danych odpowiednią do ryzyka (art. 32 RODO), w tym szyfrowanie transmisji, kontrolę dostępu i zasadę minimalizacji uprawnień.',
      },
      {
        kind: 'paragraph',
        text:
          'Dane Kandydatów przetwarzane w bazie Supabase są w pełni izolowane na poziomie organizacji (multi-tenant) przy użyciu mechanizmu Row Level Security (RLS). Dzięki temu żaden Klient nie ma dostępu do danych kandydatów ani dokumentów innego Klienta.',
      },
    ],
  },
  {
    id: 'priv-6',
    title: '6. Polityka Zero Retention (analiza AI)',
    blocks: [
      {
        kind: 'paragraph',
        text:
          'Zdjęcia, dokumenty tożsamości oraz inne dane wrażliwe przesyłane do analizy z wykorzystaniem mechanizmów AI (np. odczyt danych z dokumentu) nie są trwale przechowywane na dyskach serwerów backendu Administratora.',
      },
      {
        kind: 'list',
        items: [
          'pliki są przetwarzane wyłącznie w pamięci na czas niezbędny do wykonania operacji i usuwane natychmiast po jej zakończeniu;',
          'dane te nie są wykorzystywane do trenowania ani ulepszania modeli sztucznej inteligencji;',
          'w Platformie pozostają wyłącznie ustrukturyzowane dane wynikowe niezbędne do realizacji usługi, zgodnie z zasadą minimalizacji danych.',
        ],
      },
    ],
  },
  {
    id: 'priv-7',
    title: '7. Okres przechowywania danych',
    blocks: [
      {
        kind: 'list',
        items: [
          'dane związane z umową – przez czas jej trwania oraz po jej zakończeniu przez okres przedawnienia roszczeń;',
          'dane rozliczeniowe i księgowe – przez okres wymagany przepisami prawa (co do zasady 5 lat);',
          'dane przetwarzane na podstawie uzasadnionego interesu – do czasu skutecznego wniesienia sprzeciwu lub ustania celu przetwarzania.',
        ],
      },
    ],
  },
  {
    id: 'priv-8',
    title: '8. Prawa użytkowników',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Każdej osobie, której dane dotyczą, przysługują następujące prawa:',
      },
      {
        kind: 'list',
        items: [
          'prawo dostępu do swoich danych oraz uzyskania ich kopii;',
          'prawo do sprostowania (poprawiania) danych;',
          'prawo do usunięcia danych („prawo do bycia zapomnianym”);',
          'prawo do ograniczenia przetwarzania;',
          'prawo do przenoszenia danych;',
          'prawo do wniesienia sprzeciwu wobec przetwarzania opartego na uzasadnionym interesie;',
          'prawo do wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (PUODO).',
        ],
      },
      {
        kind: 'paragraph',
        text:
          'W przypadku danych Kandydatów wprowadzonych przez Klienta, żądania dotyczące realizacji tych praw należy kierować do Klienta jako administratora tych danych; Administrator wspiera Klienta w ich realizacji jako podmiot przetwarzający.',
      },
    ],
  },
  {
    id: 'priv-9',
    title: '9. Przekazywanie danych poza EOG',
    blocks: [
      {
        kind: 'paragraph',
        text:
          'Dane przetwarzane są co do zasady na terenie Europejskiego Obszaru Gospodarczego. Jeżeli przekazanie danych poza EOG okaże się konieczne, nastąpi wyłącznie przy zastosowaniu odpowiednich zabezpieczeń wymaganych przez RODO, w szczególności standardowych klauzul umownych (SCC).',
      },
    ],
  },
  {
    id: 'priv-10',
    title: '10. Kontakt z Administratorem',
    blocks: [
      {
        kind: 'paragraph',
        text:
          'We wszelkich sprawach dotyczących ochrony danych osobowych oraz realizacji powyższych praw można kontaktować się z Administratorem pod dedykowanym adresem e-mail: privacy@aetherflow.pl (lub: aetherflowbiznes@gmail.com).',
      },
    ],
  },
]

export function PrivacyPolicyContent() {
  return (
    <article className="legal-doc">
      <header className="legal-doc-head">
        <h3>Polityka Prywatności i ochrony danych osobowych (RODO) – Aether Flow</h3>
        <p className="legal-doc-meta">
          Wersja {PRIVACY_VERSION} · obowiązuje od {PRIVACY_EFFECTIVE_DATE} · zgodna z RODO
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.id} className="legal-doc-section">
          <h4>{section.title}</h4>
          {section.blocks.map((block, index) =>
            block.kind === 'paragraph' ? (
              <p key={index}>{block.text}</p>
            ) : (
              <ol key={index} className="legal-doc-list">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ol>
            ),
          )}
        </section>
      ))}
    </article>
  )
}

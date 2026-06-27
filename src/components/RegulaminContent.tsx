type RegulaminBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }

interface RegulaminSection {
  id: string
  title: string
  blocks: RegulaminBlock[]
}

export const REGULAMIN_VERSION = '1.0'
export const REGULAMIN_EFFECTIVE_DATE = '27.06.2026'

const sections: RegulaminSection[] = [
  {
    id: 'par-1',
    title: '§1. Definicje',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Użyte w Regulaminie pojęcia pisane wielką literą oznaczają:',
      },
      {
        kind: 'list',
        items: [
          'Usługodawca – Aether Systems Sp. z o.o. z siedzibą w Polsce, wpisana do Rejestru Przedsiębiorców Krajowego Rejestru Sądowego (KRS) prowadzonego przez Sąd Rejonowy, pod numerem KRS: [KRS_PLACEHOLDER], NIP: [NIP_PLACEHOLDER], REGON: [REGON_PLACEHOLDER], o kapitale zakładowym w wysokości [KAPITAL_PLACEHOLDER] PLN, e-mail: aetherflowbiznes@gmail.com.',
          'Usługobiorca (Klient) – przedsiębiorca w rozumieniu art. 43(1) Kodeksu cywilnego (osoba fizyczna prowadząca działalność gospodarczą, osoba prawna lub jednostka organizacyjna), zawierający Umowę bezpośrednio w związku z prowadzoną działalnością gospodarczą lub zawodową, dla którego Umowa ma charakter zawodowy.',
          'Platforma (Serwis) – oprogramowanie udostępniane przez Usługodawcę w modelu SaaS pod adresem aetherflow.pl, służące do automatyzacji dokumentów HR, wysyłki, śledzenia statusów oraz składania podpisu elektronicznego.',
          'Umowa – umowa o świadczenie usług drogą elektroniczną zawierana pomiędzy Usługodawcą a Klientem na warunkach niniejszego Regulaminu.',
          'Abonament – okresowa opłata uiszczana przez Klienta za dostęp do wybranego Planu w danym Okresie Rozliczeniowym.',
          'Okres Rozliczeniowy – okres jednego miesiąca, za który naliczany jest Abonament, o ile Strony nie ustaliły inaczej.',
          'Plan – wariant usługi (Start, Biznes, Pro) określający zakres funkcji oraz limit Podpisów.',
          'Użytkownik – osoba fizyczna upoważniona przez Klienta do korzystania z Platformy w imieniu Klienta.',
          'Kandydat – osoba, której dokument jest przekazywany do podpisu za pośrednictwem Platformy.',
          'Dane – wszelkie dane, w tym dane osobowe, wprowadzane do Platformy przez Klienta lub Użytkowników.',
          'Podpis elektroniczny – funkcja Platformy umożliwiająca złożenie podpisu elektronicznego wraz z weryfikacją OTP oraz utrwaleniem ścieżki audytu; nie stanowi kwalifikowanej usługi zaufania w rozumieniu rozporządzenia eIDAS.',
          'eIDAS – rozporządzenie Parlamentu Europejskiego i Rady (UE) nr 910/2014.',
          'RODO – rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679.',
          'Siła wyższa – zdarzenie zewnętrzne, niemożliwe do przewidzenia i zapobieżenia, niezależne od Stron.',
        ],
      },
    ],
  },
  {
    id: 'par-2',
    title: '§2. Postanowienia ogólne i charakter B2B',
    blocks: [
      {
        kind: 'list',
        items: [
          'Regulamin określa zasady świadczenia usług drogą elektroniczną przez Usługodawcę na rzecz Klientów oraz stanowi regulamin w rozumieniu art. 8 ustawy o świadczeniu usług drogą elektroniczną.',
          'Platforma jest przeznaczona wyłącznie dla przedsiębiorców (B2B). Usługi nie są kierowane do konsumentów w rozumieniu art. 22(1) Kodeksu cywilnego. Klient oświadcza, że zawiera Umowę bezpośrednio w związku ze swoją działalnością gospodarczą i że Umowa ma dla niego charakter zawodowy.',
          'Do Umowy nie stosuje się przepisów o ochronie konsumentów ani uprawnień konsumenckich, w tym prawa odstąpienia, a także – w zakresie dopuszczalnym prawem – przepisów art. 385(5) Kodeksu cywilnego.',
          'Strony wyłączają stosowanie art. 661 §1–3 Kodeksu cywilnego oraz obowiązek, o którym mowa w art. 12 ustawy o świadczeniu usług drogą elektroniczną, w zakresie, w jakim mają charakter dyspozytywny.',
          'Akceptacja Regulaminu jest warunkiem koniecznym założenia konta i korzystania z Platformy.',
        ],
      },
    ],
  },
  {
    id: 'par-3',
    title: '§3. Rodzaj i zakres usług',
    blocks: [
      {
        kind: 'list',
        items: [
          'Usługodawca udostępnia Platformę jako narzędzie informatyczne (SaaS) umożliwiające generowanie i wysyłkę dokumentów HR, śledzenie ich statusów, weryfikację tożsamości kodem jednorazowym (OTP) oraz złożenie podpisu elektronicznego wraz ze ścieżką audytu.',
          'Usługodawca świadczy wyłącznie usługi techniczne. Usługodawca nie świadczy usług prawnych, doradztwa kadrowego ani podatkowego i nie ponosi odpowiedzialności za treść, ważność, zgodność z prawem ani skutki dokumentów tworzonych, wysyłanych lub podpisywanych przez Klienta i Kandydatów.',
          'Usługodawca nie jest stroną stosunków prawnych (w tym umów) zawieranych pomiędzy Klientem a Kandydatami lub osobami trzecimi przy użyciu Platformy.',
          'Usługodawca nie jest kwalifikowanym dostawcą usług zaufania w rozumieniu eIDAS. Platforma wspiera składanie podpisu elektronicznego o skutkach co najmniej zwykłego podpisu elektronicznego i gromadzi dowody (OTP, znaczniki czasu, ścieżka audytu). Ocena skutków prawnych konkretnego podpisu w danym stosunku prawnym należy wyłącznie do Klienta.',
        ],
      },
    ],
  },
  {
    id: 'par-4',
    title: '§4. Warunki techniczne korzystania',
    blocks: [
      {
        kind: 'list',
        items: [
          'Do korzystania z Platformy niezbędne są: urządzenie z dostępem do Internetu, aktualna wersja przeglądarki internetowej, aktywne konto poczty elektronicznej oraz włączona obsługa plików cookies.',
          'Klient zapewnia infrastrukturę po swojej stronie. Usługodawca nie odpowiada za skutki niespełnienia wymagań technicznych ani za jakość łącza internetowego Klienta lub Kandydatów.',
          'Zakazane jest dostarczanie treści o charakterze bezprawnym oraz podejmowanie działań zakłócających działanie Platformy.',
        ],
      },
    ],
  },
  {
    id: 'par-5',
    title: '§5. Rejestracja i konto',
    blocks: [
      {
        kind: 'list',
        items: [
          'Dostęp do Platformy ma charakter zamknięty (invite-only) i wymaga ważnego kodu zaproszenia.',
          'Rejestracja wymaga podania prawdziwych i aktualnych danych oraz akceptacji Regulaminu. Klient ponosi odpowiedzialność za prawidłowość podanych danych.',
          'Klient odpowiada za zachowanie poufności danych dostępowych oraz za wszelkie działania Użytkowników korzystających z jego konta.',
          'Usługodawca może odmówić rejestracji, zawiesić lub zablokować konto w razie naruszenia Regulaminu, przepisów prawa lub braku płatności.',
        ],
      },
    ],
  },
  {
    id: 'par-6',
    title: '§6. Plany, Abonament i płatności',
    blocks: [
      {
        kind: 'list',
        items: [
          'Usługodawca oferuje Plany: Start (testowy, 0 PLN, do 20 podpisów/miesiąc), Biznes (199 PLN netto/miesiąc, do 200 podpisów/miesiąc) oraz Pro (499 PLN netto/miesiąc, do 800 podpisów/miesiąc). Wszystkie ceny są cenami netto i powiększane są o podatek VAT według obowiązującej stawki.',
          'Abonament płatny jest z góry za dany Okres Rozliczeniowy. Brak terminowej płatności uprawnia Usługodawcę do zawieszenia dostępu do Platformy.',
          'Przekroczenie limitu Podpisów w Planie może skutkować ograniczeniem funkcji lub koniecznością zmiany Planu.',
          'Wniesione opłaty za rozpoczęty Okres Rozliczeniowy nie podlegają zwrotowi, w tym za okres niewykorzystany w razie wcześniejszego rozwiązania Umowy, w zakresie dopuszczalnym prawem.',
          'Usługodawca wystawia faktury VAT w formie elektronicznej, na co Klient wyraża zgodę.',
        ],
      },
    ],
  },
  {
    id: 'par-7',
    title: '§7. Obowiązki Klienta',
    blocks: [
      {
        kind: 'list',
        items: [
          'Klient korzysta z Platformy zgodnie z prawem, Regulaminem oraz dobrymi obyczajami.',
          'Klient jest wyłącznie odpowiedzialny za treść, kompletność i legalność dokumentów oraz Danych wprowadzanych do Platformy, a także za uzyskanie wszelkich wymaganych zgód i podstaw prawnych przetwarzania danych Kandydatów.',
          'Klient jest administratorem danych osobowych Kandydatów i innych osób, których dane wprowadza do Platformy, w rozumieniu RODO. Usługodawca przetwarza te dane wyłącznie jako podmiot przetwarzający, na polecenie Klienta.',
          'Klient zwalnia Usługodawcę z odpowiedzialności i pokryje uzasadnione koszty (w tym roszczenia osób trzecich i kary administracyjne) wynikające z naruszenia przez Klienta prawa lub Regulaminu.',
        ],
      },
    ],
  },
  {
    id: 'par-8',
    title: '§8. Powierzenie przetwarzania danych osobowych',
    blocks: [
      {
        kind: 'list',
        items: [
          'W zakresie, w jakim Usługodawca przetwarza dane osobowe w imieniu Klienta, przetwarzanie odbywa się na podstawie umowy powierzenia przetwarzania (DPA) zgodnej z art. 28 RODO, stanowiącej integralną część Umowy.',
          'Usługodawca korzysta z podwykonawców (subprocesorów), w szczególności z dostawcy infrastruktury bazodanowej (Supabase, hosting w UE) oraz usługi poczty elektronicznej (Gmail/Google) do wysyłki wiadomości i kodów OTP. Klient wyraża na to ogólną zgodę.',
          'Dane są przetwarzane na infrastrukturze zlokalizowanej na terenie Unii Europejskiej, z dążeniem do lokalizacji w Polsce. Izolacja danych pomiędzy Klientami jest realizowana m.in. mechanizmem Supabase Row Level Security (RLS).',
          'Szczegółowe zasady przetwarzania danych osobowych określa Polityka Prywatności oraz DPA.',
        ],
      },
    ],
  },
  {
    id: 'par-9',
    title: '§9. Dostępność i utrzymanie',
    blocks: [
      {
        kind: 'list',
        items: [
          'Usługodawca dokłada starań, aby Platforma działała w sposób ciągły, jednak nie gwarantuje nieprzerwanej ani bezbłędnej dostępności. Platforma udostępniana jest w stanie „takim, jaki jest” (as is).',
          'Usługodawca jest uprawniony do przerw technicznych, prac konserwacyjnych i aktualizacji, które mogą czasowo ograniczać dostęp do Platformy.',
          'Usługodawca nie odpowiada za niedostępność lub nieprawidłowe działanie Platformy wynikające z przyczyn leżących po stronie dostawców zewnętrznych (m.in. Supabase, Google), operatorów telekomunikacyjnych, dostawców płatności lub Siły wyższej.',
        ],
      },
    ],
  },
  {
    id: 'par-10',
    title: '§10. Ograniczenie i wyłączenie odpowiedzialności',
    blocks: [
      {
        kind: 'paragraph',
        text:
          'Postanowienia niniejszego paragrafu stosuje się w najszerszym zakresie dopuszczalnym przez bezwzględnie obowiązujące przepisy prawa. Z uwagi na charakter B2B Umowy Strony zgodnie ograniczają odpowiedzialność Usługodawcy w sposób następujący:',
      },
      {
        kind: 'list',
        items: [
          'Całkowita łączna odpowiedzialność Usługodawcy wobec Klienta z tytułu Umowy oraz w związku z korzystaniem z Platformy – niezależnie od podstawy prawnej (kontraktowa, deliktowa, bezpodstawne wzbogacenie lub inna) i liczby zdarzeń – jest ograniczona do kwoty równej jednomiesięcznemu Abonamentowi netto faktycznie zapłaconemu przez Klienta za Plan w Okresie Rozliczeniowym, w którym wystąpiło zdarzenie wywołujące szkodę.',
          'Usługodawca nie ponosi odpowiedzialności za utracone korzyści (lucrum cessans), w tym za utratę spodziewanych przychodów, zysków, kontraktów, klientów, renomy ani za szkody pośrednie, następcze lub niematerialne.',
          'Usługodawca nie ponosi odpowiedzialności za utratę, uszkodzenie lub niedostępność Danych, za skuteczność prawną lub ważność dokumentów i podpisów składanych za pośrednictwem Platformy, ani za działania lub zaniechania Klienta, Użytkowników, Kandydatów i osób trzecich.',
          'Usługodawca nie ponosi odpowiedzialności za szkody wynikłe z działania dostawców zewnętrznych (m.in. Supabase, Google/Gmail SMTP, operatorów płatności i telekomunikacyjnych) oraz ze zdarzeń Siły wyższej.',
          'W zakresie dopuszczalnym przez prawo Strony wyłączają rękojmię (art. 558 §1 Kodeksu cywilnego) oraz odpowiedzialność Usługodawcy z tytułu gwarancji jakości.',
          'Roszczenia Klienta wobec Usługodawcy przedawniają się, a w każdym razie wygasają, jeżeli nie zostaną zgłoszone na piśmie lub e-mailem w terminie 30 dni od dnia zdarzenia będącego ich podstawą.',
        ],
      },
      {
        kind: 'paragraph',
        text:
          'Ograniczenia odpowiedzialności określone powyżej nie wyłączają ani nie ograniczają odpowiedzialności Usługodawcy za szkodę wyrządzoną umyślnie (art. 473 §2 Kodeksu cywilnego) oraz w innym zakresie, w jakim wyłączenie lub ograniczenie odpowiedzialności jest niedopuszczalne na mocy bezwzględnie obowiązujących przepisów prawa.',
      },
    ],
  },
  {
    id: 'par-11',
    title: '§11. Reklamacje',
    blocks: [
      {
        kind: 'list',
        items: [
          'Reklamacje dotyczące działania Platformy Klient zgłasza na adres e-mail: aetherflowbiznes@gmail.com, wskazując dane Klienta oraz opis nieprawidłowości.',
          'Usługodawca rozpatruje reklamację w terminie 30 dni od jej otrzymania, przesyłając odpowiedź na adres e-mail Klienta.',
          'Tryb reklamacyjny nie rozszerza odpowiedzialności Usługodawcy ponad granice określone w §10.',
        ],
      },
    ],
  },
  {
    id: 'par-12',
    title: '§12. Czas trwania i rozwiązanie Umowy',
    blocks: [
      {
        kind: 'list',
        items: [
          'Umowa zawierana jest na czas nieoznaczony i może być wypowiedziana przez każdą ze Stron ze skutkiem na koniec opłaconego Okresu Rozliczeniowego.',
          'Usługodawca może rozwiązać Umowę ze skutkiem natychmiastowym w razie istotnego naruszenia Regulaminu przez Klienta, zalegania z płatnością lub korzystania z Platformy w sposób bezprawny.',
          'Po rozwiązaniu Umowy Usługodawca może usunąć Dane Klienta po upływie 30 dni, o ile przepisy prawa nie stanowią inaczej. Eksport Danych jest możliwy przed rozwiązaniem Umowy.',
        ],
      },
    ],
  },
  {
    id: 'par-13',
    title: '§13. Własność intelektualna i poufność',
    blocks: [
      {
        kind: 'list',
        items: [
          'Wszelkie prawa do Platformy, jej kodu, interfejsu i marki przysługują Usługodawcy. Klient otrzymuje niewyłączną, nieprzenoszalną licencję na korzystanie z Platformy w okresie obowiązywania Umowy.',
          'Strony zobowiązują się do zachowania w poufności informacji uzyskanych w związku z Umową, z wyłączeniem informacji publicznie dostępnych lub których ujawnienie wymagane jest przez prawo.',
        ],
      },
    ],
  },
  {
    id: 'par-14',
    title: '§14. Zmiany Regulaminu',
    blocks: [
      {
        kind: 'list',
        items: [
          'Usługodawca może zmienić Regulamin z ważnych przyczyn (zmiana przepisów, zakresu usług, względów technicznych lub bezpieczeństwa), informując Klienta na adres e-mail lub w Platformie z wyprzedzeniem co najmniej 14 dni.',
          'Korzystanie z Platformy po wejściu zmian w życie oznacza ich akceptację. Brak akceptacji uprawnia Klienta do wypowiedzenia Umowy przed wejściem zmian w życie.',
        ],
      },
    ],
  },
  {
    id: 'par-15',
    title: '§15. Postanowienia końcowe',
    blocks: [
      {
        kind: 'list',
        items: [
          'Umowa podlega prawu polskiemu. W sprawach nieuregulowanych stosuje się przepisy prawa polskiego.',
          'Sądem właściwym do rozstrzygania sporów jest sąd powszechny właściwy miejscowo dla siedziby Usługodawcy.',
          'Klient nie może przenieść praw i obowiązków z Umowy na osobę trzecią bez uprzedniej pisemnej zgody Usługodawcy.',
          'Jeżeli którekolwiek postanowienie Regulaminu okaże się nieważne lub bezskuteczne, pozostałe postanowienia zachowują moc, a w miejsce postanowienia nieważnego stosuje się postanowienie najbliższe jego celowi gospodarczemu.',
          'Wiążąca jest polska wersja językowa Regulaminu.',
        ],
      },
    ],
  },
]

export function RegulaminContent() {
  return (
    <article className="legal-doc">
      <header className="legal-doc-head">
        <h3>Regulamin świadczenia usług drogą elektroniczną platformy Aether Flow</h3>
        <p className="legal-doc-meta">
          Wersja {REGULAMIN_VERSION} · obowiązuje od {REGULAMIN_EFFECTIVE_DATE} · Regulamin B2B
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

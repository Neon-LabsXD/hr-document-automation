import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { CheckCircle2, FileSignature, ShieldCheck } from 'lucide-react'

type SignPhase = 'otp' | 'document' | 'success'

const legalParagraphs = [
  'Niniejsza umowa określa zasady współpracy pomiędzy TalentBridge Sp. z o.o. a Kandydatem w zakresie realizacji usług doradczych, operacyjnych oraz wsparcia procesów rekrutacyjnych. Strony zgodnie oświadczają, że dokument został udostępniony w formie elektronicznej, a jego akceptacja następuje poprzez złożenie podpisu cyfrowego.',
  'Kandydat potwierdza, że zapoznał się z treścią umowy, zakresem obowiązków, zasadami poufności oraz warunkami przetwarzania danych osobowych. Wszelkie informacje przekazane w toku współpracy stanowią tajemnicę przedsiębiorstwa i nie mogą być ujawniane osobom trzecim bez uprzedniej zgody drugiej strony.',
  'Strony ustalają, że komunikacja dotycząca realizacji niniejszej umowy będzie prowadzona drogą elektroniczną. Każde potwierdzenie operacji, w tym kod OTP, znacznik czasu oraz adres e-mail kandydata, zostanie zapisane w ścieżce audytu w celu zapewnienia integralności procesu podpisu.',
  'Podpis złożony w polu podpisu poniżej stanowi jednoznaczne potwierdzenie woli zawarcia umowy i jest powiązany z niniejszym dokumentem. Po zakończeniu procesu system wygeneruje kopię dokumentu oraz certyfikat audytu, które zostaną przesłane na adres e-mail wskazany podczas procesu weryfikacji.',
]

export function SignPage() {
  const [phase, setPhase] = useState<SignPhase>('otp')
  const [otpDigits, setOtpDigits] = useState(['', '', '', ''])
  const [hasSignature, setHasSignature] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (phase !== 'document') {
      return
    }

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context) {
      return
    }

    const resizeCanvas = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const scale = window.devicePixelRatio || 1
      canvas.width = width * scale
      canvas.height = height * scale
      context.setTransform(scale, 0, 0, scale, 0, 0)
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.lineWidth = 2.4
      context.strokeStyle = '#0d1d33'
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [phase])

  const updateOtpDigit = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.replace(/\D/g, '').slice(-1)
    const nextDigits = [...otpDigits]
    nextDigits[index] = nextValue
    setOtpDigits(nextDigits)

    if (nextValue && index < otpDigits.length - 1) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const confirmOtp = () => {
    if (otpDigits.every(Boolean)) {
      setPhase('document')
    }
  }

  const getCanvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return { x: 0, y: 0 }
    }

    const rect = canvas.getBoundingClientRect()

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const startSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context) {
      return
    }

    const point = getCanvasPoint(event)
    canvas.setPointerCapture(event.pointerId)
    context.beginPath()
    context.moveTo(point.x, point.y)
    setIsDrawing(true)
  }

  const drawSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return
    }

    const context = canvasRef.current?.getContext('2d')

    if (!context) {
      return
    }

    const point = getCanvasPoint(event)
    context.lineTo(point.x, point.y)
    context.stroke()
    setHasSignature(true)
  }

  const stopSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId)
    }

    setIsDrawing(false)
  }

  return (
    <main className={`sign-page sign-page-${phase}`}>
      <div className="sign-brand">
        <span>
          <FileSignature />
        </span>
        <strong>Aether Flow</strong>
      </div>

      {phase === 'otp' && (
        <section className="sign-card sign-otp-card">
          <div className="sign-icon">
            <ShieldCheck />
          </div>
          <h1>Weryfikacja tożsamości</h1>
          <p>Wprowadź jednorazowy kod OTP wysłany na Twój e-mail, aby uzyskać dostęp do dokumentu.</p>

          <div className="otp-grid" aria-label="Kod OTP">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  otpInputRefs.current[index] = element
                }}
                inputMode="numeric"
                maxLength={1}
                value={digit}
                aria-label={`Cyfra ${index + 1} kodu OTP`}
                onChange={(event) => updateOtpDigit(index, event)}
              />
            ))}
          </div>

          <button className="sign-primary-button" type="button" disabled={!otpDigits.every(Boolean)} onClick={confirmOtp}>
            Potwierdź kod
          </button>
        </section>
      )}

      {phase === 'document' && (
        <section className="sign-document-shell">
          <header className="sign-document-header">
            <div>
              <span>Dokument do podpisu</span>
              <h1>Umowa B2B - TalentBridge Sp. z o.o.</h1>
            </div>
            <strong>Oczekuje na Twój podpis</strong>
          </header>

          <article className="sign-document-card">
            <div className="document-paper">
              <h2>Umowa o współpracy B2B</h2>
              <p className="document-meta">Warszawa, 13 czerwca 2026 r.</p>
              {legalParagraphs.map((paragraph, index) => (
                <p key={paragraph}>
                  <strong>§ {index + 1}.</strong> {paragraph}
                </p>
              ))}
              <p>
                <strong>§ 5.</strong> Pozostałe postanowienia mają charakter standardowy i obejmują zasady
                odpowiedzialności, rozwiązywania sporów oraz właściwość prawa polskiego. Dokument został przygotowany do
                bezpiecznego podpisu elektronicznego w systemie Aether Flow.
              </p>
            </div>

            <div className="signature-panel">
              <div>
                <strong>Złóż podpis tutaj</strong>
                <span>użyj myszki lub palca na ekranie</span>
              </div>
              <canvas
                ref={canvasRef}
                className={hasSignature ? 'signature-canvas signature-canvas-filled' : 'signature-canvas'}
                onPointerDown={startSignature}
                onPointerMove={drawSignature}
                onPointerUp={stopSignature}
                onPointerCancel={stopSignature}
              />
            </div>
          </article>

          <button
            className="sign-primary-button sign-submit-button"
            type="button"
            disabled={!hasSignature}
            onClick={() => setPhase('success')}
          >
            Podpisz dokument
          </button>
        </section>
      )}

      {phase === 'success' && (
        <section className="sign-card sign-success-card">
          <div className="sign-success-icon">
            <CheckCircle2 />
          </div>
          <h1>Dokument został pomyślnie podpisany!</h1>
          <p>
            Kopia umowy oraz certyfikat audytu zostały wysłane na Twój adres e-mail. Możesz zamknąć to okno.
          </p>
        </section>
      )}
    </main>
  )
}

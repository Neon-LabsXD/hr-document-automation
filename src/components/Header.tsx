import { useState } from 'react'
import { Upload } from 'lucide-react'
import { CreateDocumentModal } from './CreateDocumentModal'
import { useAppContext } from '../context/AppContext'
import { Button } from './UI/Button'

interface HeaderProps {
  title: string
  subtitle: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { role } = useAppContext()
  const [createDocumentOpen, setCreateDocumentOpen] = useState(false)

  return (
    <header className="topbar">
      <div>
        <p className="welcome-kicker">Witaj ponownie</p>
        <h1>{title}</h1>
        <p className="welcome-copy">{subtitle}</p>
      </div>

      {role !== 'super_admin' && (
        <>
          <Button className="primary-action" onClick={() => setCreateDocumentOpen(true)}>
            <Upload />
            Utwórz dokument
          </Button>
          <CreateDocumentModal isOpen={createDocumentOpen} onClose={() => setCreateDocumentOpen(false)} />
        </>
      )}
    </header>
  )
}

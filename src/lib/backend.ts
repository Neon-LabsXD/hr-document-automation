import { apiRequest } from './api'

export interface TemplateUploadResponse {
  status: string
  path: string
  filename: string
}

export interface SendDocumentInvitePayload {
  template_id: number
  candidate_email: string
  candidate_name: string
}

export interface SendDocumentInviteResponse {
  status: string
  document_id: string
  docuseal_id: number | string
}

export interface PassportScanResponse {
  employee_name?: string | null
  employee_passport?: string | null
  employee_address?: string | null
  pesel?: string | null
}

export function uploadTemplate(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return apiRequest<TemplateUploadResponse>('/api/v1/templates/upload', {
    method: 'POST',
    auth: true,
    body: formData,
  })
}

export function sendDocumentInvite(payload: SendDocumentInvitePayload) {
  return apiRequest<SendDocumentInviteResponse>('/api/v1/documents/send', {
    method: 'POST',
    auth: true,
    body: payload,
  })
}

export function scanPassport(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return apiRequest<PassportScanResponse>('/api/v1/ocr/scan-passport', {
    method: 'POST',
    auth: true,
    body: formData,
  })
}

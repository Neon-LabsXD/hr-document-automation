import { apiRequest } from './api'
import type { BackendCandidate } from '../utils/candidateMapper'

export interface TemplateUploadResponse {
  status: string
  path: string
  filename: string
  docuseal_template_id?: number
  builder_token?: string | null
  builder_host?: string | null
}

export interface AgencyTemplate {
  id: number
  name: string
  filename: string
  path: string
  size: number | null
  updated_at: string | null
  docuseal_template_id?: number | null
  is_default_send?: boolean
}

export interface TemplateBuilderTokenResponse {
  builder_token: string
  builder_host?: string | null
}

type RawAgencyTemplate = Partial<AgencyTemplate> & {
  filename?: string
  name?: string
  docuseal_template_id?: number | null
  is_default_send?: boolean
}

export interface TemplateListResponse {
  templates: AgencyTemplate[]
  max_templates?: number
  default_template_id?: number | null
}

export const MAX_AGENCY_TEMPLATES = 10

function normalizeAgencyTemplates(templates: RawAgencyTemplate[]): AgencyTemplate[] {
  return templates
    .map((template, index) => {
      const filename = (template.filename || template.name || '').trim()

      if (!filename) {
        return null
      }

      const id = typeof template.id === 'number' && template.id > 0 ? template.id : index + 1

      return {
        id,
        name: (template.name || template.filename || filename).trim(),
        filename,
        path: template.path || '',
        size: template.size ?? null,
        updated_at: template.updated_at ?? null,
        docuseal_template_id:
          typeof template.docuseal_template_id === 'number' ? template.docuseal_template_id : null,
        is_default_send: Boolean(template.is_default_send),
      }
    })
    .filter((template): template is AgencyTemplate => template !== null)
}

export interface CreateCandidateInvitationPayload {
  template_id: number
  candidate_email: string
  candidate_name: string
  phone: string
  require_id_scan: boolean
  require_student_status: boolean
}

export interface CreateCandidateInvitationResponse {
  id: string
  slug: string
  status: string
  url: string
}

export interface CandidateFormSubmitPayload {
  first_name: string
  last_name: string
  email: string
  phone: string
  pesel: string
  birth_date: string
  street: string
  house_number: string
  postal_code: string
  city: string
  verification_token: string
}

export interface CandidateFormSubmitResponse {
  status: string
  candidate_id: string
  document_id: string
  docuseal_id: string
}

export interface RequestCandidateOtpResponse {
  status: string
  expires_in_seconds: number
}

export interface VerifyCandidateOtpResponse {
  status: string
  verification_token: string
  expires_in_seconds: number
}

export interface PassportScanResponse {
  employee_name?: string | null
  employee_passport?: string | null
  employee_address?: string | null
  pesel?: string | null
}

export interface OrganizationProfile {
  name: string
  nip: string
  address: string
  phone: string
  subscription_plan?: string
  signatures_limit?: number
}

export interface OrganizationSubscription {
  plan_id: string
  plan_name: string
  signatures_limit: number
}

export function getOrganizationProfile() {
  return apiRequest<OrganizationProfile>('/api/v1/organization/profile', {
    auth: true,
  })
}

export function updateOrganizationProfile(payload: OrganizationProfile) {
  return apiRequest<OrganizationProfile>('/api/v1/organization/profile', {
    method: 'PATCH',
    auth: true,
    body: payload,
  })
}

export function getOrganizationSubscription() {
  return apiRequest<OrganizationSubscription>('/api/v1/organization/subscription', {
    auth: true,
  })
}

export function updateOrganizationSubscription(planId: string) {
  return apiRequest<OrganizationSubscription>('/api/v1/organization/subscription', {
    method: 'PATCH',
    auth: true,
    body: {
      plan_id: planId,
    },
  })
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

export function getTemplateBuilderToken(docusealTemplateId: number, templateName?: string) {
  return apiRequest<TemplateBuilderTokenResponse>('/api/v1/templates/builder-token', {
    method: 'POST',
    auth: true,
    body: {
      docuseal_template_id: docusealTemplateId,
      template_name: templateName,
    },
  })
}

export async function listTemplates() {
  const response = await apiRequest<{
    templates: RawAgencyTemplate[]
    max_templates?: number
    default_template_id?: number | null
  }>('/api/v1/templates/list', {
    auth: true,
  })

  const templates = normalizeAgencyTemplates(response.templates ?? [])
  const defaultTemplateId =
    typeof response.default_template_id === 'number'
      ? response.default_template_id
      : templates.find((template) => template.is_default_send)?.id ?? templates[0]?.id ?? null

  return {
    templates,
    maxTemplates: response.max_templates ?? MAX_AGENCY_TEMPLATES,
    defaultTemplateId,
  } satisfies TemplateListResponse & { maxTemplates: number; defaultTemplateId: number | null }
}

export function setDefaultSendTemplate(templateId: number) {
  return apiRequest<{
    status: string
    default_template_id: number
    templates: RawAgencyTemplate[]
  }>('/api/v1/templates/default', {
    method: 'PATCH',
    auth: true,
    body: {
      template_id: templateId,
    },
  })
}

export function deleteTemplate(filename: string) {
  return apiRequest<{ status: string; filename: string }>(
    `/api/v1/templates/${encodeURIComponent(filename)}`,
    {
      method: 'DELETE',
      auth: true,
    },
  )
}

export interface CandidateListResponse {
  candidates: BackendCandidate[]
}

export interface DeleteCandidatesPayload {
  candidate_ids?: string[]
  delete_all?: boolean
}

export interface DeleteCandidatesResponse {
  status: string
  deleted_count: number
}

export function listCandidates() {
  return apiRequest<CandidateListResponse>('/api/v1/candidates', {
    auth: true,
  })
}

export function deleteCandidates(payload: DeleteCandidatesPayload) {
  return apiRequest<DeleteCandidatesResponse>('/api/v1/candidates/delete', {
    method: 'POST',
    auth: true,
    body: payload,
  })
}

export function deleteCandidate(candidateId: string) {
  return apiRequest<DeleteCandidatesResponse>(
    `/api/v1/candidates/${encodeURIComponent(candidateId)}`,
    {
      method: 'DELETE',
      auth: true,
    },
  )
}

export function createCandidateInvitation(payload: CreateCandidateInvitationPayload) {
  return apiRequest<CreateCandidateInvitationResponse>('/api/v1/candidates', {
    method: 'POST',
    auth: true,
    body: payload,
  })
}

export function submitCandidateForm(slug: string, payload: CandidateFormSubmitPayload) {
  return apiRequest<CandidateFormSubmitResponse>(`/api/v1/candidates/${encodeURIComponent(slug)}/submit`, {
    method: 'POST',
    body: payload,
  })
}

export function requestCandidateOtp(slug: string, phone: string) {
  return apiRequest<RequestCandidateOtpResponse>(
    `/api/v1/candidates/${encodeURIComponent(slug)}/request-otp`,
    {
      method: 'POST',
      body: { phone },
    },
  )
}

export function verifyCandidateOtp(slug: string, code: string) {
  return apiRequest<VerifyCandidateOtpResponse>(
    `/api/v1/candidates/${encodeURIComponent(slug)}/verify-otp`,
    {
      method: 'POST',
      body: { code },
    },
  )
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

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export async function downloadSignedCandidateDocument(candidateId: string, suggestedFilename?: string) {
  const blob = await apiRequest<Blob>(
    `/api/v1/candidates/${encodeURIComponent(candidateId)}/signed-document`,
    {
      auth: true,
      responseType: 'blob',
    },
  )

  const safeFilename = (suggestedFilename ?? `signed_${candidateId}`).replace(/[\\/:*?"<>|]+/g, '_')
  const filename = safeFilename.toLowerCase().endsWith('.pdf') ? safeFilename : `${safeFilename}.pdf`

  triggerBrowserDownload(blob, filename)
}

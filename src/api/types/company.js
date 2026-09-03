import { z } from 'zod'
import { CompanyCatalog } from '../../utils/companyCatalog.js'

export const companyFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'কোম্পানির নাম দিন')
    .max(255, 'নাম একটু ছোট করুন'),
  labour_transfer_allowed: z.boolean(),
})

export const toCompanyFormValues = (company) => ({
  name: company?.name ?? '',
  labour_transfer_allowed: Boolean(company?.labour_transfer_allowed),
})

export const toCompanyPayload = ({ name, labour_transfer_allowed }) => ({
  name: String(name ?? '').trim(),
  labour_transfer_allowed: Boolean(labour_transfer_allowed),
})

/** Company catalog groups from GET /company (`{ id, name, type }[]`). */
export const companyGroups = (company) => CompanyCatalog.groups(company)

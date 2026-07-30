import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { humanizeApiError } from '../api/errors.js'

const errorMessage = (error) => {
  if (!error) return ''
  if (typeof error === 'string') return error
  const messages = []
  if (Array.isArray(error.errors) && error.errors.length) {
    for (const item of error.errors) {
      const text = item.detail || humanizeApiError({ errors: [item], message: '' })
      if (text && !messages.includes(text)) messages.push(text)
    }
  }
  if (!messages.length) messages.push(humanizeApiError(error))
  return messages.join(' ')
}

export const ApiErrorAlert = ({ error }) => {
  const message = errorMessage(error)

  useEffect(() => {
    if (!message) return
    toast.error(message, { id: `api-error:${message}` })
  }, [message])

  return null
}

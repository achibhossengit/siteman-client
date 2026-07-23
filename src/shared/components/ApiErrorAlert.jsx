import { humanizeApiError } from '../../api/errors.js'

export const ApiErrorAlert = ({ error, className = '' }) => {
  if (!error) return null

  if (typeof error === 'string') {
    return (
      <div role="alert" className={`alert alert-error text-sm ${className}`}>
        <span>{error}</span>
      </div>
    )
  }

  const messages = []
  if (Array.isArray(error.errors) && error.errors.length) {
    for (const item of error.errors) {
      const text = item.detail || humanizeApiError({ errors: [item], message: '' })
      if (text && !messages.includes(text)) messages.push(text)
    }
  }
  if (!messages.length) messages.push(humanizeApiError(error))

  return (
    <div role="alert" className={`alert alert-error text-sm ${className}`}>
      {messages.length === 1 ? (
        <span>{messages[0]}</span>
      ) : (
        <ul className="list-disc list-inside text-left">
          {messages.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

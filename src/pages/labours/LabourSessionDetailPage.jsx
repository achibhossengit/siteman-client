import { useEffect } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'

/** Placeholder — session detail UI will be built later. */
export const LabourSessionDetailPage = () => {
  const { labourId, sessionId } = useParams()
  const { setTitle } = useOutletContext()
  const isRunning = sessionId === 'running'

  useEffect(() => {
    setTitle?.(isRunning ? 'চলমান সেশন' : 'সেশন বিবরণ')
    return () => setTitle?.('')
  }, [setTitle, isRunning])

  return (
    <div className="max-w-lg mx-auto py-10 text-center space-y-2">
      <p className="text-base-content/70 text-sm">সেশন বিবরণ শীঘ্রই আসছে।</p>
      <p className="text-xs text-base-content/50 tabular-nums">
        {isRunning
          ? `labour #${labourId} · running`
          : `labour #${labourId} · session #${sessionId}`}
      </p>
    </div>
  )
}

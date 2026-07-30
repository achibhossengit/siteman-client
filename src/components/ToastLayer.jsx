import { useEffect, useRef } from 'react'
import { Toaster, useToasterStore } from 'react-hot-toast'

// A <dialog> opened with showModal() renders in the browser top layer, above
// anything a z-index can reach. Hosting the toaster in a manual popover puts it
// in that same layer; re-showing it on every new toast moves it back to the end
// of the layer so it also clears dialogs opened after the app mounted.
const supportsPopover =
  typeof HTMLElement !== 'undefined' &&
  Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover')

const ToastLayer = () => {
  const layerRef = useRef(null)
  const { toasts } = useToasterStore()
  const visibleCount = toasts.filter((item) => item.visible).length

  useEffect(() => {
    const layer = layerRef.current
    if (!supportsPopover || !layer) return

    try {
      if (layer.matches(':popover-open')) layer.hidePopover()
      layer.showPopover()
    } catch {
      // Popover can be rejected while the element is detached; toasts still
      // render, just inside the normal stacking context.
    }
  }, [visibleCount])

  return (
    <div ref={layerRef} className="toast-layer" {...(supportsPopover ? { popover: 'manual' } : {})}>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'var(--color-base-100)',
            color: 'var(--color-base-content)',
            border: '1px solid var(--color-base-300)',
          },
        }}
      />
    </div>
  )
}

export default ToastLayer

/**
 * Centers the app in a Mobile-L (425px) column on large screens.
 * Side space uses a relevant background; fixed UI stays inside the frame.
 */
export const MobileAppShell = ({ children }) => (
  <div className="app-shell-viewport">
    <div className="app-shell-frame">{children}</div>
  </div>
)

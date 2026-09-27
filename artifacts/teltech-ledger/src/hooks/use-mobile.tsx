import * as React from "react"

const MOBILE_BREAKPOINT = 768

function checkIsMobile(): boolean {
  if (typeof window === "undefined") return false
  const isSmallWidth = window.innerWidth < MOBILE_BREAKPOINT
  const isLandscapePhone = 
    window.innerHeight <= 500 && 
    window.innerWidth <= 950 && 
    (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches)
  return isSmallWidth || isLandscapePhone
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(checkIsMobile)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(checkIsMobile())
    }

    mql.addEventListener("change", onChange)
    window.addEventListener("resize", onChange)
    window.addEventListener("orientationchange", onChange)
    setIsMobile(checkIsMobile())

    return () => {
      mql.removeEventListener("change", onChange)
      window.removeEventListener("resize", onChange)
      window.removeEventListener("orientationchange", onChange)
    }
  }, [])

  return isMobile
}


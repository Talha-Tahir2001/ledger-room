"use client"

/**
 * The only client island in either header.
 *
 * Everything above the fold renders without JavaScript (NFR-12), so the nav and
 * the logo are server-rendered links and this is the single thing that needs a
 * client boundary.
 */
import { IconMoon, IconSun } from "@tabler/icons-react"
import { useTheme } from "next-themes"
import * as React from "react"

import { Button } from "@/components/ui/button"

/**
 * "Has the client hydrated yet", without a setState-in-effect.
 *
 * The obvious `useEffect(() => setMounted(true), [])` renders twice on every
 * mount and trips the React compiler lint. `useSyncExternalStore` expresses the
 * same thing honestly: the server snapshot is false, the client's is true, and
 * there is no effect to cascade through.
 */
function useHydrated(): boolean {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

/**
 * Two states, as DESIGN.md §5 allows under time pressure.
 *
 * The `aria-label` names the action rather than the current state, so it stays
 * truthful after the first click. Before hydration the icon is fixed, because
 * server and client must render identical markup or React complains.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const hydrated = useHydrated()

  const isDark = hydrated && resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      {isDark ? <IconMoon aria-hidden /> : <IconSun aria-hidden />}
    </Button>
  )
}

export { ThemeToggle as LandingThemeToggle }
// The app only has one real theme (dark) — see `Colors` in constants/theme.ts. Native enforces
// this regardless of the device's system setting via `userInterfaceStyle: "dark"` in app.json,
// which has no web equivalent (there's no way to override a visitor's browser `prefers-color-scheme`
// at the manifest level), so it's hardcoded here to match native instead of following the browser.
export function useColorScheme() {
  return 'dark';
}

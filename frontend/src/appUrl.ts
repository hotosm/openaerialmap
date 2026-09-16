// In-app paths have to be resolved against Vite's base, or they point at the
// server root and 404 whenever the app is served from a subdirectory. BASE_URL
// is "/" in production, so this is a no-op there.
//
// Its own module rather than a second export from SiteHeader: react-refresh
// requires a file exporting a component to export nothing else.
export function appUrl(path: string): string {
  return `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

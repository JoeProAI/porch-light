import { UNREACHABLE_MESSAGE } from "@/lib/national-gaps";

export const CatalogFailure = ({ unreachable, message, onRetry, disabled }: {
  unreachable: boolean; message: string; onRetry: () => void; disabled?: boolean;
}) => <div className="watch-error" role="alert">
  <h2>{unreachable ? UNREACHABLE_MESSAGE : "National source catalog unavailable"}</h2>
  <p>{unreachable ? "No Manatee data was substituted." : message}</p>
  {unreachable && message && message !== UNREACHABLE_MESSAGE && <p>{message}</p>}
  <button type="button" onClick={onRetry} disabled={disabled}>Retry verified source catalog</button>
</div>;

export const BlockedCallSheet = ({ heading, detail }: { heading: string; detail: string }) =>
  <div className="app-shell national-controls">
    <header className="masthead">
      <a href="/" className="wordmark">Porch Light<span className="wordmark-period">.</span></a>
      <nav className="workspace-nav" aria-label="Workspace sections"><a href="/nationwide">Pick any US county</a><a className="nav-docs" href="https://joeproai.mintlify.app" target="_blank" rel="noreferrer">Docs</a></nav>
    </header>
    <main>
      <div className="watch-error" role="alert"><h1>{heading}</h1><p>{detail}</p></div>
    </main>
  </div>;

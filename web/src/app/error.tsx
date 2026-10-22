"use client";

export const ErrorPage = () => (
  <main className="system-state">
    <p className="wordmark">Porch Light</p>
    <span className="eyebrow">Snapshot unavailable</span>
    <h1>The ledger couldn&apos;t be verified.</h1>
    <p role="alert">No ranking is shown. The local snapshot may be missing, incomplete, or fail its provenance check. Check the snapshot and sidecar in web/data before retrying.</p>
    <button onClick={() => window.location.reload()}>Retry snapshot</button>
  </main>
);
export default ErrorPage;

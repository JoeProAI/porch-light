export const DOCS_URL = "https://joeproai.mintlify.app";

export const DocsLink = ({ className }: { className?: string }) => (
  <a className={className} href={DOCS_URL} target="_blank" rel="noreferrer">Docs</a>
);

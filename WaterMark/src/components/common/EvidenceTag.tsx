import { EVIDENCE_LABELS, type EvidenceKind } from '../../scripting/content/dataSources'

/** Colored pill naming the kind of evidence; colors come from --kind-* tokens. */
export function EvidenceTag({ kind }: { kind: EvidenceKind }) {
  return <span className={`evidence-tag evidence-tag--${kind}`}>{EVIDENCE_LABELS[kind]}</span>
}

export type SubjectLabelSource = { code?: string; name: string }

export function subjectDisplayLabel(subject: SubjectLabelSource | undefined): string {
  if (!subject) return 'Unknown subject'
  const code = subject.code?.trim() ?? ''
  const name = subject.name.trim()
  if (!code) return name
  if (name === code) return code
  if (name.startsWith(`${code} ·`)) return `${code} · ${name.slice(code.length).replace(/^\s*·\s*/, '')}`
  return `${code} · ${name}`
}

export type SubjectLabelSource = { code?: string; name: string }

export function subjectDisplayLabel(subject: SubjectLabelSource | undefined): string {
  if (!subject) return 'Unknown subject'
  const code = subject.code?.trim() ?? ''
  const name = subject.name.trim()
  if (!code) return name
  let cleanName = name
  while (cleanName.startsWith(`${code} ·`)) cleanName = cleanName.slice(code.length).replace(/^\s*·\s*/, '')
  if (!cleanName) return code
  return `${code} · ${cleanName}`
}

export function sessionCardContent(subject: string, time: string, type: string, metadata: string, height: number): string[] {
  if (height <= 34) return [subject]
  if (height <= 64) return [subject, time]
  if (height <= 96) return [subject, time, type]
  return [subject, time, type, metadata]
}

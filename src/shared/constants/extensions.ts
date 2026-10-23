export const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'
])

export const SUBTITLE_EXTENSIONS = new Set([
  '.srt', '.sub', '.ssa', '.ass', '.vtt', '.idx'
])

export const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.java', '.kt', '.kts',
  '.cs', '.fs',
  '.go', '.rs', '.rb',
  '.c', '.cpp', '.h', '.hpp',
  '.html', '.htm', '.css', '.scss', '.less', '.sass',
  '.vue', '.svelte', '.astro',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.sql', '.graphql', '.gql',
  '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
  '.dockerfile', '.env', '.gitignore',
  '.md', '.mdx', '.txt', '.csv', '.log'
])

export const DOCUMENT_EXTENSIONS = new Set([
  '.pdf'
])

export const ARCHIVE_EXTENSIONS = new Set([
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'
])

export const TEXT_READABLE_EXTENSIONS = new Set([
  ...CODE_EXTENSIONS,
  '.md', '.mdx', '.txt', '.csv', '.log', '.ini', '.cfg'
])

export function getAttachmentKind(ext: string): 'pdf' | 'code' | 'archive' | 'text' | 'other' {
  const lower = ext.toLowerCase()
  if (DOCUMENT_EXTENSIONS.has(lower)) return 'pdf'
  if (CODE_EXTENSIONS.has(lower)) return 'code'
  if (ARCHIVE_EXTENSIONS.has(lower)) return 'archive'
  if (TEXT_READABLE_EXTENSIONS.has(lower)) return 'text'
  return 'other'
}

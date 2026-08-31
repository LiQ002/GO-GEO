import { appendFile, mkdir, rename, rm, stat } from 'fs/promises'
import { join } from 'path'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const MAX_LOG_BYTES = 5 * 1024 * 1024
let logFilePath: string | null = null
let writeQueue = Promise.resolve()

function serializeDetail(detail: unknown) {
  try {
    if (detail instanceof Error) {
      return JSON.stringify({ name: detail.name, message: detail.message, stack: detail.stack })
    }
    return JSON.stringify(detail)
  } catch {
    return JSON.stringify({ serializationError: true })
  }
}

function formatMessage(level: LogLevel, scope: string, message: string, detail?: unknown) {
  const ts = new Date().toISOString()
  const prefix = '[' + ts + '] [' + level.toUpperCase() + '] [' + scope + ']'
  if (detail !== undefined) {
    return prefix + ' ' + message + ' ' + serializeDetail(detail)
  }
  return prefix + ' ' + message
}

function write(level: LogLevel, scope: string, message: string, detail?: unknown) {
  const line = formatMessage(level, scope, message, detail)
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }

  if (logFilePath) {
    writeQueue = writeQueue
      .then(() => appendFile(logFilePath!, line + '\n', 'utf8'))
      .catch((error) => console.error('Failed to write application log', error))
  }
}

export async function initializeFileLogging(logDirectory: string) {
  await mkdir(logDirectory, { recursive: true })
  const nextLogFilePath = join(logDirectory, 'main.log')
  const previousLogFilePath = join(logDirectory, 'main.previous.log')

  const currentSize = await stat(nextLogFilePath).then((value) => value.size).catch(() => 0)
  if (currentSize >= MAX_LOG_BYTES) {
    await rm(previousLogFilePath, { force: true })
    await rename(nextLogFilePath, previousLogFilePath)
  }

  logFilePath = nextLogFilePath
  return nextLogFilePath
}

export function flushFileLogs() {
  return writeQueue
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, detail?: unknown) => write('debug', scope, message, detail),
    info: (message: string, detail?: unknown) => write('info', scope, message, detail),
    warn: (message: string, detail?: unknown) => write('warn', scope, message, detail),
    error: (message: string, detail?: unknown) => write('error', scope, message, detail),
  }
}

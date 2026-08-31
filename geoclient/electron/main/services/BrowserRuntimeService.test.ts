import { describe, expect, it } from 'vitest'
import { isSupportedChromeExecutablePath } from './BrowserRuntimeService'

describe('isSupportedChromeExecutablePath', () => {
  it('accepts the Chrome executable on Windows', () => {
    expect(
      isSupportedChromeExecutablePath(
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'win32',
      ),
    ).toBe(true)
  })

  it('accepts common system Chrome executables on macOS and Linux', () => {
    expect(
      isSupportedChromeExecutablePath(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        'darwin',
      ),
    ).toBe(true)
    expect(isSupportedChromeExecutablePath('/usr/bin/google-chrome-stable', 'linux')).toBe(true)
  })

  it('rejects unrelated executables', () => {
    expect(isSupportedChromeExecutablePath('C:\\Windows\\System32\\cmd.exe', 'win32')).toBe(false)
  })
})

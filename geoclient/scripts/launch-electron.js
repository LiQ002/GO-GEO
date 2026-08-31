const { spawn } = require('child_process')

// 在子进程启动 Electron 前，移除父进程（Electron 环境）注入的变量，
// 否则 Electron 会把 require('electron') 当成普通 Node 模块处理，导致 app 为 undefined。
delete process.env.ELECTRON_RUN_AS_NODE

const electronBin = require('electron')
const args = process.argv.slice(2)

const child = spawn(electronBin, args, {
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

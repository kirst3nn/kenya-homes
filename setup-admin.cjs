const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const readline = require('node:readline/promises')
const { Writable } = require('node:stream')

// This file creates one private admin credential file, not a public registration page.
function createAdmin(dataFolder, username, password, confirmation) {
  const cleanUsername = username.trim()
  if (!/^[A-Za-z0-9_.-]{3,40}$/.test(cleanUsername)) {
    throw new Error('Use a username of 3–40 letters, numbers, dots, underscores or hyphens.')
  }
  if (password.length < 15 || password.length > 128) {
    throw new Error('Use a password or passphrase of 15–128 characters.')
  }
  if (password !== confirmation) throw new Error('The passwords did not match. Nothing was saved.')

  const salt = crypto.randomBytes(32).toString('hex')
  const parameters = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
  const hash = crypto.scryptSync(password, salt, 64, parameters).toString('hex')
  const record = {
    version: 1,
    username: cleanUsername,
    algorithm: 'scrypt',
    salt,
    hash,
    parameters: { N: parameters.N, r: parameters.r, p: parameters.p },
    createdAt: new Date().toISOString()
  }
  fs.mkdirSync(dataFolder, { recursive: true })
  const filename = path.join(dataFolder, 'admin.json')
  // 'wx' refuses to overwrite any existing account.
  fs.writeFileSync(filename, JSON.stringify(record, null, 2) + '\n', {
    flag: 'wx', mode: 0o600
  })
  return filename
}

async function askHidden(label) {
  // Readline handles typing and backspace, but its output is discarded so
  // neither the password nor a pasted password is echoed to the screen.
  const silentOutput = new Writable({ write(chunk, encoding, callback) { callback() } })
  const input = readline.createInterface({ input: process.stdin, output: silentOutput, terminal: true })
  process.stdout.write(label)
  try {
    return await input.question('')
  } finally {
    input.close()
    process.stdout.write('\n')
  }
}

async function main() {
  if (!process.stdin.isTTY) {
    throw new Error('Run this directly in your PowerShell terminal, without piping input.')
  }
  console.log('Create your local Kenya Homes admin account.')
  console.log('Nothing is uploaded. Password entry is hidden. Keep your password private.')
  const input = readline.createInterface({ input: process.stdin, output: process.stdout })
  let username
  try {
    username = await input.question('Choose an admin username: ')
  } finally {
    input.close()
  }
  const password = await askHidden('Choose a password (15–128 characters, hidden): ')
  const confirmation = await askHidden('Enter the same password again (hidden): ')
  const folder = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data')
  createAdmin(folder, username, password, confirmation)
  console.log('Admin credentials created in the private data folder.')
  console.log('Only a salted password hash was stored, not the password itself.')
  console.log('The website login page will be connected in the next step.')
}

module.exports = { createAdmin }
if (require.main === module) {
  main().catch(error => {
    if (error.code === 'EEXIST') {
      console.error('An admin account already exists. It was NOT overwritten.')
    } else {
      console.error(error.message)
    }
    process.exitCode = 1
  })
}

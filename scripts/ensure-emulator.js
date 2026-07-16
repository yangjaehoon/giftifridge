// Boots the Android emulator if it isn't already running, then waits for it
// to finish booting. Runs automatically before `npm run dev` (see predev in
// package.json) so a bare `npm run dev` is enough to get the app on screen.
const { execFileSync, spawn } = require('child_process');
const path = require('path');

const AVD_NAME = 'Pixel_8';
const BOOT_TIMEOUT_MS = 120000;
const POLL_INTERVAL_MS = 3000;

const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!androidHome) {
  console.error('ANDROID_HOME (or ANDROID_SDK_ROOT) is not set. Cannot locate the emulator.');
  process.exit(1);
}

const exe = process.platform === 'win32' ? '.exe' : '';
const adbPath = path.join(androidHome, 'platform-tools', `adb${exe}`);
const emulatorPath = path.join(androidHome, 'emulator', `emulator${exe}`);

function adb(args) {
  return execFileSync(adbPath, args, { encoding: 'utf8' });
}

function hasOnlineDevice() {
  const output = adb(['devices']);
  return output
    .split('\n')
    .slice(1)
    .some((line) => /\tdevice$/.test(line.trim()));
}

function isBootComplete() {
  try {
    return adb(['shell', 'getprop', 'sys.boot_completed']).trim() === '1';
  } catch {
    return false;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

if (hasOnlineDevice()) {
  console.log('Emulator already running.');
  process.exit(0);
}

console.log(`Booting emulator "${AVD_NAME}"...`);
const child = spawn(emulatorPath, ['-avd', AVD_NAME], { detached: true, stdio: 'ignore' });
child.unref();

const deadline = Date.now() + BOOT_TIMEOUT_MS;
while (Date.now() < deadline) {
  if (isBootComplete()) {
    console.log('Emulator ready.');
    process.exit(0);
  }
  sleep(POLL_INTERVAL_MS);
}

console.error(`Emulator did not finish booting within ${BOOT_TIMEOUT_MS / 1000}s.`);
process.exit(1);

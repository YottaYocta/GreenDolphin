import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, statSync, writeSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MINUTES = [10, 30, 60, 120];
const RATE = 48000;
const DIR = fileURLToPath(new URL("./recordings/", import.meta.url));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

const sweep = (hz, wobble) => `(0.6+0.3*sin(t/7))*0.5*sin(2*PI*${hz}*t+8000*sin(t/${wobble}))+0.04*(random(${wobble})-0.5)`;

function encodeMp3(path, seconds) {
  const source = `aevalsrc=${sweep(440, 10)}|${sweep(330, 13)}:s=${RATE}:d=${seconds}`;
  const { status } = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", source, "-c:a", "libmp3lame", "-b:a", "128k", path], { stdio: "inherit" });
  if (status !== 0) throw new Error(`ffmpeg failed for ${path}`);
}

function writeWav(path, seconds) {
  const frames = seconds * RATE;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + frames * 4, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(frames * 4, 40);
  const file = openSync(path, "w");
  writeSync(file, header);
  const second = Buffer.alloc(RATE * 4);
  for (let s = 0; s < seconds; s++) {
    for (let i = 0; i < RATE; i++) {
      const t = s + i / RATE;
      const level = (0.6 + 0.3 * Math.sin(t / 7)) * 0.5 * 32767;
      [440, 330].forEach((hz, c) => second.writeInt16LE(Math.round(level * Math.sin(2 * Math.PI * hz * t + 8000 * Math.sin(t / (10 + 3 * c))) + 1300 * (Math.random() - 0.5)), i * 4 + c * 2));
    }
    writeSync(file, second);
  }
  closeSync(file);
}

mkdirSync(DIR, { recursive: true });
console.log(hasFfmpeg ? "ffmpeg found: encoding 128 kbps stereo MP3" : "ffmpeg missing: writing 16-bit stereo WAV");
for (const minutes of MINUTES) {
  const path = `${DIR}${minutes}min.${hasFfmpeg ? "mp3" : "wav"}`;
  if (!existsSync(path)) (hasFfmpeg ? encodeMp3 : writeWav)(path, minutes * 60);
}
for (const name of readdirSync(DIR)) console.log(`${name}\t${(statSync(DIR + name).size / 2 ** 20).toFixed(1)} MB`);

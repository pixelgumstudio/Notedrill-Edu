/**
 * Audio transcription diagnostic test
 * Run on the server: node test-audio.js
 *
 * Tests each step of the pipeline independently.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const FormData = require('form-data');
const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const tmpDir = os.tmpdir();

// ─── Step 1: Check ffmpeg ────────────────────────────────────────────────────

function checkFfmpeg() {
  return new Promise((resolve) => {
    const p = spawn('ffmpeg', ['-version']);
    let output = '';
    p.stdout.on('data', d => output += d);
    p.stderr.on('data', d => output += d);
    p.on('close', code => {
      if (code === 0 || output.includes('ffmpeg version')) {
        const version = output.split('\n')[0];
        resolve({ ok: true, version });
      } else {
        resolve({ ok: false, error: 'ffmpeg not found or failed' });
      }
    });
    p.on('error', err => resolve({ ok: false, error: err.message }));
  });
}

// ─── Step 2: Generate a 3-second silence m4a via ffmpeg ─────────────────────

function generateSilenceM4a() {
  return new Promise((resolve, reject) => {
    const outputFile = path.join(tmpDir, `test_silence_${Date.now()}.m4a`);

    const p = spawn('ffmpeg', [
      '-f', 'lavfi',
      '-i', 'anullsrc=r=44100:cl=mono',
      '-t', '3',
      '-c:a', 'aac',
      '-loglevel', 'error',
      '-y',
      outputFile,
    ]);

    p.on('close', code => {
      if (code === 0 && fs.existsSync(outputFile)) {
        const buf = fs.readFileSync(outputFile);
        fs.unlinkSync(outputFile);
        resolve(buf);
      } else {
        reject(new Error(`Failed to generate test m4a (exit code ${code})`));
      }
    });
    p.on('error', reject);
  });
}

// ─── Step 3: Convert m4a buffer → mp3 (the actual production function) ──────

function convertAudioToMp3(inputBuffer, inputExt = 'mp4') {
  return new Promise((resolve, reject) => {
    const inputFile = path.join(tmpDir, `stt_in_${Date.now()}.${inputExt}`);
    const outputFile = path.join(tmpDir, `stt_out_${Date.now()}.mp3`);

    try { fs.writeFileSync(inputFile, inputBuffer); }
    catch (err) { return reject(new Error(`Failed to write temp input file: ${err}`)); }

    const ffmpeg = spawn('ffmpeg', [
      '-i', inputFile,
      '-ar', '16000',
      '-ac', '1',
      '-ab', '32k',
      '-loglevel', 'error',
      '-y',
      outputFile,
    ]);

    ffmpeg.on('close', code => {
      try { fs.unlinkSync(inputFile); } catch {}
      if (code === 0) {
        try {
          const result = fs.readFileSync(outputFile);
          fs.unlinkSync(outputFile);
          resolve(result);
        } catch (err) { reject(new Error(`Failed to read converted file: ${err}`)); }
      } else {
        try { fs.unlinkSync(outputFile); } catch {}
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', err => {
      try { fs.unlinkSync(inputFile); } catch {}
      reject(new Error(`ffmpeg not available: ${err.message}`));
    });
  });
}

// ─── Step 4: Send mp3 to OpenAI Whisper ─────────────────────────────────────

async function testWhisper(mp3Buffer) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');

  const formData = new FormData();
  formData.append('file', mp3Buffer, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');

  const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
    headers: {
      ...formData.getHeaders(),
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    timeout: 60000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return response.data;
}

// ─── Run all tests ────────────────────────────────────────────────────────────

async function run() {
  console.log('\n========== AUDIO TRANSCRIPTION DIAGNOSTIC ==========\n');

  // 1. ffmpeg
  process.stdout.write('1. Checking ffmpeg... ');
  const ffmpegResult = await checkFfmpeg();
  if (ffmpegResult.ok) {
    console.log(`✅ ${ffmpegResult.version}`);
  } else {
    console.log(`❌ FAILED: ${ffmpegResult.error}`);
    console.log('\n⛔ Cannot continue without ffmpeg.\n');
    process.exit(1);
  }

  // 2. Generate test m4a
  process.stdout.write('2. Generating test 3s silence m4a... ');
  let m4aBuffer;
  try {
    m4aBuffer = await generateSilenceM4a();
    console.log(`✅ Generated ${m4aBuffer.length} bytes`);
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    process.exit(1);
  }

  // 3. Convert m4a → mp3
  process.stdout.write('3. Converting m4a → mp3 (16kHz mono 32kbps)... ');
  let mp3Buffer;
  try {
    mp3Buffer = await convertAudioToMp3(m4aBuffer, 'm4a');
    console.log(`✅ Converted: ${m4aBuffer.length} → ${mp3Buffer.length} bytes`);
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    console.log('\n⛔ Conversion is broken. Audio will not be transcribed correctly.\n');
    process.exit(1);
  }

  // 4. OpenAI Whisper
  process.stdout.write('4. Sending mp3 to Whisper API... ');
  if (!OPENAI_API_KEY) {
    console.log('⚠️  SKIPPED — OPENAI_API_KEY not set in environment');
  } else {
    try {
      const result = await testWhisper(mp3Buffer);
      console.log(`✅ Whisper responded (text: "${result.text || '[silence/empty]'}")`);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.error?.message || err.message;
      console.log(`❌ FAILED (HTTP ${status}): ${detail}`);
    }
  }

  console.log('\n=====================================================\n');
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

// Proof-of-work capture — real webcam recording compressed into a timelapse clip,
// so a task can't be marked done without evidence someone actually did it.

const DB_NAME = 'apex.proofs'
const STORE = 'timelapses'
const REPLAY_FRAME_MS = 120 // each stored frame gets 120ms in the sped-up output
const TARGET_FRAME_COUNT = 90 // aim for ~90 stills across the session
const MAX_FRAME_INTERVAL_MS = 30000 // never wait longer than 30s between stills, however long the task
const MIN_FRAME_INTERVAL_MS = 1000
const MAX_OUTPUT_FRAMES = 100 // caps the built clip length regardless of how long the source ran

export const DEFAULT_CAPTURE_MS = 8000 // fixed short clip for tasks with no real-world time target
export const LOCK_CAP_MS = 15 * 60 * 1000 // the blocking modal stays open at most this long; beyond it, recording continues in the background

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveTimelapse(id, blob) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadTimelapse(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteTimelapse(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Drives a live camera session: grabs still frames onto an in-memory canvas
// via its own detached <video> element (so it keeps running independent of
// whatever the UI is showing), then on stop replays those stills fast onto a
// second canvas while a MediaRecorder encodes it — turning the real session
// into a short sped-up timelapse clip.
export class ProofSession {
  constructor() {
    this.stream = null
    this.frames = [] // ImageBitmap[]
    this.width = 0
    this.height = 0
    this._grabCanvas = document.createElement('canvas')
    this._video = null
    this._timer = null
    this._frameIntervalMs = 1000
  }

  // targetMs: how long this session is expected to run in total, used to
  // pick a frame interval so a multi-hour task doesn't capture thousands of
  // stills into memory.
  async start(targetMs = DEFAULT_CAPTURE_MS) {
    this._frameIntervalMs = Math.min(
      MAX_FRAME_INTERVAL_MS,
      Math.max(MIN_FRAME_INTERVAL_MS, Math.round(targetMs / TARGET_FRAME_COUNT))
    )

    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    this._video = document.createElement('video')
    this._video.muted = true
    this._video.playsInline = true
    this._video.srcObject = this.stream
    await this._video.play()
    this.width = this._video.videoWidth || 640
    this.height = this._video.videoHeight || 480
    this._grabCanvas.width = this.width
    this._grabCanvas.height = this.height
    const ctx = this._grabCanvas.getContext('2d')

    this.frames = []
    const grab = async () => {
      ctx.drawImage(this._video, 0, 0, this.width, this.height)
      const bmp = await createImageBitmap(this._grabCanvas)
      this.frames.push(bmp)
    }
    await grab() // frame 0 immediately, so a quick tap still yields proof
    this._timer = setInterval(grab, this._frameIntervalMs)
  }

  // A live MediaStream a React <video> can attach to for on-screen preview.
  // Capture itself doesn't depend on this being displayed anywhere.
  get liveStream() {
    return this.stream
  }

  elapsedMs() {
    return this.frames.length * this._frameIntervalMs
  }

  stopCamera() {
    if (this._timer) clearInterval(this._timer)
    this._timer = null
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop())
    this.stream = null
  }

  // Replays captured stills quickly onto a canvas while recording it,
  // producing the actual timelapse Blob. Call after stopCamera(). Always
  // caps at MAX_OUTPUT_FRAMES so a long session still yields a short clip.
  async buildTimelapse() {
    if (this.frames.length === 0) throw new Error('No frames captured')
    let frames = this.frames
    if (frames.length > MAX_OUTPUT_FRAMES) {
      const step = frames.length / MAX_OUTPUT_FRAMES
      frames = Array.from({ length: MAX_OUTPUT_FRAMES }, (_, i) => this.frames[Math.min(this.frames.length - 1, Math.floor(i * step))])
    }

    const canvas = document.createElement('canvas')
    canvas.width = this.width
    canvas.height = this.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(frames[0], 0, 0)

    // Prefer manual frame pacing (captureStream(0) + requestFrame), but fall
    // back to a live 30fps capture on browsers without requestFrame (Safari).
    let outStream = canvas.captureStream(0)
    let track = outStream.getVideoTracks()[0]
    let manualFrames = typeof track.requestFrame === 'function'
    if (!manualFrames) {
      track.stop()
      outStream = canvas.captureStream(30)
      track = outStream.getVideoTracks()[0]
    }

    // webm on Chrome/Firefox; mp4 on Safari — whatever the browser can encode
    // (and therefore also play back).
    const mimeType = [
      'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm',
      'video/mp4;codecs=avc1.42E01E', 'video/mp4',
    ].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t))
    let recorder
    try {
      recorder = new MediaRecorder(outStream, mimeType ? { mimeType } : undefined)
    } catch {
      recorder = new MediaRecorder(outStream)
    }
    const chunks = []
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }

    const done = new Promise((resolve) => { recorder.onstop = resolve })
    recorder.start()

    for (const frame of frames) {
      ctx.drawImage(frame, 0, 0)
      if (manualFrames) track.requestFrame()
      await new Promise((r) => setTimeout(r, REPLAY_FRAME_MS))
    }
    recorder.stop()
    await done
    track.stop()

    const thumbnail = canvas.toDataURL('image/jpeg', 0.6)
    const blobType = recorder.mimeType || mimeType || 'video/webm'
    return { blob: new Blob(chunks, { type: blobType }), thumbnail, sourceMs: this.elapsedMs(), outputMs: frames.length * REPLAY_FRAME_MS }
  }

  release() {
    this.frames.forEach((f) => f.close && f.close())
    this.frames = []
  }
}

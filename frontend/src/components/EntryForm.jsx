import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  CheckCircle,
  FileText,
  FileUp,
  Mic,
  MicOff,
  PenLine,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import mediaService from '../services/mediaService'
import { getErrorMessage } from '../services/api'

function EntryForm({
  form,
  editingId,
  saving,
  updateForm,
  resetForm,
  saveEntry,
}) {
  const [inputMode, setInputMode] = useState('typed') // 'typed' | 'voice' | 'photo' | 'pdf'
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractionMsg, setExtractionMsg] = useState('')
  const [mediaError, setMediaError] = useState('')
  const [imagePreview, setImagePreview] = useState(null)

  const mediaStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const speechRecognitionRef = useRef(null)
  const timerIntervalRef = useRef(null)
  const sessionFinalTranscriptRef = useRef('')

  const stopLiveRecording = async () => {
    if (!isRecording) return

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop()
      } catch {
        // Ignore
      }
      speechRecognitionRef.current = null
    }

    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        // Ignore
      }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    setIsRecording(false)
    setInterimTranscript('')

    const liveText = sessionFinalTranscriptRef.current.trim()
    if (liveText) {
      updateForm(
        'content',
        form.content ? (form.content.endsWith('\n') ? `${form.content}${liveText}` : `${form.content} ${liveText}`) : liveText
      )
      updateForm('source', 'voice')
      setExtractionMsg(`Voice transcribed (${liveText.length} characters).`)
      return
    }

    const chunks = audioChunksRef.current
    if (chunks.length > 0) {
      try {
        setExtracting(true)
        setExtractionMsg('Transcribing audio recording via speech engine...')
        const blobType = recorder?.mimeType || 'audio/webm'
        const audioBlob = new Blob(chunks, { type: blobType })
        const audioFile = new File([audioBlob], 'voice_recording.webm', { type: blobType })
        const result = await mediaService.transcribeAudio(audioFile)

        if (result?.text && result.text.trim()) {
          const transcribed = result.text.trim()
          updateForm(
            'content',
            form.content ? (form.content.endsWith('\n') ? `${form.content}${transcribed}` : `${form.content}\n\n${transcribed}`) : transcribed
          )
          if (!form.title && result.detected_title) {
            updateForm('title', result.detected_title)
          }
          updateForm('source', 'voice')
          setExtractionMsg(`Voice transcribed (${result.character_count} chars).`)
        } else {
          setExtractionMsg('No speech could be recognized from the recording.')
        }
      } catch (err) {
        setMediaError(getErrorMessage(err, 'Failed to transcribe voice recording.'))
      } finally {
        setExtracting(false)
      }
    } else {
      setExtractionMsg('Recording stopped (no audio captured).')
    }
  }

  async function startLiveRecording() {
    if (isRecording) return

    setMediaError('')
    setExtractionMsg('')
    setInterimTranscript('')
    sessionFinalTranscriptRef.current = ''
    audioChunksRef.current = []

    let stream
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone capture is not supported in this browser.')
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMediaError('Microphone access was denied. Please allow microphone permissions in your browser.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMediaError('No microphone detected. Please connect an audio device.')
      } else {
        setMediaError(err.message || 'Unable to access microphone.')
      }
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event) => {
          let currentInterim = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i]
            if (res.isFinal) {
              sessionFinalTranscriptRef.current +=
                (sessionFinalTranscriptRef.current ? ' ' : '') + res[0].transcript.trim()
            } else {
              currentInterim += res[0].transcript
            }
          }
          if (currentInterim) {
            setInterimTranscript(currentInterim)
          }
        }

        recognition.onerror = (e) => {
          console.warn('SpeechRecognition notice:', e.error)
        }

        recognition.start()
        speechRecognitionRef.current = recognition
      } catch (e) {
        console.warn('Web Speech Recognition notice:', e)
      }
    }

    try {
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || ''
      const recorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.start(250)
      mediaRecorderRef.current = recorder
    } catch (e) {
      console.warn('MediaRecorder notice:', e)
    }

    setIsRecording(true)
    setRecordingSeconds(0)
    setExtractionMsg('Listening... Speak clearly into your microphone.')
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1)
    }, 1000)
  }

  function toggleLiveDictation() {
    if (isRecording) {
      stopLiveRecording()
    } else {
      startLiveRecording()
    }
  }

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop() } catch { /* Ignore */ }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop() } catch { /* Ignore */ }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  async function handleAudioUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setExtracting(true)
      setMediaError('')
      setExtractionMsg('Transcribing audio recording...')

      const result = await mediaService.transcribeAudio(file)
      updateForm(
        'content',
        form.content ? `${form.content}\n\n${result.text}` : result.text
      )
      if (!form.title && result.detected_title) {
        updateForm('title', result.detected_title)
      }
      updateForm('source', 'voice')
      setExtractionMsg(`Audio processed: ${result.character_count} characters.`)
    } catch (err) {
      setMediaError(getErrorMessage(err, 'Failed to transcribe audio file.'))
    } finally {
      setExtracting(false)
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setImagePreview(URL.createObjectURL(file))

    try {
      setExtracting(true)
      setMediaError('')
      setExtractionMsg('Extracting handwritten / page text via OCR...')

      const result = await mediaService.extractImageText(file)
      updateForm(
        'content',
        form.content ? `${form.content}\n\n${result.text}` : result.text
      )
      if (!form.title && result.detected_title) {
        updateForm('title', result.detected_title)
      }
      updateForm('source', 'photo')
      setExtractionMsg(`Image text extracted: ${result.character_count} characters.`)
    } catch (err) {
      setMediaError(getErrorMessage(err, 'Failed to extract text from image.'))
    } finally {
      setExtracting(false)
    }
  }

  async function handleDocUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setExtracting(true)
      setMediaError('')
      setExtractionMsg('Extracting document contents...')

      const result = await mediaService.extractDocumentText(file)
      updateForm(
        'content',
        form.content ? `${form.content}\n\n${result.text}` : result.text
      )
      if (!form.title && result.detected_title) {
        updateForm('title', result.detected_title)
      }
      updateForm('source', 'pdf')
      setExtractionMsg(`Document imported: ${result.character_count} characters.`)
    } catch (err) {
      setMediaError(getErrorMessage(err, 'Failed to extract text from document.'))
    } finally {
      setExtracting(false)
    }
  }

  function handleReset() {
    if (isRecording) {
      stopLiveRecording()
    }
    setImagePreview(null)
    setExtractionMsg('')
    setMediaError('')
    resetForm()
  }

  return (
    <section className="panel create-panel">
      <div className="panel-heading">
        <div>
          <h2>{editingId !== null ? 'Edit entry' : 'New entry'}</h2>
          <p>Capture thoughts via text, speech, photo OCR, or documents.</p>
        </div>
        {editingId !== null ? (
          <button
            className="icon-btn"
            onClick={handleReset}
            type="button"
            title="Cancel editing"
          >
            <X size={19} />
          </button>
        ) : (
          <Plus size={20} />
        )}
      </div>

      {/* Input Mode Switcher */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
          marginBottom: '16px',
          backgroundColor: 'var(--bg-subtle)',
          padding: '6px',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {[
          { id: 'typed', label: 'Type', icon: PenLine },
          { id: 'voice', label: 'Voice', icon: Mic },
          { id: 'photo', label: 'Photo/OCR', icon: Camera },
          { id: 'pdf', label: 'Document', icon: FileUp },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setInputMode(id)
              setMediaError('')
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '7px 4px',
              borderRadius: 'var(--radius-sm)',
              border: inputMode === id ? '1px solid var(--primary-border)' : '1px solid transparent',
              backgroundColor: inputMode === id ? 'var(--primary-subtle)' : 'transparent',
              color: inputMode === id ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: inputMode === id ? 700 : 500,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Mode-specific interactive controls */}
      {inputMode === 'voice' && (
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <button
            type="button"
            onClick={toggleLiveDictation}
            className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`}
            style={{ borderRadius: 'var(--radius-full)', padding: '9px 18px' }}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            <span>
              {isRecording
                ? `Stop Listening (${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')})`
                : 'Live Microphone Dictation'}
            </span>
          </button>

          {isRecording && (
            <div style={{ fontSize: '12px', color: 'var(--primary)', fontStyle: 'italic' }}>
              {interimTranscript ? `"${interimTranscript}"` : 'Listening to speech... Speak clearly.'}
            </div>
          )}

          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            or upload an audio file (.mp3, .wav, .webm, .m4a):
          </span>

          <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '12px' }}>
            <Upload size={14} />
            <span>Choose Audio File</span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload}
              disabled={extracting}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      )}

      {inputMode === 'photo' && (
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
            Upload a photograph of a physical bullet journal page, whiteboard, or handwriting:
          </p>

          <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '12px' }}>
            <Camera size={15} />
            <span>Select Journal Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={extracting}
              style={{ display: 'none' }}
            />
          </label>

          {imagePreview && (
            <div style={{ marginTop: '8px' }}>
              <img
                src={imagePreview}
                alt="Page preview"
                style={{
                  maxHeight: '100px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}
        </div>
      )}

      {inputMode === 'pdf' && (
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
            Import text from a document (.pdf, .md, .txt):
          </p>

          <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '12px' }}>
            <FileText size={15} />
            <span>Select Document</span>
            <input
              type="file"
              accept=".pdf,.txt,.md,.json"
              onChange={handleDocUpload}
              disabled={extracting}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      )}

      {/* Extraction status alerts */}
      {extracting && (
        <p style={{ fontSize: '12px', color: 'var(--primary)', marginBottom: '12px', fontWeight: 600 }}>
          Processing media...
        </p>
      )}

      {extractionMsg && !extracting && (
        <div className="editor-banner success-banner" style={{ marginBottom: '14px', padding: '8px 12px' }}>
          <CheckCircle size={14} />
          <span>{extractionMsg}</span>
        </div>
      )}

      {mediaError && (
        <p className="error" style={{ marginBottom: '14px' }}>
          {mediaError}
        </p>
      )}

      {/* Main Entry Form */}
      <form onSubmit={saveEntry}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label>Entry type</label>
            <select
              value={form.entry_type}
              onChange={(e) => updateForm('entry_type', e.target.value)}
            >
              <option value="event">Journal</option>
              <option value="note">Note</option>
              <option value="task">Task</option>
            </select>
          </div>

          <div>
            <label>Date</label>
            <input
              type="date"
              value={form.entry_date}
              onChange={(e) => updateForm('entry_date', e.target.value)}
              required
            />
          </div>
        </div>

        <label>Title</label>
        <input
          type="text"
          placeholder="Give your entry a title..."
          value={form.title}
          onChange={(e) => updateForm('title', e.target.value)}
          required
        />

        <label>Content</label>
        <textarea
          placeholder="What's on your mind? (type, speak, or extract from attachments)"
          value={form.content}
          onChange={(e) => updateForm('content', e.target.value)}
          required
          rows={5}
        />

        {form.entry_type === 'task' && (
          <>
            <label>Task status</label>
            <select
              value={form.status}
              onChange={(e) => updateForm('status', e.target.value)}
            >
              <option value="open">Open</option>
              <option value="done">Completed</option>
            </select>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <small style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Source: <strong>{form.source || 'typed'}</strong>
          </small>

          <button className="btn btn-primary" type="submit" disabled={saving || extracting}>
            <Plus size={16} />
            <span>{saving
              ? 'Saving...'
              : editingId !== null
              ? 'Update entry'
              : 'Save entry'}</span>
          </button>
        </div>
      </form>
    </section>
  )
}

export default EntryForm

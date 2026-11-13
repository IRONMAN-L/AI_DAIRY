import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bold,
  BookOpen,
  Calendar,
  Camera,
  Check,
  Code,
  Columns,
  Eye,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Mic,
  MicOff,
  PenLine,
  Quote,
  Save,
  Upload,
  AlertCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import entriesService from '../services/entriesService'
import mediaService from '../services/mediaService'
import { getErrorMessage } from '../services/api'
import { formatDisplayDate, getToday } from '../utils/dateUtils'
import MarkdownContent from '../components/common/MarkdownContent'

export function JournalEditorPage() {
  const navigate = useNavigate()
  const { id: editEntryId } = useParams()
  const [searchParams] = useSearchParams()

  const isEditMode = Boolean(editEntryId)
  const defaultDate = searchParams.get('date') || getToday()
  const defaultType = searchParams.get('type') || 'event'

  const draftKey = isEditMode
    ? `daybook_draft_edit_${editEntryId}`
    : `daybook_draft_new_${defaultDate}`

  // Check if an unsaved draft exists from a previous session (without auto-injecting)
  const [savedDraftFound, setSavedDraftFound] = useState(() => {
    if (!isEditMode) {
      try {
        const saved = localStorage.getItem(draftKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed && (parsed.title || parsed.content)) {
            return parsed
          }
        }
      } catch {
        // Ignore
      }
    }
    return null
  })

  // Entry Form State - GUARANTEED EMPTY FOR NEW ENTRIES
  const [entryDate, setEntryDate] = useState(defaultDate)
  const [entryType, setEntryType] = useState(defaultType)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('open')
  const [source, setSource] = useState('typed')

  // UI State
  const [viewMode, setViewMode] = useState('split') // 'write' | 'split' | 'preview'
  const [loading, setLoading] = useState(isEditMode)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [error, setError] = useState('')
  const [successNotice, setSuccessNotice] = useState('')

  // Multi-modal & Voice Dictation State
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [mediaProcessing, setMediaProcessing] = useState(false)
  const [mediaNotice, setMediaNotice] = useState('')
  const [showMediaDock, setShowMediaDock] = useState(false)

  const textareaRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const speechRecognitionRef = useRef(null)
  const timerIntervalRef = useRef(null)
  const sessionFinalTranscriptRef = useRef('')

  // 1. In Edit mode: Load existing entry by ID
  useEffect(() => {
    let ignore = false

    if (!isEditMode) return

    async function loadEntry() {
      try {
        setLoading(true)
        setError('')
        const data = await entriesService.getEntryById(editEntryId)
        if (!ignore) {
          setEntryDate(data.entry_date || defaultDate)
          setEntryType(data.entry_type || 'event')
          setTitle(data.title || '')
          setContent(data.content || '')
          setStatus(data.status || 'open')
          setSource(data.source || 'typed')
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err, 'Could not load entry for editing.'))
          setLoading(false)
        }
      }
    }
    loadEntry()

    return () => {
      ignore = true
    }
  }, [editEntryId, defaultDate, isEditMode])

  // 2. Draft Auto-Saving (only if user has typed something new)
  useEffect(() => {
    if (loading || !content.trim()) return

    const timer = setTimeout(() => {
      try {
        const draft = {
          title,
          content,
          entryDate,
          entryType,
          status,
          source,
          savedAt: new Date().toISOString(),
        }
        localStorage.setItem(draftKey, JSON.stringify(draft))
        setSaveStatus('draft')
      } catch {
        // LocalStorage full or disabled
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [title, content, entryDate, entryType, status, source, draftKey, loading])

  // Draft recovery actions
  function handleRestoreDraft() {
    if (savedDraftFound) {
      if (savedDraftFound.title) setTitle(savedDraftFound.title)
      if (savedDraftFound.content) setContent(savedDraftFound.content)
      if (savedDraftFound.entryType) setEntryType(savedDraftFound.entryType)
      if (savedDraftFound.status) setStatus(savedDraftFound.status)
      if (savedDraftFound.source) setSource(savedDraftFound.source)
      setSavedDraftFound(null)
      setMediaNotice('Restored your previously unsaved draft.')
    }
  }

  function handleDiscardDraft() {
    localStorage.removeItem(draftKey)
    setSavedDraftFound(null)
  }

  // 3. Voice-to-Text Recording Engine
  const stopVoiceRecording = useCallback(async () => {
    if (!isRecording) return

    // Stop timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    // Stop live SpeechRecognition
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop()
      } catch {
        // Ignore
      }
      speechRecognitionRef.current = null
    }

    // Stop MediaRecorder
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        // Ignore
      }
    }

    // Stop microphone tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    setIsRecording(false)
    setInterimTranscript('')

    // Evaluate captured text
    const liveText = sessionFinalTranscriptRef.current.trim()
    if (liveText) {
      setContent((prev) => {
        if (!prev) return liveText
        return prev.endsWith('\n') ? `${prev}${liveText}` : `${prev}\n\n${liveText}`
      })
      setSource('voice')
      setMediaNotice(`Voice transcribed (${liveText.length} characters inserted).`)
      return
    }

    // Fallback: If Web Speech produced no text, use MediaRecorder audio sent to backend transcription!
    const chunks = audioChunksRef.current
    if (chunks.length > 0) {
      try {
        setMediaProcessing(true)
        setMediaNotice('Transcribing audio recording via speech engine...')
        const blobType = recorder?.mimeType || 'audio/webm'
        const audioBlob = new Blob(chunks, { type: blobType })
        const audioFile = new File([audioBlob], 'voice_recording.webm', { type: blobType })
        const result = await mediaService.transcribeAudio(audioFile)

        if (result?.text && result.text.trim()) {
          const transcribed = result.text.trim()
          setContent((prev) => {
            if (!prev) return transcribed
            return prev.endsWith('\n') ? `${prev}${transcribed}` : `${prev}\n\n${transcribed}`
          })
          if (!title && result.detected_title) {
            setTitle(result.detected_title)
          }
          setSource('voice')
          setMediaNotice(`Voice transcribed (${result.character_count} chars).`)
        } else {
          setMediaNotice('No speech could be recognized from the recording.')
        }
      } catch (err) {
        setMediaNotice(getErrorMessage(err, 'Failed to transcribe voice recording.'))
      } finally {
        setMediaProcessing(false)
      }
    } else {
      setMediaNotice('Recording stopped (no audio captured).')
    }
  }, [isRecording, title])

  async function startVoiceRecording() {
    if (isRecording) return

    setError('')
    setMediaNotice('')
    setInterimTranscript('')
    sessionFinalTranscriptRef.current = ''
    audioChunksRef.current = []

    // 1. Request microphone permission
    let stream
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio capture is not supported in this browser environment.')
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMediaNotice('Microphone access denied. Please allow microphone permissions in your browser address bar/settings.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMediaNotice('No microphone detected. Please connect an audio input device.')
      } else {
        setMediaNotice(err.message || 'Unable to access microphone.')
      }
      return
    }

    // 2. Start Live Web Speech API if supported
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
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

        recognition.onend = () => {
          // Finished or stopped
        }

        recognition.start()
        speechRecognitionRef.current = recognition
      } catch (e) {
        console.warn('Web Speech Recognition initialization notice:', e)
      }
    }

    // 3. Start MediaRecorder concurrent stream capture
    try {
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ]
      const supportedMime =
        mimeTypes.find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || ''
      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream)

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

    // 4. Update UI State & Timer
    setIsRecording(true)
    setRecordingSeconds(0)
    setMediaNotice('Listening... Speak clearly into your microphone.')
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1)
    }, 1000)
  }

  function toggleLiveVoice() {
    if (isRecording) {
      stopVoiceRecording()
    } else {
      startVoiceRecording()
    }
  }

  // Cleanup media & timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop()
        } catch {
          // Ignore
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          // Ignore
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // 4. Keyboard Shortcuts: Ctrl+S / Cmd+S to save
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  // Format insertion helpers
  function insertMarkdown(prefix, suffix = '') {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)

    const replacement = `${prefix}${selectedText || 'text'}${suffix}`
    const newContent =
      content.substring(0, start) + replacement + content.substring(end)

    setContent(newContent)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selectedText ? selectedText.length : 4)
      )
    }, 10)
  }

  function insertLinePrefix(prefix) {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const beforeCursor = content.substring(0, start)
    const lastNewline = beforeCursor.lastIndexOf('\n')
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1

    const newContent =
      content.substring(0, lineStart) +
      prefix +
      content.substring(lineStart)

    setContent(newContent)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length)
    }, 10)
  }

  // File Upload Handlers
  async function handleAudioUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setMediaProcessing(true)
      setMediaNotice('Transcribing audio recording...')
      const result = await mediaService.transcribeAudio(file)
      setContent((prev) => (prev ? `${prev}\n\n${result.text}` : result.text))
      if (!title && result.detected_title) {
        setTitle(result.detected_title)
      }
      setSource('voice')
      setMediaNotice(`Voice transcribed (${result.character_count} chars).`)
    } catch (err) {
      setMediaNotice(getErrorMessage(err, 'Failed to transcribe audio file.'))
    } finally {
      setMediaProcessing(false)
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setMediaProcessing(true)
      setMediaNotice('Extracting handwriting & text from photo...')
      const result = await mediaService.extractImageText(file)
      setContent((prev) => (prev ? `${prev}\n\n${result.text}` : result.text))
      if (!title && result.detected_title) {
        setTitle(result.detected_title)
      }
      setSource('photo')
      setMediaNotice(`Photo text extracted (${result.character_count} chars).`)
    } catch (err) {
      setMediaNotice(getErrorMessage(err, 'Failed to extract text from photo.'))
    } finally {
      setMediaProcessing(false)
    }
  }

  async function handleDocUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setMediaProcessing(true)
      setMediaNotice('Extracting text from document...')
      const result = await mediaService.extractDocumentText(file)
      setContent((prev) => (prev ? `${prev}\n\n${result.text}` : result.text))
      if (!title && result.detected_title) {
        setTitle(result.detected_title)
      }
      setSource('pdf')
      setMediaNotice(`Document text imported (${result.character_count} chars).`)
    } catch (err) {
      setMediaNotice(getErrorMessage(err, 'Failed to extract document contents.'))
    } finally {
      setMediaProcessing(false)
    }
  }

  // Save Entry
  async function handleSave() {
    if (!content.trim()) {
      setError('Please write some content before saving.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSaveStatus('saving')

      const fallbackTitle =
        entryType === 'task'
          ? 'Bullet Task'
          : entryType === 'note'
          ? 'Journal Reflection'
          : 'Journal Event'

      const payload = {
        entry_date: entryDate,
        entry_type: entryType,
        title: title.trim() || fallbackTitle,
        content: content.trim(),
        status: entryType === 'task' ? status : 'open',
        source,
      }

      if (isEditMode) {
        await entriesService.updateEntry(editEntryId, payload)
      } else {
        await entriesService.createEntry(payload)
      }

      // Purge drafts upon successful save
      localStorage.removeItem(draftKey)
      setSavedDraftFound(null)
      setSaveStatus('saved')
      setSuccessNotice('Entry saved successfully!')

      // Redirect back to Daily Journal after brief feedback
      setTimeout(() => {
        navigate(`/journal?date=${entryDate}`)
      }, 400)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save entry.'))
      setSaveStatus('idle')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (content.trim()) {
      const confirmLeave = window.confirm(
        'You have unsaved changes. Discard changes and return to journal?'
      )
      if (!confirmLeave) return
      // Clear temporary draft if user deliberately discards
      localStorage.removeItem(draftKey)
    }
    navigate(`/journal?date=${entryDate}`)
  }

  // Metrics
  const wordsCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const charCount = content.length
  const readingTimeMin = Math.max(1, Math.ceil(wordsCount / 200))
  const formatTimer = (sec) =>
    `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

  if (loading) {
    return (
      <div className="empty" style={{ padding: '80px 20px' }}>
        <p>Loading journal entry into studio editor...</p>
      </div>
    )
  }

  return (
    <div className="journal-editor-page">
      {/* 1. Header Toolbar */}
      <header className="editor-topbar">
        <div className="editor-topbar-left">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleCancel}
            title="Return to Journal (Esc)"
          >
            <ArrowLeft size={16} />
            <span>Back to Journal</span>
          </button>

          <div className="editor-date-selector">
            <Calendar size={15} />
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="editor-date-input"
            />
            {entryDate !== getToday() && (
              <button
                type="button"
                className="btn-tiny"
                onClick={() => setEntryDate(getToday())}
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Entry Type Selector Tabs */}
        <div className="editor-type-pills">
          {[
            { id: 'event', label: 'Journal Event', icon: BookOpen },
            { id: 'note', label: 'Journal Note', icon: FileText },
            { id: 'task', label: 'Bullet Task', icon: ListTodo },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`type-pill ${entryType === id ? 'active' : ''}`}
              onClick={() => {
                setEntryType(id)
                if (id !== 'task') setStatus('open')
              }}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Actions & Auto-Save Badge */}
        <div className="editor-topbar-right">
          <div className="save-status-indicator">
            {saveStatus === 'saving' && (
              <span className="status-badge saving">Saving...</span>
            )}
            {saveStatus === 'saved' && (
              <span className="status-badge saved">
                <Check size={13} />
                Saved
              </span>
            )}
            {saveStatus === 'draft' && (
              <span className="status-badge draft">Draft saved</span>
            )}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : isEditMode ? 'Update Entry' : 'Save Entry'}</span>
          </button>
        </div>
      </header>

      {/* Task status switcher if entryType is task */}
      {entryType === 'task' && (
        <div className="editor-task-bar">
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Task Status:</span>
          <button
            type="button"
            className={`status-btn ${status === 'open' ? 'active' : ''}`}
            onClick={() => setStatus('open')}
          >
            Open Task
          </button>
          <button
            type="button"
            className={`status-btn ${status === 'done' ? 'active done' : ''}`}
            onClick={() => setStatus('done')}
          >
            <Check size={14} />
            Completed
          </button>
        </div>
      )}

      {/* Optional Unsaved Draft Recovery Notice for New Entries */}
      {savedDraftFound && !isEditMode && (
        <div
          className="editor-banner info-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>
              Found an unsaved draft from a previous session (
              {savedDraftFound.savedAt
                ? new Date(savedDraftFound.savedAt).toLocaleTimeString()
                : 'earlier'}
              ). Would you like to restore it?
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRestoreDraft}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              <RotateCcw size={13} />
              <span>Restore Draft</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleDiscardDraft}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              <Trash2 size={13} />
              <span>Discard</span>
            </button>
          </div>
        </div>
      )}

      {/* Alerts / Error feedback */}
      {error && <div className="editor-banner error-banner">{error}</div>}
      {successNotice && <div className="editor-banner success-banner">{successNotice}</div>}
      {mediaNotice && <div className="editor-banner info-banner">{mediaNotice}</div>}

      {/* Live Voice Recording Status Banner */}
      {isRecording && (
        <div
          className="editor-banner"
          style={{
            backgroundColor: 'var(--primary-subtle)',
            border: '1px solid var(--primary-border)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-danger, #ef4444)',
                display: 'inline-block',
                animation: 'pulse 1.2s infinite',
              }}
            />
            <strong>Recording Voice ({formatTimer(recordingSeconds)})</strong>
            <span style={{ fontSize: '13px' }}>
              {interimTranscript ? `"${interimTranscript}"` : 'Listening... Speak clearly.'}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={stopVoiceRecording}
            style={{ padding: '4px 12px', fontSize: '12px', borderColor: 'var(--primary)' }}
          >
            <MicOff size={14} />
            <span>Stop Recording</span>
          </button>
        </div>
      )}

      {/* 2. Formatting & Multi-Modal Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => insertMarkdown('**', '**')}
            title="Bold (**text**)"
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => insertMarkdown('*', '*')}
            title="Italic (*text*)"
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => insertMarkdown('`', '`')}
            title="Inline Code (`code`)"
          >
            <Code size={15} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => insertLinePrefix('# ')}
            title="Heading 1 (#)"
          >
            <Heading1 size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => insertLinePrefix('## ')}
            title="Heading 2 (##)"
          >
            <Heading2 size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => insertLinePrefix('### ')}
            title="Heading 3 (###)"
          >
            <Heading3 size={15} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => insertLinePrefix('- ')}
            title="Bullet list (- )"
          >
            <List size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => insertLinePrefix('1. ')}
            title="Numbered list (1. )"
          >
            <ListOrdered size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => insertLinePrefix('> ')}
            title="Blockquote (> )"
          >
            <Quote size={15} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Multi-Modal Ingestion Toggles */}
        <div className="toolbar-group">
          <button
            type="button"
            className={`toolbar-btn ${isRecording ? 'active recording' : ''}`}
            onClick={toggleLiveVoice}
            disabled={mediaProcessing}
            title={isRecording ? 'Stop voice recording' : 'Dictate voice recording'}
            style={
              isRecording
                ? {
                    backgroundColor: 'var(--primary-subtle)',
                    color: 'var(--primary)',
                    borderColor: 'var(--primary)',
                  }
                : {}
            }
          >
            {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
            <span>
              {isRecording
                ? `Stop (${formatTimer(recordingSeconds)})`
                : mediaProcessing
                ? 'Processing...'
                : 'Voice Dictate'}
            </span>
          </button>

          <button
            type="button"
            className={`toolbar-btn ${showMediaDock ? 'active' : ''}`}
            onClick={() => setShowMediaDock((prev) => !prev)}
            title="Upload audio, image OCR, or document text"
          >
            <Upload size={15} />
            <span>Import Media</span>
          </button>
        </div>

        {/* View Mode Switcher (Write / Split / Preview) */}
        <div className="toolbar-group view-mode-switch">
          <button
            type="button"
            className={`view-btn ${viewMode === 'write' ? 'active' : ''}`}
            onClick={() => setViewMode('write')}
            title="Focus Editor"
          >
            <PenLine size={14} />
            <span>Write</span>
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
            title="Side-by-Side Editor & Preview"
          >
            <Columns size={14} />
            <span>Split</span>
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === 'preview' ? 'active' : ''}`}
            onClick={() => setViewMode('preview')}
            title="Formatted Reading View"
          >
            <Eye size={14} />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Multi-modal Collapsible Drawer */}
      {showMediaDock && (
        <div className="editor-media-dock">
          <div className="media-dock-card">
            <h4>Voice File Upload</h4>
            <p>Upload an audio recording (.mp3, .wav, .webm, .m4a) to transcribe into text:</p>
            <label className="btn btn-secondary upload-label">
              <Mic size={14} />
              <span>Choose Audio File</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                disabled={mediaProcessing}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div className="media-dock-card">
            <h4>Photo / Handwriting OCR</h4>
            <p>Extract handwriting, sketches, or journal page photos directly:</p>
            <label className="btn btn-secondary upload-label">
              <Camera size={14} />
              <span>Choose Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={mediaProcessing}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div className="media-dock-card">
            <h4>Document Import</h4>
            <p>Extract text cleanly from .pdf, .txt, or .md documents:</p>
            <label className="btn btn-secondary upload-label">
              <FileText size={14} />
              <span>Choose Document</span>
              <input
                type="file"
                accept=".pdf,.txt,.md,.json"
                onChange={handleDocUpload}
                disabled={mediaProcessing}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      )}

      {/* 3. Main Writing Canvas Area */}
      <main className="editor-workspace">
        {/* Editor Writing Column */}
        {(viewMode === 'write' || viewMode === 'split') && (
          <div className={`editor-pane write-pane ${viewMode === 'split' ? 'split' : 'full'}`}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Entry Title or Daily Reflection..."
              className="editor-title-input"
              autoFocus={!isEditMode}
            />

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your thoughts, daily journal, bullet tasks, or reflections...

Supports full markdown:
# Headings
- Bullet points
1. Numbered lists
- [ ] Tasks
> Reflections & quotes"
              className="editor-content-textarea"
            />
          </div>
        )}

        {/* Live Formatted Markdown Preview Column */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`editor-pane preview-pane ${viewMode === 'split' ? 'split' : 'full'}`}>
            <div className="preview-canvas">
              <h1 className="preview-title">{title || 'Untitled Entry'}</h1>
              <div className="preview-meta">
                <span>{formatDisplayDate(entryDate)}</span>
                <span>•</span>
                <span style={{ textTransform: 'capitalize' }}>{entryType}</span>
                {source && source !== 'typed' && (
                  <>
                    <span>•</span>
                    <span className="entry-badge badge-source">{source}</span>
                  </>
                )}
              </div>

              <div className="preview-markdown-container">
                <MarkdownContent content={content} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. Editor Footer Bar */}
      <footer className="editor-footer">
        <div className="editor-stats">
          <span>{wordsCount} words</span>
          <span>•</span>
          <span>{charCount} characters</span>
          <span>•</span>
          <span>~{readingTimeMin} min read</span>
        </div>

        <div className="editor-shortcuts">
          <span>Press <strong>Ctrl+S</strong> to save anytime</span>
        </div>
      </footer>
    </div>
  )
}

export default JournalEditorPage

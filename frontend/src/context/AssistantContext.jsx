/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import assistantService from '../services/assistantService'
import { getErrorMessage } from '../services/api'

const AssistantContext = createContext(null)

const INITIAL_WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hello! I am your personal AI Diary Assistant. You can ask me natural-language questions about your journal entries, task history, and past reflections. Every answer is grounded directly in your personal archives.',
  citations: [],
  model: 'assistant',
}

let assistantMsgCounter = 1

export function AssistantProvider({ children }) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('daybook_chat_messages')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // Ignore parsing errors and fallback to welcome
    }
    return [INITIAL_WELCOME_MESSAGE]
  })

  const [input, setInput] = useState(() => {
    return sessionStorage.getItem('daybook_chat_input') || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Sync messages to sessionStorage to preserve across navigations & page refreshes
  useEffect(() => {
    try {
      sessionStorage.setItem('daybook_chat_messages', JSON.stringify(messages))
    } catch {
      // Storage quota or disabled
    }
  }, [messages])

  useEffect(() => {
    try {
      sessionStorage.setItem('daybook_chat_input', input)
    } catch {
      // Ignore
    }
  }, [input])

  async function sendMessage(textToSend) {
    const text = typeof textToSend === 'string' ? textToSend.trim() : input.trim()
    if (!text || loading) return

    const userMsg = {
      id: `user-${Date.now()}-${++assistantMsgCounter}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setError('')
    setLoading(true)

    try {
      // Build lightweight conversation history for context (up to last 6 messages)
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }))

      const response = await assistantService.chat(text, historyPayload)

      const assistantMsg = {
        id: `assistant-${Date.now()}-${++assistantMsgCounter}`,
        role: 'assistant',
        content: response.answer,
        citations: response.citations || [],
        model: response.model || 'gemini-2.5-flash',
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const friendlyError = getErrorMessage(
        err,
        'Unable to query diary assistant. Please check backend connection.'
      )
      setError(friendlyError)
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I encountered an issue retrieving that information: ${friendlyError}`,
          citations: [],
          model: 'error',
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function clearConversation() {
    setMessages([INITIAL_WELCOME_MESSAGE])
    setInput('')
    setError('')
    try {
      sessionStorage.removeItem('daybook_chat_messages')
      sessionStorage.removeItem('daybook_chat_input')
    } catch {
      // Ignore
    }
  }

  return (
    <AssistantContext.Provider
      value={{
        messages,
        input,
        setInput,
        loading,
        error,
        sendMessage,
        clearConversation,
      }}
    >
      {children}
    </AssistantContext.Provider>
  )
}

export function useAssistant() {
  const context = useContext(AssistantContext)
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider')
  }
  return context
}

export default AssistantContext


import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { AssistantProvider } from './context/AssistantContext'
import ErrorBoundary from './components/common/ErrorBoundary'
import ProtectedRoute from './components/common/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import DashboardPage from './pages/DashboardPage'
import DailyJournalPage from './pages/DailyJournalPage'
import JournalEditorPage from './pages/JournalEditorPage'
import TasksPage from './pages/TasksPage'
import CalendarPage from './pages/CalendarPage'
import SearchPage from './pages/SearchPage'
import AssistantPage from './pages/AssistantPage'
import SettingsPage from './pages/SettingsPage'
import './index.css'
import './App.css'

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AssistantProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />

                {/* Protected Workspace Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="journal" element={<DailyJournalPage />} />
                  <Route path="editor" element={<JournalEditorPage key="editor-create" />} />
                  <Route path="editor/:id" element={<JournalEditorPage key="editor-edit" />} />
                  <Route path="journal/new" element={<Navigate to="/editor" replace />} />
                  <Route path="journal/edit/:id" element={<JournalEditorPage key="editor-edit-legacy" />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="assistant" element={<AssistantPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AssistantProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App

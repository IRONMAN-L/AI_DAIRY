import {
  ENTRY_SOURCE_LABELS,
  ENTRY_TYPE_LABELS,
  TASK_STATUS_LABELS,
} from './constants'

export function getStatusLabel(status) {
  return TASK_STATUS_LABELS[status] || 'Open'
}

export function getEntryTypeLabel(type) {
  return ENTRY_TYPE_LABELS[type] || 'Journal'
}

export function getSourceLabel(source) {
  return ENTRY_SOURCE_LABELS[source] || 'Typed'
}

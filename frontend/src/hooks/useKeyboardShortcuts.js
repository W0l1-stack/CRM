import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/store/ui.store';

/** Returns true when focus is in a text input / textarea / contenteditable. */
function isTyping(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Global keyboard shortcuts for the authenticated app:
 *   ⌘/Ctrl+K  → command palette
 *   ⌘/Ctrl+N  → new contact
 *   ?         → keyboard shortcut help overlay
 * Shortcuts that aren't modifier-based are ignored while typing in a field.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { toggleCommand, setShortcutsOpen, setCommandOpen } = useUIStore.getState();

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommand();
        return;
      }
      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setCommandOpen(false);
        navigate('/contacts?new=1');
        return;
      }
      if (!mod && (e.key === '?' || (e.key === '/' && e.shiftKey)) && !isTyping(e.target)) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, toggleCommand, setShortcutsOpen, setCommandOpen]);
}

import React, { useState } from 'react';
import type { ActionItem } from './data';

interface AddTaskModalProps {
  currentPerson: string | null;
  onAdd: (item: Omit<ActionItem, 'id' | 'created_at'>) => void;
  onClose: () => void;
}

export function AddTaskModal({ currentPerson, onAdd, onClose }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [person, setPerson] = useState(currentPerson || 'monny');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      person: currentPerson || person,
      title: title.trim(),
      status: 'todo',
      priority,
      due_date: dueDate,
      source,
      category
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Drop a Move</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="What needs to happen?"
              autoFocus
            />
          </div>
          {!currentPerson && (
            <div className="form-group">
              <label>Assigned To</label>
              <select value={person} onChange={e => setPerson(e.target.value)}>
                <option value="sunshine">☀️ Sunshine</option>
                <option value="monny">🌊 Monny</option>
                <option value="bingle">✨ Bingle</option>
              </select>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Source</label>
              <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="e.g., behind h0es doors" />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., launch, content" />
            </div>
          </div>
          <button type="submit" className="btn-submit">Add to List ✨</button>
        </form>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function TaskList() {
  const [tasks, setTasks] = useState([])
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    supabase
      .from('tasks')
      .select('*')
      .order('created_at')
      .then(({ data, error }) => {
        if (error) { console.error('fetch tasks error', error); return }
        setTasks(data)
      })

    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' },
        ({ new: row }) => setTasks(prev => [...prev, row])
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' },
        ({ new: row }) => setTasks(prev => prev.map(t => t.id === row.id ? row : t))
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' },
        ({ old: row }) => setTasks(prev => prev.filter(t => t.id !== row.id))
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function addTask() {
    if (!newTitle.trim()) return
    const { error } = await supabase.from('tasks').insert({ title: newTitle.trim() })
    if (error) console.error('insert task error', error)
    setNewTitle('')
  }

  async function toggleTask(task) {
    const { error } = await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id)
    if (error) console.error('toggle task error', error)
  }

  async function deleteTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) console.error('delete task error', error)
  }

  return (
    <div className="task-list">
      <h2 className="task-list-title">Tasks</h2>

      <div className="task-add-row">
        <input
          className="task-add-input"
          type="text"
          placeholder="Add a task…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
        />
        <button className="task-add-btn" onClick={addTask}>+</button>
      </div>

      <ul className="task-items">
        {tasks.map(task => (
          <li key={task.id} className={`task-item${task.done ? ' task-done' : ''}`}>
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => toggleTask(task)}
            />
            <span className="task-text">{task.title}</span>
            <button
              className="task-delete-btn"
              onClick={() => deleteTask(task.id)}
              aria-label="Delete task"
            >
              ✕
            </button>
          </li>
        ))}
        {tasks.length === 0 && (
          <li className="task-empty">No tasks yet</li>
        )}
      </ul>
    </div>
  )
}

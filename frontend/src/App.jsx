import './App.css';
import { useDispatch, useSelector } from 'react-redux';
import { useState } from 'react';
import { useSocket, getSocket } from './hooks/useSocket';
import { setRole, setName } from './slices/pollSlice';

function RoleSelector() {
  const dispatch = useDispatch();
  const { role, name } = useSelector((state) => state.poll);
  const [localName, setLocalName] = useState(name);

  const handleSelectRole = (nextRole) => {
    dispatch(setRole(nextRole));
    if (nextRole === 'student' && localName.trim()) {
      dispatch(setName(localName.trim()));
      const socket = getSocket();
      if (socket) {
        socket.emit('register_student', { name: localName.trim() });
      }
    }
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!localName.trim()) return;
    dispatch(setName(localName.trim()));
    const socket = getSocket();
    if (socket && role === 'student') {
      socket.emit('register_student', { name: localName.trim() });
    }
  };

  return (
    <div className="role-selector">
      <div className="role-buttons">
        <button
          className={role === 'teacher' ? 'primary' : 'secondary'}
          onClick={() => handleSelectRole('teacher')}
        >
          I&apos;m a Teacher
        </button>
        <button
          className={role === 'student' ? 'primary' : 'secondary'}
          onClick={() => handleSelectRole('student')}
        >
          I&apos;m a Student
        </button>
      </div>
      {role === 'student' && (
        <form className="name-form" onSubmit={handleNameSubmit}>
          <label>
            Your name
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="Enter your name"
            />
          </label>
          <button type="submit" className="primary">
            Save name
          </button>
        </form>
      )}
    </div>
  );
}

function TeacherView() {
  const { currentQuestion, remainingTime, canAskNewQuestion, results, students } =
    useSelector((state) => state.poll);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState(60);

  const socket = getSocket();

  const handleOptionChange = (index, value) => {
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  };

  const addOption = () => {
    setOptions((prev) => [...prev, '']);
  };

  const handleAskQuestion = () => {
    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!questionText.trim() || trimmedOptions.length < 2 || !socket) return;
    socket.emit('teacher_new_question', {
      text: questionText.trim(),
      options: trimmedOptions,
      duration: Number(duration) || 60,
    });
  };

  const handleRemoveStudent = (studentId) => {
    if (!socket) return;
    socket.emit('teacher_remove_student', { studentId });
  };

  return (
    <div className="panel">
      <h2>Teacher Panel</h2>
      <div className="grid two-cols">
        <div>
          <h3>Create Poll</h3>
          <label>
            Question
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Type your question..."
            />
          </label>
          <label>
            Options
            {options.map((opt, idx) => (
              <input
                key={idx}
                type="text"
                value={opt}
                onChange={(e) => handleOptionChange(idx, e.target.value)}
                placeholder={`Option ${idx + 1}`}
              />
            ))}
            <button type="button" className="secondary" onClick={addOption}>
              + Add option
            </button>
          </label>
          <label>
            Time limit (seconds)
            <input
              type="number"
              value={duration}
              min={5}
              max={600}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={!canAskNewQuestion}
            onClick={handleAskQuestion}
          >
            Ask question
          </button>
          {!canAskNewQuestion && (
            <p className="hint">
              You can ask a new question only when all students have answered or time is up.
            </p>
          )}
        </div>
        <div>
          <h3>Live Status</h3>
          {currentQuestion ? (
            <>
              <p className="muted">Time left: {remainingTime}s</p>
              {results && (
                <div className="results">
                  {currentQuestion.options.map((opt, idx) => {
                    const pct = results.percentages[idx] || 0;
                    const count = results.counts[idx] || 0;
                    return (
                      <div key={idx} className="result-row">
                        <span className="label">{opt}</span>
                        <div className="bar-container">
                          <div className="bar" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="value">
                          {pct}% ({count})
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="muted">No active question.</p>
          )}
          <h4>Students</h4>
          <ul className="student-list">
            {Object.entries(students).map(([id, s]) => (
              <li key={id}>
                <span>{s.name}</span>
                <button
                  type="button"
                  className="link"
                  onClick={() => handleRemoveStudent(id)}
                >
                  Remove
                </button>
              </li>
            ))}
            {Object.keys(students).length === 0 && (
              <li className="muted">No students connected yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StudentView() {
  const { currentQuestion, remainingTime, results, name } = useSelector(
    (state) => state.poll,
  );
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const socket = getSocket();

  const handleSubmit = () => {
    if (!name) {
      // Require name so backend can register student and count answers
      // eslint-disable-next-line no-alert
      alert('Please enter and save your name in the header first.');
      return;
    }
    if (selected === null || !socket) return;
    socket.emit('student_answer', { optionIndex: selected });
    setSubmitted(true);
  };

  if (!currentQuestion) {
    return (
      <div className="panel">
        <h2>Waiting for question...</h2>
        <p className="muted">Your teacher has not asked a question yet.</p>
      </div>
    );
  }

  const timeUp = remainingTime <= 0;

  return (
    <div className="panel">
      <h2>Question</h2>
      <p className="question-text">{currentQuestion.text}</p>
      <p className="muted">Time left: {remainingTime}s</p>
      {!submitted && !timeUp ? (
        <>
          <div className="options">
            {currentQuestion.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                className={selected === idx ? 'primary' : 'secondary'}
                onClick={() => setSelected(idx)}
                disabled={!name}
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="primary"
            disabled={selected === null || !name}
            onClick={handleSubmit}
          >
            Submit answer
          </button>
        </>
      ) : (
        <p className="muted">
          {timeUp ? 'Time is up. Showing results.' : 'Answer submitted. Showing results.'}
        </p>
      )}
      {results && (
        <div className="results">
          {currentQuestion.options.map((opt, idx) => {
            const pct = results.percentages[idx] || 0;
            const count = results.counts[idx] || 0;
            return (
              <div key={idx} className="result-row">
                <span className="label">{opt}</span>
                <div className="bar-container">
                  <div className="bar" style={{ width: `${pct}%` }} />
                </div>
                <span className="value">
                  {pct}% ({count})
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChatPanel() {
  const { chat, name, role } = useSelector((state) => state.poll);
  const [message, setMessage] = useState('');
  const socket = getSocket();

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;
    socket.emit('chat_message', {
      from: name || role || 'Anonymous',
      role,
      message: message.trim(),
    });
    setMessage('');
  };

  return (
    <div className="chat">
      <h3>Chat</h3>
      <div className="chat-messages">
        {chat.map((c, idx) => (
          <div key={idx} className="chat-message">
            <span className="chat-author">
              {c.from} ({c.role})
            </span>
            <span className="chat-text">{c.message}</span>
          </div>
        ))}
        {chat.length === 0 && <p className="muted">No messages yet.</p>}
      </div>
      <form className="chat-input" onSubmit={handleSend}>
        <input
          type="text"
          value={message}
          placeholder="Type a message..."
          onChange={(e) => setMessage(e.target.value)}
        />
        <button type="submit" className="primary">
          Send
        </button>
      </form>
    </div>
  );
}

function App() {
  useSocket();
  const { role } = useSelector((state) => state.poll);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Live Polling</div>
        <RoleSelector />
      </header>
      <main className="content">
        {role === 'teacher' && (
          <div className="layout">
            <TeacherView />
            <ChatPanel />
          </div>
        )}
        {role === 'student' && (
          <div className="layout">
            <StudentView />
            <ChatPanel />
          </div>
        )}
        {!role && (
          <div className="empty-state">
            <h2>Select a role to begin</h2>
            <p className="muted">
              Choose whether you are a teacher or a student to start the live polling session.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

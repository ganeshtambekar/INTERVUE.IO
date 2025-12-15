const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory state (would be external store in production)
let currentQuestion = null; // { id, text, options, createdAt, duration }
let answers = {}; // { studentId: { name, optionIndex, answeredAt } }
let students = {}; // { studentId: { name, connectedAt, lastSeen } }
let questionHistory = []; // array of past questions with results
let questionCounter = 1;

const QUESTION_DEFAULT_DURATION = 60; // seconds

function getRemainingTime() {
  if (!currentQuestion) return 0;
  const elapsed = (Date.now() - currentQuestion.createdAt) / 1000;
  const remaining = Math.max(0, Math.round(currentQuestion.duration - elapsed));
  return remaining;
}

function buildResults() {
  if (!currentQuestion) return null;
  const counts = new Array(currentQuestion.options.length).fill(0);
  Object.values(answers).forEach((a) => {
    if (typeof a.optionIndex === 'number' && counts[a.optionIndex] !== undefined) {
      counts[a.optionIndex] += 1;
    }
  });
  const total = Object.keys(answers).length || 1;
  const percentages = counts.map((c) => Math.round((c / total) * 100));
  return { counts, percentages, total };
}

function canAskNewQuestion() {
  if (!currentQuestion) return true;
  const remaining = getRemainingTime();
  const allAnswered =
    Object.keys(students).length > 0 &&
    Object.keys(answers).length === Object.keys(students).length;
  return remaining === 0 || allAnswered;
}

function emitState() {
  const state = {
    currentQuestion,
    answers,
    students,
    remainingTime: getRemainingTime(),
    canAskNewQuestion: canAskNewQuestion(),
    results: buildResults(),
  };
  io.emit('state_update', state);
}

// Broadcast timer / results updates every second while a question is active
setInterval(() => {
  if (!currentQuestion) return;
  emitState();
}, 1000);

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  socket.on('register_student', ({ name }) => {
    const studentId = socket.id;
    students[studentId] = {
      name,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
    };
    console.log('Student registered', studentId, name);
    emitState();
  });

  socket.on('teacher_new_question', ({ text, options, duration }) => {
    const useDuration =
      typeof duration === 'number' && duration > 0 ? duration : QUESTION_DEFAULT_DURATION;
    if (!canAskNewQuestion()) {
      socket.emit('error_message', {
        message: 'Cannot ask new question until all students have answered or time is up.',
      });
      return;
    }

    if (!text || !options || !Array.isArray(options) || options.length < 2) {
      socket.emit('error_message', {
        message: 'Question text and at least two options are required.',
      });
      return;
    }

    if (currentQuestion) {
      questionHistory.push({
        ...currentQuestion,
        results: buildResults(),
        answers: { ...answers },
        closedAt: Date.now(),
      });
    }

    currentQuestion = {
      id: questionCounter++,
      text,
      options,
      createdAt: Date.now(),
      duration: useDuration,
    };
    answers = {};

    io.emit('new_question', { currentQuestion, remainingTime: getRemainingTime() });
    emitState();
  });

  socket.on('student_answer', ({ optionIndex }) => {
    const studentId = socket.id;
    if (!currentQuestion) {
      socket.emit('error_message', { message: 'No active question.' });
      return;
    }
    if (!students[studentId]) {
      socket.emit('error_message', { message: 'Student not registered.' });
      return;
    }
    if (getRemainingTime() <= 0) {
      socket.emit('error_message', { message: 'Time is up for this question.' });
      return;
    }
    if (
      typeof optionIndex !== 'number' ||
      optionIndex < 0 ||
      optionIndex >= currentQuestion.options.length
    ) {
      socket.emit('error_message', { message: 'Invalid option selected.' });
      return;
    }

    answers[studentId] = {
      name: students[studentId].name,
      optionIndex,
      answeredAt: Date.now(),
    };

    io.to(studentId).emit('answer_accepted', {
      currentQuestion,
      remainingTime: getRemainingTime(),
    });

    emitState();
  });

  socket.on('teacher_remove_student', ({ studentId }) => {
    if (students[studentId]) {
      delete students[studentId];
      delete answers[studentId];
      emitState();
    }
  });

  socket.on('teacher_request_history', () => {
    socket.emit('history', questionHistory);
  });

  socket.on('chat_message', ({ from, role, message }) => {
    const payload = {
      from,
      role,
      message,
      timestamp: Date.now(),
    };
    io.emit('chat_message', payload);
  });

  socket.emit('state_update', {
    currentQuestion,
    answers,
    students,
    remainingTime: getRemainingTime(),
    canAskNewQuestion: canAskNewQuestion(),
    results: buildResults(),
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Polling backend is running');
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});



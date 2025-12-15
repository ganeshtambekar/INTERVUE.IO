import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  role: null, // 'teacher' | 'student'
  name: '',
  currentQuestion: null,
  students: {},
  answers: {},
  remainingTime: 0,
  canAskNewQuestion: true,
  results: null,
  history: [],
  chat: [],
  connected: false,
};

const pollSlice = createSlice({
  name: 'poll',
  initialState,
  reducers: {
    setRole(state, action) {
      state.role = action.payload;
    },
    setName(state, action) {
      state.name = action.payload;
    },
    socketConnected(state) {
      state.connected = true;
    },
    socketDisconnected(state) {
      state.connected = false;
    },
    stateUpdated(state, action) {
      const {
        currentQuestion,
        answers,
        students,
        remainingTime,
        canAskNewQuestion,
        results,
      } = action.payload;
      state.currentQuestion = currentQuestion;
      state.answers = answers || {};
      state.students = students || {};
      state.remainingTime = remainingTime || 0;
      state.canAskNewQuestion = !!canAskNewQuestion;
      state.results = results || null;
    },
    newQuestionReceived(state, action) {
      const { currentQuestion, remainingTime } = action.payload;
      state.currentQuestion = currentQuestion;
      state.remainingTime = remainingTime;
      state.results = null;
      state.answers = {};
    },
    historyReceived(state, action) {
      state.history = action.payload || [];
    },
    chatMessageReceived(state, action) {
      state.chat.push(action.payload);
    },
  },
});

export const {
  setRole,
  setName,
  socketConnected,
  socketDisconnected,
  stateUpdated,
  newQuestionReceived,
  historyReceived,
  chatMessageReceived,
} = pollSlice.actions;

export default pollSlice.reducer;



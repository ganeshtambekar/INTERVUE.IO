import { configureStore } from '@reduxjs/toolkit';
import pollReducer from './slices/pollSlice';

export const store = configureStore({
  reducer: {
    poll: pollReducer,
  },
});



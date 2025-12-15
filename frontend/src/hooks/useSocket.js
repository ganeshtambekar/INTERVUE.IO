import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import {
  socketConnected,
  socketDisconnected,
  stateUpdated,
  newQuestionReceived,
  historyReceived,
  chatMessageReceived,
} from '../slices/pollSlice';

let socket;

export function getSocket() {
  return socket;
}

export function useSocket() {
  const dispatch = useDispatch();
  const { name, role } = useSelector((state) => state.poll);

  useEffect(() => {
    if (!socket) {
      socket = io('http://localhost:4000');

      socket.on('connect', () => {
        dispatch(socketConnected());
        if (role === 'student' && name) {
          socket.emit('register_student', { name });
        }
      });

      socket.on('disconnect', () => {
        dispatch(socketDisconnected());
      });

      socket.on('state_update', (payload) => {
        dispatch(stateUpdated(payload));
      });

      socket.on('new_question', (payload) => {
        dispatch(newQuestionReceived(payload));
      });

      socket.on('history', (payload) => {
        dispatch(historyReceived(payload));
      });

      socket.on('chat_message', (payload) => {
        dispatch(chatMessageReceived(payload));
      });

      socket.on('error_message', (payload) => {
        // Surface server-side validation problems so user understands why
        // their action (e.g. submitting without a name) was ignored.
        // eslint-disable-next-line no-alert
        if (payload && payload.message) window.alert(payload.message);
        // eslint-disable-next-line no-console
        console.error('Socket error_message', payload);
      });
    }
  }, [dispatch, name, role]);
}



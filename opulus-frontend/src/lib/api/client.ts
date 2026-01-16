import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for Better Auth cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

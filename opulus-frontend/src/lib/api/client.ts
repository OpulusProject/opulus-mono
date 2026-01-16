import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Log the API URL being used (helps debug production issues)
// Note: This will show the value that was baked in at build time
if (typeof window !== 'undefined') {
  console.log(`🌐 Frontend API URL: ${API_BASE_URL}`);
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for Better Auth cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

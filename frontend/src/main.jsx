import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './i18n.js';
import './css/bloom.css';
import './css/bloom-extra.css';
import { AuthProvider, PublicOnly, RequireAuth } from './auth.jsx';
import AppLayout from './components/AppLayout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Today from './pages/Today.jsx';
import Month from './pages/Month.jsx';
import Tasks from './pages/Tasks.jsx';
import Study from './pages/Study.jsx';
import Habits from './pages/Habits.jsx';
import Focus from './pages/Focus.jsx';
import Diary from './pages/Diary.jsx';
import Garden from './pages/Garden.jsx';
import Profile from './pages/Profile.jsx';

const appPages = [
  ['/today/', Today], ['/month/', Month], ['/tasks/', Tasks], ['/study/', Study],
  ['/habits/', Habits], ['/focus/', Focus], ['/diary/', Diary], ['/garden/', Garden],
  ['/profile/', Profile],
];

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PublicOnly><Home /></PublicOnly>} />
          <Route path="/login/" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register/" element={<PublicOnly><Register /></PublicOnly>} />
          {appPages.map(([path, Page]) => (
            <Route
              key={path} path={path}
              element={<RequireAuth><AppLayout><Page /></AppLayout></RequireAuth>}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

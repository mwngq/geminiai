/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';

import Login from './pages/Login';
import StudentDashboard from './pages/student/Dashboard';
import ProblemList from './pages/student/ProblemList';
import Workspace from './pages/student/Workspace';
import Profile from './pages/student/Profile';
import Assignments from './pages/student/Assignments';

import TeacherDashboard from './pages/teacher/Dashboard';
import ProblemManage from './pages/teacher/ProblemManage';
import AssignmentManage from './pages/teacher/AssignmentManage';
import ClassManage from './pages/teacher/ClassManage';
import AIAssistant from './pages/teacher/AIAssistant';
import Analytics from './pages/teacher/Analytics';
import AdminDashboard from './pages/admin/Dashboard';
import UserManage from './pages/admin/UserManage';
import AdminSettings from './pages/admin/Settings';

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch user role from Firestore
        try {
          const userDoc = await getDocFromServer(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else {
            // Default to student if not found
            setUserRole('student');
            // Create default user doc
            await setDoc(doc(db, 'users', currentUser.uid), {
              uid: currentUser.uid,
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'New User',
              email: currentUser.email || '',
              role: 'student',
              status: 'active',
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error("Error fetching user role", error);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full"></div></div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to={`/${userRole || 'student'}`} replace />} />
          
          {/* Student Routes */}
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/problems" element={<ProblemList />} />
          <Route path="/student/assignments" element={<Assignments />} />
          <Route path="/student/workspace/:id" element={<Workspace />} />
          <Route path="/student/profile" element={<Profile />} />

          {/* Teacher Routes */}
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/problems" element={<ProblemManage />} />
          <Route path="/teacher/assignments" element={<AssignmentManage />} />
          <Route path="/teacher/classes" element={<ClassManage />} />
          <Route path="/teacher/ai-assistant" element={<AIAssistant />} />
          <Route path="/teacher/analytics" element={<Analytics />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UserManage />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

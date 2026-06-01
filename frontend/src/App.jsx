import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageWrapper from '@/components/Layout/PageWrapper';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Contacts from '@/pages/Contacts';
import ContactDetail from '@/pages/ContactDetail';
import Pipeline from '@/pages/Pipeline';
import Conversations from '@/pages/Conversations';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<PageWrapper />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/conversations" element={<Conversations />} />
        </Route>
      </Route>
    </Routes>
  );
}

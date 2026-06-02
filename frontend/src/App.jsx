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
import Automations from '@/pages/Automations';
import Calendar from '@/pages/Calendar';
import Booking from '@/pages/Booking';
import Forms from '@/pages/Forms';
import PublicForm from '@/pages/PublicForm';
import Campaigns from '@/pages/Campaigns';
import Billing from '@/pages/Billing';
import Settings from '@/pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/book/:typeId" element={<Booking />} />
      <Route path="/form/:id" element={<PublicForm />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<PageWrapper />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/automations" element={<Automations />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/forms" element={<Forms />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}

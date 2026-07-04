import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import BookingPage from "./pages/BookingPage";
import CheckInPage from "./pages/CheckInPage";
import ExperiencesPage from "./pages/ExperiencesPage";
import FAQPage from "./pages/FAQPage";
import ContactPage from "./pages/ContactPage";
import AdminDashboard from "./pages/AdminDashboard";

const StaffCheckInPage = lazy(() => import("./pages/StaffCheckInPage"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/checkin/:token" element={<CheckInPage />} />
      <Route
        path="/admin/checkin"
        element={
          <Suspense fallback={null}>
            <StaffCheckInPage />
          </Suspense>
        }
      />
      <Route path="/experiences" element={<ExperiencesPage />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

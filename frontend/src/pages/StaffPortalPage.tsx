import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { STAFF_TOKEN_KEY } from "../api/client";
import StaffLoginPage from "./StaffLoginPage";

const StaffCheckInPage = lazy(() => import("./StaffCheckInPage"));
const StaffVerifyBookingPage = lazy(() => import("./StaffVerifyBookingPage"));

function StaffGuard({ children }: { children: ReactNode }) {
  const token = localStorage.getItem(STAFF_TOKEN_KEY);
  if (!token) {
    return <Navigate to="/staff/login" replace />;
  }
  return <>{children}</>;
}

export default function StaffPortalPage() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="login" element={<StaffLoginPage />} />
        <Route
          path="scan"
          element={
            <StaffGuard>
              <StaffCheckInPage />
            </StaffGuard>
          }
        />
        <Route
          path="verify/:token"
          element={
            <StaffGuard>
              <StaffVerifyBookingPage />
            </StaffGuard>
          }
        />
        <Route path="*" element={<Navigate to="/staff/login" replace />} />
      </Routes>
    </Suspense>
  );
}

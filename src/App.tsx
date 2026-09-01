import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "@/app/store";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoginPage } from "@/features/auth/LoginPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastHost } from "@/components/Toast";
import { Skeleton } from "@/components/Chrome";
import { ROUTE_PERMISSIONS } from "@/constants/nav";
import { useAppSelector } from "@/hooks/useAuth";

const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const CoursesPage = lazy(() => import("@/features/courses/CoursesPage").then((m) => ({ default: m.CoursesPage })));
const BatchesPage = lazy(() => import("@/features/courses/BatchesPage").then((m) => ({ default: m.BatchesPage })));
const StudentsDesk = lazy(() => import("@/features/students/StudentsDesk").then((m) => ({ default: m.StudentsDesk })));
const StudentDetail = lazy(() => import("@/features/students/StudentDetail").then((m) => ({ default: m.StudentDetail })));
const AdmissionsDesk = lazy(() => import("@/features/admissions/AdmissionsDesk").then((m) => ({ default: m.AdmissionsDesk })));
const AttendanceDesk = lazy(() => import("@/features/attendance/AttendanceDesk").then((m) => ({ default: m.AttendanceDesk })));
const FeesPage = lazy(() => import("@/features/payments/FeesPage").then((m) => ({ default: m.FeesPage })));
const QuizzesPage = lazy(() => import("@/features/quizzes/QuizzesPage").then((m) => ({ default: m.QuizzesPage })));
const ScholarshipsPage = lazy(() => import("@/features/scholarships/ScholarshipsPage").then((m) => ({ default: m.ScholarshipsPage })));
const LivePage = lazy(() => import("@/features/live/LivePage").then((m) => ({ default: m.LivePage })));
const RolesPage = lazy(() => import("@/features/roles/RolesPage").then((m) => ({ default: m.RolesPage })));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const NotificationsPage = lazy(() => import("@/features/notifications/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const IdCardsPage = lazy(() => import("@/features/idCards/IdCardsPage").then((m) => ({ default: m.IdCardsPage })));
const EnrollmentsPage = lazy(() => import("@/features/enrollments/EnrollmentsPage").then((m) => ({ default: m.EnrollmentsPage })));
const EnquiriesPage = lazy(() => import("@/features/enquiries/EnquiriesPage").then((m) => ({ default: m.EnquiriesPage })));
const TypingPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.TypingPage })));
const NotesPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.NotesPage })));
const NoticesPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.NoticesPage })));
const StaffPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.StaffPage })));
const AlumniPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.AlumniPage })));
const JobsPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.JobsPage })));
const VideosPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.VideosPage })));
const GalleryPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.GalleryPage })));
const CouponsPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.CouponsPage })));
const MarqueePage = lazy(() => import("@/features/pages").then((m) => ({ default: m.MarqueePage })));
const AdsPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.AdsPage })));
const PopupsPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.PopupsPage })));
const LinksPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.LinksPage })));
const AuditPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.AuditPage })));
const ReferralsPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.ReferralsPage })));
const WhatsAppPage = lazy(() => import("@/features/pages").then((m) => ({ default: m.WhatsAppPage })));

function Guest({ children }: { children: ReactNode }) {
  const token = useAppSelector((s) => s.auth.accessToken);
  if (token) return <Navigate to="/" replace />;
  return children;
}

function Fallback() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-10 max-w-sm" />
      <Skeleton className="h-48" />
    </div>
  );
}

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Fallback />}>{children}</Suspense>;
}

function RoutePage({ permission, children }: { permission?: string | string[]; children: ReactNode }) {
  return (
    <ProtectedRoute permission={permission}>
      <S>{children}</S>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Guest>
            <LoginPage />
          </Guest>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<RoutePage permission={ROUTE_PERMISSIONS["/"]}><DashboardPage /></RoutePage>} />
        <Route path="/courses" element={<RoutePage permission={ROUTE_PERMISSIONS["/courses"]}><CoursesPage /></RoutePage>} />
        <Route path="/batches" element={<RoutePage permission={ROUTE_PERMISSIONS["/batches"]}><BatchesPage /></RoutePage>} />
        <Route path="/students" element={<RoutePage permission={ROUTE_PERMISSIONS["/students"]}><StudentsDesk /></RoutePage>} />
        <Route path="/students/:id" element={<RoutePage permission={ROUTE_PERMISSIONS["/students/:id"]}><StudentDetail /></RoutePage>} />
        <Route path="/admissions" element={<RoutePage permission={ROUTE_PERMISSIONS["/admissions"]}><AdmissionsDesk /></RoutePage>} />
        <Route path="/enquiries" element={<RoutePage permission={ROUTE_PERMISSIONS["/enquiries"]}><EnquiriesPage /></RoutePage>} />
        <Route path="/enrollments" element={<RoutePage permission={ROUTE_PERMISSIONS["/enrollments"]}><EnrollmentsPage /></RoutePage>} />
        <Route path="/attendance" element={<RoutePage permission={ROUTE_PERMISSIONS["/attendance"]}><AttendanceDesk /></RoutePage>} />
        <Route path="/fees" element={<RoutePage permission={ROUTE_PERMISSIONS["/fees"]}><FeesPage /></RoutePage>} />
        <Route path="/quizzes" element={<RoutePage permission={ROUTE_PERMISSIONS["/quizzes"]}><QuizzesPage /></RoutePage>} />
        <Route path="/typing" element={<RoutePage permission={ROUTE_PERMISSIONS["/typing"]}><TypingPage /></RoutePage>} />
        <Route path="/scholarships" element={<RoutePage permission={ROUTE_PERMISSIONS["/scholarships"]}><ScholarshipsPage /></RoutePage>} />
        <Route path="/notes" element={<RoutePage permission={ROUTE_PERMISSIONS["/notes"]}><NotesPage /></RoutePage>} />
        <Route path="/gallery" element={<RoutePage permission={ROUTE_PERMISSIONS["/gallery"]}><GalleryPage /></RoutePage>} />
        <Route path="/notices" element={<RoutePage permission={ROUTE_PERMISSIONS["/notices"]}><NoticesPage /></RoutePage>} />
        <Route path="/live" element={<RoutePage permission={ROUTE_PERMISSIONS["/live"]}><LivePage /></RoutePage>} />
        <Route path="/staff" element={<RoutePage permission={ROUTE_PERMISSIONS["/staff"]}><StaffPage /></RoutePage>} />
        <Route path="/alumni" element={<RoutePage permission={ROUTE_PERMISSIONS["/alumni"]}><AlumniPage /></RoutePage>} />
        <Route path="/videos" element={<RoutePage permission={ROUTE_PERMISSIONS["/videos"]}><VideosPage /></RoutePage>} />
        <Route path="/jobs" element={<RoutePage permission={ROUTE_PERMISSIONS["/jobs"]}><JobsPage /></RoutePage>} />
        <Route path="/coupons" element={<RoutePage permission={ROUTE_PERMISSIONS["/coupons"]}><CouponsPage /></RoutePage>} />
        <Route path="/referrals" element={<RoutePage permission={ROUTE_PERMISSIONS["/referrals"]}><ReferralsPage /></RoutePage>} />
        <Route path="/marquee" element={<RoutePage permission={ROUTE_PERMISSIONS["/marquee"]}><MarqueePage /></RoutePage>} />
        <Route path="/ads" element={<RoutePage permission={ROUTE_PERMISSIONS["/ads"]}><AdsPage /></RoutePage>} />
        <Route path="/popups" element={<RoutePage permission={ROUTE_PERMISSIONS["/popups"]}><PopupsPage /></RoutePage>} />
        <Route path="/links" element={<RoutePage permission={ROUTE_PERMISSIONS["/links"]}><LinksPage /></RoutePage>} />
        <Route path="/id-cards" element={<RoutePage permission={ROUTE_PERMISSIONS["/id-cards"]}><IdCardsPage /></RoutePage>} />
        <Route path="/notifications" element={<RoutePage permission={ROUTE_PERMISSIONS["/notifications"]}><NotificationsPage /></RoutePage>} />
        <Route path="/whatsapp" element={<RoutePage permission={ROUTE_PERMISSIONS["/whatsapp"]}><WhatsAppPage /></RoutePage>} />
        <Route path="/roles" element={<RoutePage permission={ROUTE_PERMISSIONS["/roles"]}><RolesPage /></RoutePage>} />
        <Route path="/settings" element={<RoutePage permission={ROUTE_PERMISSIONS["/settings"]}><SettingsPage /></RoutePage>} />
        <Route path="/audit" element={<RoutePage permission={ROUTE_PERMISSIONS["/audit"]}><AuditPage /></RoutePage>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <ErrorBoundary>
          <ToastHost />
          <AppRoutes />
        </ErrorBoundary>
      </BrowserRouter>
    </Provider>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AddWord from "./pages/AddWord.tsx";
import Dictionary from "./pages/Dictionary.tsx";
import WordDetail from "./pages/WordDetail.tsx";
import Quiz from "./pages/Quiz.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Profile from "./pages/Profile.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import Community from "./pages/Community.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/add" element={<AddWord />} />
                <Route path="/dictionary" element={<Dictionary />} />
                <Route path="/word/:id" element={<WordDetail />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/community" element={<Community />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

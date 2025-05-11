import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import Dashboard from "./components/Dashboard"
import AuthPage from "./components/AuthPage"
import ProfileSetup from "./components/ProfileSetup"
import Classroom from "./components/Classroom"
import { NotificationProvider } from "./components/NotificationContext"

function App() {
  return (
    <NotificationProvider>
      <Router>
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/classroom/:id" element={<Classroom />} />
        </Routes>
      </Router>
    </NotificationProvider>
  )
}

export default App

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import HomePage from "./pages/HomePage";
import WaitingRoom from "./pages/WaitingRoom";
import AuthPage from "./components/auth/AuthPage";
import GameLobby from "./pages/GameLobby";
import PlayingRoom from "./pages/PlayingRoom";
import GamesList from "./pages/GamesList";
import WalletModal from "./components/WalletModal";
import ProfileModal from "./components/ProfileModal";
import InviteModal from "./components/InviteModal";
import BingoGame from "./example";
import SpinPage from "./pages/SpinPage";
import TestAudioComponent from "./components/TestAudioComponent";

function App() {
  return (
    <AuthProvider>
      <Router>
        <WalletModal />
        <ProfileModal />
        <InviteModal />
        <Routes>
          <Route path="/example" element={<BingoGame />} />
          <Route path="/test-audio" element={<TestAudioComponent />} />
          <Route path="/" element={<GamesList />} />
          <Route path="/bingo" element={<HomePage />} />
          <Route
            path="/systemGames"
            element={
              <ProtectedRoute>
                <GameLobby />
              </ProtectedRoute>
            }
          />
          <Route
            path="/waiting/:gameRoomId"
            element={
              <ProtectedRoute>
                <WaitingRoom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playing/:gameRoomId"
            element={
              <ProtectedRoute>
                <PlayingRoom />
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/spin"
            element={
              <ProtectedRoute>
                <SpinPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

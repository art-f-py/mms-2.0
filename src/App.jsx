import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home       from "./pages/Home";
import Statistics from "./pages/Statistics";
import Inputs     from "./pages/Inputs";
import { MmsProvider } from "./context/MmsContext";
import AppHeader  from "./components/AppHeader";
import FloatingActions from "./components/FloatingActions";

function App() {
  return (
    <MmsProvider>
      <Router basename="/mms-2.0">
        <AppHeader />
        <Routes>
          <Route path="/"           element={<Home />} />
          <Route path="/inputs"     element={<Inputs />} />
          <Route path="/statistics" element={<Statistics />} />
        </Routes>
        <FloatingActions />
      </Router>
    </MmsProvider>
  );
}

export default App;

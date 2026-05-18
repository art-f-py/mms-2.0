import { BrowserRouter as Router, Routes, Route } from "react-router-dom";  
import Statistics from "./pages/Statistics";
import Inputs from "./pages/Inputs";
import { MmsProvider } from "./context/MmsContext";
import AppHeader from "./components/AppHeader";

function App() {
  return (
    <MmsProvider>
      <AppHeader />
      <Router>
        <Routes>
          <Route path="/inputs" element={<Inputs />} />
          <Route path="/statistics" element={<Statistics />} />
        </Routes>
      </Router>
    </MmsProvider>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";  
import Statistics from "./pages/Statistics";
import Inputs from "./pages/Inputs";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Inputs />} />
        <Route path="/statistics" element={<Statistics />} />
      </Routes>
    </Router>
  );
}

export default App;

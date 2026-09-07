import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Analyze from './pages/Analyze'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/analyze" element={<Analyze />} />
        <Route path="/analyze/:mint" element={<Analyze />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}
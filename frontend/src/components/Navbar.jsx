import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl">🏍️</span>
            <span className="font-bold text-xl">Enduro Events</span>
          </Link>
          
          <div className="flex space-x-6">
            <Link to="/" className="hover:text-blue-200 transition">
              Dashboard
            </Link>
            <Link to="/eventi" className="hover:text-blue-200 transition">
              Eventi
            </Link>
            <Link to="/piloti" className="hover:text-blue-200 transition">
              Piloti
            </Link>
            <Link to="/tempi" className="hover:text-blue-200 transition">
              Tempi
            </Link>
            <Link to="/classifiche" className="hover:text-blue-200 transition">
              Classifiche
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

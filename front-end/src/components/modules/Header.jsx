import React from "react";
import { Link } from "react-router-dom";
import "./Header.css";
import { useEffect, useState } from "react";
import { axiosInstance } from "../../lib/axios";
import { useNavigate } from "react-router-dom";

/**
 * The navigation bar at the top of all pages.
 */
const Header = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axiosInstance.get("/auth");
        setUser(res.data.user); // either user object or null
      } catch (err) {
        setUser(null);
      }
    };
    fetchUser();
  }, []);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = () => {
    if (searchTerm.trim()) {
      navigate(`/search?name=${encodeURIComponent(searchTerm)}`);
    }
  };

  const handleCategoryClick = (category) => {
    navigate(`/search?category=${encodeURIComponent(category)}`);
  };

  return (
    <header>
      <div className="top-header">
        <div className="logo">
          <Link to="/" className="logo-link">
            Ticketbox
          </Link>
        </div>

        <div>
          <input
            type="text"
            placeholder="Bạn tìm gì hôm nay?"
            className="header-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className="header-search-btn"
            onClick={handleSearch}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "white",
              fontSize: "20px",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M10 2a8 8 0 105.293 14.293l4.707 4.707 1.414-1.414-4.707-4.707A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z" />
            </svg>
          </button>
        </div>

        <div className="actions">
          {/* Navigation buttons */}
          <Link to="/admin/events/test">
            <button>Tạo sự kiện</button>
          </Link>
          <Link to="/user/tickets/test">
            <button>Vé của tôi</button>
          </Link>

          {/* Conditional rendering based on user */}
          {!user ? (
            <>
              <Link to="/login">
                <button>Đăng nhập</button>
              </Link>
              <Link to="/register">
                <button>Đăng ký</button>
              </Link>
            </>
          ) : (
            <div className="account-menu">
              <button className="account-btn">
                👤 {user.username || "Tài khoản"}
              </button>
              <div className="dropdown">
                <Link to="/user/tickets/test">🎟 Vé của tôi</Link>
                <Link to="/admin/my-event">📅 Sự kiện của tôi</Link>
                <Link to="/user/my-account">⚙️ Tài khoản của tôi</Link>
                <p>
                  <a
                    href="/"
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        await axiosInstance.get("/auth/logout", {
                          withCredentials: true,
                        });
                        window.location.href = "/";
                      } catch (err) {
                        console.error("Logout failed", err);
                      }
                    }}
                  >
                    🚪 Đăng xuất
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Language selector */}
          <div className="language-selector">
            <button className="flag">🇻🇳</button>
            <div className="dropdown">
              <button>VN</button>
              <button>EN</button>
            </div>
          </div>
        </div>
      </div>

      <nav className="header-nav-bar">
        <button onClick={() => handleCategoryClick("Nhạc sống & Concert")}>
          Nhạc sống & Concert
        </button>
        <button onClick={() => handleCategoryClick("Sân khấu & Nghệ thuật")}>
          Sân khấu & Nghệ thuật
        </button>
        <button onClick={() => handleCategoryClick("Thể Thao")}>
          Thể Thao
        </button>
        <button onClick={() => handleCategoryClick("Hội thảo & Workshop")}>
          Hội thảo & Workshop
        </button>
        <button onClick={() => handleCategoryClick("Tham quan & Trải nghiệm")}>
          Tham quan & Trải nghiệm
        </button>
        <button onClick={() => handleCategoryClick("Khác")}>Khác</button>
      </nav>
    </header>
  );
};

export default Header;

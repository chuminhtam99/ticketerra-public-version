import React, { useState } from "react";
import { axiosInstance } from "../../lib/axios";
import "./LoginPage.css";
import { useLocation, useNavigate } from "react-router-dom";

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo") || "/";
 

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    try {
      const res = await axiosInstance.post("/auth/login", {
        username: formData.username,
        password: formData.password,
      });

      if (res.data.success) {
        // ✅ use navigate instead of window.location.href
        navigate(returnTo);
      } else {
        setErrorMessage("not success to log in");
      }
    } catch (err) {
      if (err.response) {
        setErrorMessage(err.response.data.message);
      }
    }
  };

  return (
    <div className="login-container">
      <h2 className="login-text">Đăng nhập</h2>

      <form className="login-form" onSubmit={handleSubmit}>
        {/* Show note if redirected */}
        {returnTo !== "/" && (
          <p className="login-note">
            {returnTo === "/admin/my-event"
              ? "Bạn cần đăng nhập để tiếp tục tạo sự kiện."
              : "Bạn cần đăng nhập để tiếp tục truy cập trang này."}
          </p>
        )}

        <input
          type="text"
          name="username"
          placeholder="Tên đăng nhập hoặc email"
          value={formData.username}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Mật khẩu"
          value={formData.password}
          onChange={handleChange}
          required
        />
        <button type="submit">Đăng nhập</button>

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        <p className="home-link">
          <a href="/">← Trở lại trang chủ</a>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;

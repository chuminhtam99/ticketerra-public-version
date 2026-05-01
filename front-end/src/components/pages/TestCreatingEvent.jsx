import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../lib/axios"; // adjust path if needed
import "./TestCreatingEvent.css"; // your spinner styles

const TestCreatingEvent = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axiosInstance.get("/events/auth", {
          withCredentials: true,
        });
        if (res.status >= 200 && res.status < 300) {
          // ✅ Auth OK → go to events page
          navigate("/admin/events");
        } else {
          // ❌ Not authorized → go to login
          navigate("/login");
        }
      } catch (err) {
        navigate("/login");
      }
    };
    checkAuth();
  }, [navigate]);

  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Đang đăng nhập với admin...</p>
    </div>
  );
};

export default TestCreatingEvent;
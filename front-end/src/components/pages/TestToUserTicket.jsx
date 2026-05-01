import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../lib/axios"; // adjust path if needed
import "./TestToUserTicket.css"; // your spinner styles

const TestToUserTicket = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axiosInstance.get("/booking/user/tickets", {
          withCredentials: true,
        });
        if (res.status >= 200 && res.status < 300) {
          // ✅ Auth OK → go to events page
          navigate("/user/tickets");
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
      <p>Đang đăng nhập với user...</p>
    </div>
  );
};

export default TestToUserTicket;

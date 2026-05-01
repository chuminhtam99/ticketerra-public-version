import React, { useEffect, useState } from "react";
import "./MyTicketPage.css";
import { axiosInstance } from "../../lib/axios";
import { Link } from "react-router-dom";
import Header from "../modules/Header";

const MyTicketPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const { data } = await axiosInstance.get("/booking/user/tickets");
        console.log(data);

        setTickets(data.tickets);
      } catch (error) {
        console.error("Error fetching tickets:", error);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  return (
    <>
      <Header></Header>
      <div className="container">
        <div className="sidebar">
          <h2>Tài khoản </h2>
          <ul>
            <li>Cài đặt tài khoản</li>
            <li>
              <Link
                to="/user/my-account"
                style={{ textDecoration: "none", color: "#ffffff" }}
              >
                Thông tin tài khoản
              </Link>
            </li>
            <li>
              <strong>Vé của tôi</strong>
            </li>
            <li>Sự kiện của tôi</li>
          </ul>
        </div>
        <div className="main">
          <h1>Vé của tôi</h1>
          {loading ? (
            <p>Đang tải vé...</p>
          ) : tickets.length > 0 ? (
            <table border="1" cellPadding="8" className="ticket-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Ticket Name</th>
                  <th>Price (VND)</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Purchase Date</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket, index) => (
                  <tr key={index}>
                    <td>
                      <Link
                        style={{ textDecoration: "none", color: "#ffffff" }}
                        to={`/event/${ticket.eventId}`}
                      >
                        {ticket.eventName}
                      </Link>
                    </td>
                    <td>{ticket.ticketName}</td>
                    <td>{ticket.ticketPrice}</td>
                    <td>{ticket.quantity}</td>
                    <td>{ticket.status}</td>
                    <td>{new Date(ticket.purchaseDate).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="content">
              <img
                src="https://via.placeholder.com/300x200.png?text=Sunset+Illustration"
                alt="Sunset Illustration"
              />
              <p>Bạn chưa có vé nào</p>
              <a href="/" className="btn">
                Mua vé ngay
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MyTicketPage;

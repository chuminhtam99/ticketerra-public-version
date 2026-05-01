import React from "react";
import { Routes, Route } from "react-router-dom";

// styles
import "../utilities.css";
import "./App.css";

// components & pages
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CreateEventPage from "./pages/CreateEventPage";
import MyTicketPage from "./pages/MyTicketPage";
import TestCreatingEvent from "./pages/TestCreatingEvent";
import AccountPage from "./pages/AccountPage";
import TestToUserTicket from "./pages/TestToUserTicket";
import EventPage from "./pages/EventPage";
import RealtimeEventDetails from "./pages/RealtimeEventDetails";
import PaymentPage from "./pages/PaymentPage";
import PaymentDonePage from "./pages/PaymentDonePage";
import PaymentFailPage from "./pages/PaymentFailPage";
import PaymentResult from "./pages/PaymentResult";
import SearchResultsPage from "./pages/SearchResultsPage";
import MyEventPage from "./pages/MyEventPage";
import PaymentErr from "./pages/PaymentErr";

const App = () => {
  return (
    // <RealtimeEventDetails></RealtimeEventDetails>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/admin/events/test" element={<TestCreatingEvent />} />
      <Route path="/admin/events" element={<CreateEventPage />} />
      <Route path="/admin/my-event" element={<MyEventPage />} />
      <Route path="/user/tickets/test" element={<TestToUserTicket />} />
      <Route path="/user/tickets" element={<MyTicketPage />} />
      <Route path="/user/my-account" element={<AccountPage />} />
      <Route path="/event/seats/:eventId" element={<RealtimeEventDetails />} />
      <Route path="/event/:eventId" element={<EventPage />} />
      <Route path="/payment/:orderId" element={<PaymentPage />} />
      <Route path="/payment-done" element={<PaymentDonePage />} />
      <Route path="/payment-fail" element={<PaymentFailPage />} />
      <Route path="/payment-result/:orderId" element={<PaymentResult />} />
      <Route path="/search" element={<SearchResultsPage />} />{" "}
      <Route path="/payment-err" element={<PaymentErr />} />{" "}
    </Routes>
  );
};

export default App;

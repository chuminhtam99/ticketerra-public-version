import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { axiosInstance } from "../../lib/axios";
import EventItemCard from "../modules/EventItemCard";

const SearchResultsPage = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const nameQuery = params.get("name");
  const categoryQuery = params.get("category");

  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        let url = "/events/search?";
        if (nameQuery) {
          url += `name=${encodeURIComponent(nameQuery)}`;
        } else if (categoryQuery) {
          url += `category=${encodeURIComponent(categoryQuery)}`;
        }

        const { data } = await axiosInstance.get(url);
        // If backend returns an array directly:
        setEvents(Array.isArray(data) ? data : data.events || []);
      } catch (err) {
        console.error("Error fetching events:", err);
        setEvents([]);
      }
    };

    fetchEvents();
  }, [nameQuery, categoryQuery]);

  return (
    <div className="search-results-grid">
      <EventItemCard events={events} />
    </div>
  );
};

export default SearchResultsPage;

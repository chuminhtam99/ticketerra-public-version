import axios from "axios";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:3000/v1" : "/v1";

export const axiosInstance = axios.create({ 
  baseURL: BASE_URL,
  withCredentials: true, // tells Axios to include cookies with every request.

});

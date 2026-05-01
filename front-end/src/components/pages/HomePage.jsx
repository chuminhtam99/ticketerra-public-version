import Header from "../modules/Header";
import BannerSection from "../modules/BannerSection";
import SpecialEvent from "../modules/SpecialEvent";
import TrendingEvent from "../modules/TrendingEvent";
import ForYou from "../modules/ForYou";
import LatestEvent from "../modules/LatestEvent";
import Footer from "../modules/Footer";
import { useEffect } from "react";

const HomePage = () => {
  // useEffect(() => {
  //   console.log(document.cookie);
  // });

  return (
    <>
      <Header />
      <BannerSection />
      <SpecialEvent></SpecialEvent>
      <TrendingEvent />
      <ForYou></ForYou>
      <LatestEvent></LatestEvent>
      <Footer></Footer>
    </>
  );
};

export default HomePage;

const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: {
    type: Number,
    required: true,
    max: 500000000,
  },
  quantity: { type: Number, required: true },
  minOrder: { type: Number },
  desc: { type: String },
  image: { type: String },
  soldOut: {
    type: String,
    enum: ["true", "false"],
    default: "false",
  },
});

const SessionSchema = new mongoose.Schema({
  eventDate: { type: Date, required: true },
  startBookingTime: { type: Date, required: true },
  startTime: { type: Date, required: true },
  tickets: [TicketSchema],
});

const PaymentSchema = new mongoose.Schema({
  accountOwner: { type: String, required: true },
  accountNumber: { type: String, required: true },
  bankName: { type: String, required: true },
  branch: { type: String, required: true },
});

const EventSchema = new mongoose.Schema(
  {
    backgroundImage: { type: String, default: "null" },
    eventImage: { type: String, default: "null" },
    onAd: { type: String, required: false },
    isSpecial: { type: String, required: false },

    // Step 1: General info
    eventName: { type: String, required: true },
    eventAddress: { type: String, required: true },
    eventType: {
      type: String,
      enum: ["offline", "online"],
      default: "offline",
    },
    venueName: { type: String },
    category: {
      type: String,
      enum: [
        "Nhạc sống & Concert",
        "Sân khấu & Nghệ thuật",
        "Thể Thao",
        "Hội thảo & Workshop",
        "Tham quan & Trải nghiệm",
        "Khác",
      ],
    },
    eventDesc: { type: String },
    organizerName: { type: String },
    organizerInfo: { type: String },

    // Step 2: Sessions & tickets
    sessions: [SessionSchema],

    // Step 3: Settings
    customUrl: { type: String, maxlength: 80 },
    confirmationMsg: {
      type: String,
      maxlength: 500,
      default: "Chúc bạn có trải nghiệm tuyệt vời!",
    },

    // Step 4: Payment info
    paymentInfo: PaymentSchema,

    numberOfClick: { type: Number, default: 1 },

    // Computed fields
    earliestDate: { type: Date },
    lowestPrice: { type: Number },
    lastDate: { type: Date },
  },
  { timestamps: true },
);

// Text index
EventSchema.index({ eventName: "text", eventDesc: "text" });

// Pre-save hook to compute earliestDate, lastDate and lowestPrice
EventSchema.pre("save", async function () {
  if (this.sessions && this.sessions.length > 0) {
    // Find earliest eventDate
    const allDates = this.sessions
      .map((s) => s.eventDate)
      .filter((d) => d != null);

    if (allDates.length > 0) {
      this.earliestDate = new Date(
        Math.min(...allDates.map((d) => d.getTime())),
      );
      this.lastDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    }

    // Find lowest ticket price
    const allPrices = [];
    this.sessions.forEach((s) => {
      if (s.tickets && s.tickets.length > 0) {
        s.tickets.forEach((t) => {
          if (t.price != null) {
            allPrices.push(t.price);
          }
        });
      }
    });
    if (allPrices.length > 0) {
      this.lowestPrice = Math.min(...allPrices);
    }
  }
});

module.exports = mongoose.model("Event", EventSchema);

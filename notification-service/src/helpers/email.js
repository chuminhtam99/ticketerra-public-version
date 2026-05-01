const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail", // or use SMTP host/port
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOrderConfirmationEmail(user, order, event, items) {
  console.log("111111");
  console.log(event);

  const ticketSummary = items
    .map((item) => {
      // Format date and time in Vietnam local time
      const formattedDate = new Date(item.sessionDate).toLocaleDateString(
        "vi-VN",
        {
          timeZone: "Asia/Ho_Chi_Minh",
        },
      );

      const formattedTime = new Date(item.sessionDate).toLocaleTimeString(
        "vi-VN",
        {
          timeZone: "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
      );

      return `<li>${item.ticketName} x${item.quantity} — ${item.ticketPrice} VND/vé - Ngày ${formattedDate}, ${formattedTime}</li>`;
    })

    .join("");

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: `Xác nhận đơn hàng đã mua tại Ticketerra`,
    html: `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
      <div style="background: #4CAF50; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Cảm ơn bạn đã mua vé của Ticketerra!</h2>
      </div>
      <div style="padding: 20px;">
        <p>Đơn hàng số <strong style="color:#4CAF50;">${order.order_id}</strong> đã được <strong>thanh toán thành công</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px; font-weight: bold;">Sự kiện:</td>
            <td style="padding: 8px;">${event.eventName}</td>
          </tr>
          <tr style="background: #f9f9f9;">
            <td style="padding: 8px; font-weight: bold;">Địa điểm:</td>
            <td style="padding: 8px;">${event.eventAddress}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Tổng tiền:</td>
            <td style="padding: 8px; color: #E53935; font-weight: bold;">${order.totalPrice} VND</td>
          </tr>
        </table>

        <h3 style="margin-top: 20px; color: #4CAF50;">🎫 Vé đã mua:</h3>
        <ul style="padding-left: 20px; margin: 0;">${ticketSummary}</ul>

        <p style="margin-top: 20px; font-style: italic; color: #555;">
          ${event.confirmationMsg || "Chúc bạn có trải nghiệm tuyệt vời!"}
        </p>
      </div>
      <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #777;">
        Ticketerra © ${new Date().getFullYear()} — Đây là email tự động, vui lòng không trả lời.
      </div>
    </div>
  `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    console.log("Preview URL:", nodemailer.getTestMessageUrl(info)); // only works with Ethereal test accounts
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

module.exports = { sendOrderConfirmationEmail };

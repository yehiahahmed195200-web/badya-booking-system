package com.badya.booking.service;

import com.badya.booking.model.Booking;
import com.badya.booking.model.Notification;
import com.badya.booking.model.NotificationType;
import com.badya.booking.model.SystemRule;
import com.badya.booking.model.UserAccount;
import com.badya.booking.model.UserRole;
import com.badya.booking.repository.NotificationRepository;
import com.badya.booking.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SystemRuleService systemRuleService;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    public NotificationService(NotificationRepository notificationRepository, UserRepository userRepository, SystemRuleService systemRuleService) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.systemRuleService = systemRuleService;
    }

    private boolean isEmailEnabledGlobally() {
        SystemRule rules = systemRuleService.getCurrentRules();
        return Boolean.TRUE.equals(rules.getGlobalEmailNotificationsEnabled());
    }

    public void sendInAppNotification(UserAccount user, String title, String message, NotificationType type) {
        if (user == null) return;
        Notification n = new Notification();
        n.setUser(user);
        n.setTitle(title);
        n.setMessage(message);
        n.setType(type);
        n.setRead(false);
        n.setCreatedAt(LocalDateTime.now());
        notificationRepository.save(n);
    }

    public void sendBookingConfirmed(Booking booking, boolean notifyCoach, boolean notifyAdmins, boolean sendEmail) {
        String title = "Booking Confirmed";
        String message = "Your booking for " + booking.getFacility().getName() + " at " + booking.getStartTime() + " is confirmed. Booking ID: " + booking.getId();
        sendInAppNotification(booking.getUser(), title, message, NotificationType.BOOKING_CONFIRMED);

        if (sendEmail && isEmailEnabledGlobally() && mailSender != null && booking.getUser().isEmailNotificationsEnabled()) {
            sendEmail(booking.getUser().getEmail(), title, message);
        }

        if (notifyAdmins) {
            List<UserAccount> admins = userRepository.findAll().stream()
                    .filter(u -> u.getRole() == UserRole.ADMIN)
                    .toList();
            for (UserAccount admin : admins) {
                sendInAppNotification(admin, "New booking created", "Booking " + booking.getId() + " by " + booking.getUser().getFullName(), NotificationType.SYSTEM_ALERT);
                if (sendEmail && isEmailEnabledGlobally() && mailSender != null && admin.isEmailNotificationsEnabled()) {
                    sendEmail(admin.getEmail(), "New booking created", "Booking " + booking.getId() + " by " + booking.getUser().getFullName());
                }
            }
        }

        if (notifyCoach) {
            List<UserAccount> coaches = userRepository.findAll().stream()
                    .filter(u -> u.getRole() == UserRole.COACH)
                    .toList();
            for (UserAccount coach : coaches) {
                sendInAppNotification(coach, "New booking (coach) ", "Booking " + booking.getId() + " for " + booking.getFacility().getName(), NotificationType.SYSTEM_ALERT);
                if (sendEmail && isEmailEnabledGlobally() && mailSender != null && coach.isEmailNotificationsEnabled()) {
                    sendEmail(coach.getEmail(), "New booking", "Booking " + booking.getId() + " for " + booking.getFacility().getName());
                }
            }
        }
    }

    public void sendBookingCancelled(Booking booking, boolean sendEmail) {
        String title = "Booking Cancelled";
        String message = "Your booking for " + booking.getFacility().getName() + " at " + booking.getStartTime() + " was cancelled.";
        sendInAppNotification(booking.getUser(), title, message, NotificationType.BOOKING_CANCELLED);
        if (sendEmail && isEmailEnabledGlobally() && mailSender != null && booking.getUser().isEmailNotificationsEnabled()) {
            sendEmail(booking.getUser().getEmail(), title, message);
        }
    }

    public void sendBookingReminder(Booking booking, boolean sendEmail) {
        String title = "Upcoming Booking Reminder";
        String message = "Reminder: your booking for " + booking.getFacility().getName() + " starts at " + booking.getStartTime();
        sendInAppNotification(booking.getUser(), title, message, NotificationType.BOOKING_REMINDER);
        if (sendEmail && isEmailEnabledGlobally() && mailSender != null && booking.getUser().isEmailNotificationsEnabled()) {
            sendEmail(booking.getUser().getEmail(), title, message);
        }
    }

    /**
     * FR-7.3, FR-7.4, FR-7.5: Notify a user and admins about an unresolved booking conflict.
     */
    public void sendConflictAlert(Booking booking, boolean sendEmail) {
        String userTitle = "⚠️ Booking Conflict Detected";
        String userMsg = "Your booking request for " + booking.getFacility().getName() + " at " + booking.getStartTime() +
                " overlaps with an existing reservation. An administrator has been notified to resolve the conflict.";
        sendInAppNotification(booking.getUser(), userTitle, userMsg, NotificationType.SYSTEM_ALERT);
        
        if (sendEmail && isEmailEnabledGlobally() && mailSender != null && booking.getUser().isEmailNotificationsEnabled()) {
            sendEmail(booking.getUser().getEmail(), userTitle, userMsg);
        }

        // Notify admins about the unresolved conflict (FR-7.5)
        List<UserAccount> admins = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.ADMIN)
                .toList();
        for (UserAccount admin : admins) {
            String adminTitle = "🚨 Unresolved Booking Conflict";
            String adminMsg = "Conflict detected! Booking #" + booking.getId() + " by " + booking.getUser().getFullName() +
                    " overlaps on " + booking.getFacility().getName() + " at " + booking.getStartTime() + ". Action required to resolve.";
            sendInAppNotification(admin, adminTitle, adminMsg, NotificationType.SYSTEM_ALERT);
            if (sendEmail && isEmailEnabledGlobally() && mailSender != null && admin.isEmailNotificationsEnabled()) {
                sendEmail(admin.getEmail(), adminTitle, adminMsg);
            }
        }
    }

    /**
     * FR-7.4: Send a booking rejection notification with a custom reason.
     */
    public void sendRejectionNotification(Booking booking, String reason, boolean sendEmail) {
        String title = "❌ Booking Rejected";
        String message = "Your booking for " + booking.getFacility().getName() + " at " + booking.getStartTime() +
                " was rejected by an administrator. Reason: " + reason;
        sendInAppNotification(booking.getUser(), title, message, NotificationType.BOOKING_CANCELLED);
        
        if (sendEmail && isEmailEnabledGlobally() && mailSender != null && booking.getUser().isEmailNotificationsEnabled()) {
            sendEmail(booking.getUser().getEmail(), title, message);
        }
    }

    /**
     * FR-7.4: Send a ban notification with a reason.
     */
    public void sendBanNotification(UserAccount user, String reason, boolean sendEmail) {
        String title = "🔒 Account Banned";
        String message = "Your account has been banned due to disciplinary issues. Reason: " + reason +
                ". If you believe this is an error, please contact university athletic support.";
        sendInAppNotification(user, title, message, NotificationType.SYSTEM_ALERT);
        
        if (sendEmail && isEmailEnabledGlobally() && mailSender != null && user.isEmailNotificationsEnabled()) {
            sendEmail(user.getEmail(), title, message);
        }
    }

    /**
     * FR-7.3: Send a time change / rescheduling notification.
     */
    public void sendTimeChangeNotification(Booking booking, java.time.LocalDateTime oldStartTime, boolean sendEmail) {
        String title = "🕐 Booking Schedule Changed";
        String message = "Your booking for " + booking.getFacility().getName() + " has been rescheduled from " +
                oldStartTime + " to a new time: " + booking.getStartTime() + ".";
        sendInAppNotification(booking.getUser(), title, message, NotificationType.BOOKING_CONFIRMED);
        
        if (sendEmail && isEmailEnabledGlobally() && mailSender != null && booking.getUser().isEmailNotificationsEnabled()) {
            sendEmail(booking.getUser().getEmail(), title, message);
        }
    }

    public void sendOtp(UserAccount user, String otp) {
        String title = "🔑 كود التأكيد للدخول السريع - جامعة باديا";
        String message = "مرحباً " + user.getFullName() + ",\n\n" +
                "كود التأكيد الخاص بك للدخول وتوثيق جهازك الجديد هو: " + otp + "\n" +
                "صلاحية هذا الكود هي 5 دقائق فقط.\n\n" +
                "تنبيه: الدخول من هذا الجهاز سيؤدي إلى إلغاء ربط جهازك القديم تلقائياً وبدء جلسة جديدة.\n\n" +
                "إذا لم تكن أنت من طلب هذا الكود، يرجى تجاهل هذه الرسالة.";
        
        // Print OTP to terminal console for easy testing and debugging
        System.out.println("\n==================================================================");
        System.out.println("🔑 [BADYA BOOKING SYSTEM] كود تأكيد الدخول السريع (OTP)");
        System.out.println("👤 الطالب: " + user.getFullName() + " (الرقم الجامعي: " + user.getStudentId() + ")");
        System.out.println("📧 البريد الإلكتروني: " + user.getEmail());
        System.out.println("🔢 كود التفعيل: " + otp);
        System.out.println("==================================================================\n");

        sendInAppNotification(user, "OTP Verification Sent", "An OTP verification email has been sent.", NotificationType.SYSTEM_ALERT);
        if (mailSender != null) {
            sendEmail(user.getEmail(), title, message);
        } else {
            System.err.println("⚠️ [SMTP Warning] JavaMailSender is not initialized or null! Check your spring.mail properties.");
        }
    }

    public void sendEmail(String to, String subject, String body) {
        new Thread(() -> {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setTo(to);
                msg.setSubject(subject);
                msg.setText(body);
                mailSender.send(msg);
                System.out.println("✅ Email sent successfully to: " + to);
            } catch (Exception ex) {
                System.err.println("❌ Email send failed to " + to + ": " + ex.getMessage());
                System.err.println("💡 Note: Google SMTP requires an 'App Password' if 2FA is enabled. Personal passwords will be blocked.");
            }
        }).start();
    }
}

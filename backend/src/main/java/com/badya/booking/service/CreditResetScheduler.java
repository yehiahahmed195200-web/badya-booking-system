package com.badya.booking.service;

import com.badya.booking.model.UserAccount;
import com.badya.booking.model.UserRole;
import com.badya.booking.repository.UserRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CreditResetScheduler {

    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    public CreditResetScheduler(UserRepository userRepository, AuditLogService auditLogService) {
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
    }

    /**
     * Weekly replenishment/reset of student credits back to their default allowance (10).
     * Runs every Sunday at midnight (00:00).
     */
    @Scheduled(cron = "0 0 0 * * SUN")
    @Transactional
    public void resetAllCreditsScheduled() {
        System.out.println("[CreditResetScheduler] Running scheduled weekly credits replenishment...");
        replenishAllStudentCredits(null); // System trigger (no explicit admin)
    }

    /**
     * Replenish credits for all students back to the default of 10.
     */
    @Transactional
    public int replenishAllStudentCredits(UserAccount triggerAdmin) {
        List<UserAccount> students = userRepository.findByRole(UserRole.STUDENT);
        int updatedCount = 0;
        for (UserAccount student : students) {
            // Reset back to weekly default of 10 if not already 10
            if (student.getCredits() == null || student.getCredits() != 10) {
                student.setCredits(10);
                userRepository.save(student);
                updatedCount++;
            }
        }

        if (triggerAdmin != null) {
            auditLogService.log(triggerAdmin, "SYSTEM_CREDITS_REPLENISHED", 
                java.util.Map.of(
                    "message", "Manually triggered bulk replenishment of student credits to default allowance (10)",
                    "updatedUsersCount", updatedCount
                )
            );
        }

        System.out.println("[CreditResetScheduler] Replenished " + updatedCount + " students to default credits (10).");
        return updatedCount;
    }
}

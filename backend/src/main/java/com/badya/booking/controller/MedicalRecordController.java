package com.badya.booking.controller;

import com.badya.booking.model.MedicalRecord;
import com.badya.booking.model.UserAccount;
import com.badya.booking.model.UserRole;
import com.badya.booking.repository.MedicalRecordRepository;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.service.AuditLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/medical-records")
public class MedicalRecordController {

    @Autowired
    private MedicalRecordRepository medicalRecordRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogService auditLogService;

    /**
     * Get medical history for a student athlete.
     * Authorized: The student themselves, COACH, or ADMIN.
     * Access by COACH/ADMIN is logged.
     */
    @GetMapping("/student/{studentId}")
    public ResponseEntity<?> getStudentHistory(
            @PathVariable Long studentId,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {
        try {
            UserAccount currentUser = getAuthenticatedUser(authHeader);
            
            // Authorization Check
            boolean isSelf = currentUser.getId().equals(studentId);
            boolean isStaff = currentUser.getRole() == UserRole.COACH || currentUser.getRole() == UserRole.ADMIN;
            
            if (!isSelf && !isStaff) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "message", "Access denied. Insufficient permissions."
                ));
            }

            UserAccount student = userRepository.findById(studentId)
                    .orElseThrow(() -> new IllegalArgumentException("Student not found"));

            List<MedicalRecord> records = medicalRecordRepository.findByUserIdOrderByCreatedAtDesc(studentId);

            // Log staff access to medical records
            if (isStaff && !isSelf) {
                auditLogService.log(currentUser, "MEDICAL_RECORD_VIEWED", Map.of(
                    "targetStudentId", studentId,
                    "targetStudentName", student.getFullName(),
                    "accessedBy", currentUser.getFullName(),
                    "role", currentUser.getRole().name()
                ));
            }

            return ResponseEntity.ok(records);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "message", "An error occurred: " + e.getMessage()
            ));
        }
    }

    /**
     * Submit a new medical clearance document.
     * Authorized: The student themselves, COACH, or ADMIN.
     */
    @PostMapping("/student/{studentId}")
    public ResponseEntity<?> addMedicalRecord(
            @PathVariable Long studentId,
            @RequestBody Map<String, String> body,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {
        try {
            UserAccount currentUser = getAuthenticatedUser(authHeader);
            
            // Authorization Check
            boolean isSelf = currentUser.getId().equals(studentId);
            boolean isStaff = currentUser.getRole() == UserRole.COACH || currentUser.getRole() == UserRole.ADMIN;
            
            if (!isSelf && !isStaff) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "message", "Access denied. Insufficient permissions."
                ));
            }

            UserAccount student = userRepository.findById(studentId)
                    .orElseThrow(() -> new IllegalArgumentException("Student not found"));

            String documentName = body.get("documentName");
            String documentUrl = body.get("documentUrl");
            String description = body.get("description");

            if (documentName == null || documentName.trim().isEmpty() ||
                documentUrl == null || documentUrl.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Document name and URL/path are required."
                ));
            }

            MedicalRecord record = new MedicalRecord();
            record.setUser(student);
            record.setDocumentName(documentName);
            record.setDocumentUrl(documentUrl);
            record.setDescription(description);
            record.setCreatedAt(LocalDateTime.now());

            if (isStaff) {
                record.setSubmittedBy(currentUser.getRole().name());
                // Staff uploads are auto-approved
                record.setStatus("APPROVED");
            } else {
                record.setSubmittedBy("STUDENT");
                record.setStatus("PENDING");
            }

            MedicalRecord saved = medicalRecordRepository.save(record);

            // Audit Log
            auditLogService.log(currentUser, "MEDICAL_RECORD_UPLOADED", Map.of(
                "recordId", saved.getId(),
                "documentName", saved.getDocumentName(),
                "studentId", studentId,
                "studentName", student.getFullName(),
                "submittedBy", record.getSubmittedBy()
            ));

            return ResponseEntity.status(HttpStatus.CREATED).body(saved);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "message", "An error occurred: " + e.getMessage()
            ));
        }
    }

    /**
     * Approve or reject a medical clearance report.
     * Authorized: COACH or ADMIN.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateRecordStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {
        try {
            UserAccount currentUser = getAuthenticatedUser(authHeader);
            
            // Authorization Check
            if (currentUser.getRole() != UserRole.COACH && currentUser.getRole() != UserRole.ADMIN) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "message", "Access denied. Staff only endpoint."
                ));
            }

            MedicalRecord record = medicalRecordRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Medical record not found"));

            String status = body.get("status");
            if (status == null || (!status.equals("APPROVED") && !status.equals("REJECTED") && !status.equals("PENDING"))) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Invalid status. Must be APPROVED, REJECTED, or PENDING."
                ));
            }

            record.setStatus(status);
            
            String note = body.get("note");
            if (note != null && !note.trim().isEmpty()) {
                String originalDesc = record.getDescription() != null ? record.getDescription() : "";
                record.setDescription(originalDesc + "\n[Reviewer Note: " + note + "]");
            }

            MedicalRecord updated = medicalRecordRepository.save(record);

            // Audit Log
            auditLogService.log(currentUser, "MEDICAL_RECORD_STATUS_CHANGED", Map.of(
                "recordId", updated.getId(),
                "documentName", updated.getDocumentName(),
                "newStatus", status,
                "studentId", updated.getUser().getId(),
                "studentName", updated.getUser().getFullName(),
                "reviewNote", note != null ? note : "N/A"
            ));

            return ResponseEntity.ok(updated);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "message", "An error occurred: " + e.getMessage()
            ));
        }
    }

    /**
     * Get medical compliance status summary for all student athletes.
     * Authorized: COACH or ADMIN.
     */
    @GetMapping("/staff/all-athletes")
    public ResponseEntity<?> getAllAthletesCompliance(
            @RequestHeader(name = "Authorization", required = false) String authHeader) {
        try {
            UserAccount currentUser = getAuthenticatedUser(authHeader);
            
            // Authorization Check
            if (currentUser.getRole() != UserRole.COACH && currentUser.getRole() != UserRole.ADMIN) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "message", "Access denied. Staff only endpoint."
                ));
            }

            List<UserAccount> students = userRepository.findByRole(UserRole.STUDENT);
            List<Map<String, Object>> athletes = new ArrayList<>();

            for (UserAccount student : students) {
                List<MedicalRecord> records = medicalRecordRepository.findByUserIdOrderByCreatedAtDesc(student.getId());
                
                String complianceStatus = "NON_COMPLIANT";
                LocalDateTime lastUpdated = null;

                if (!records.isEmpty()) {
                    lastUpdated = records.get(0).getCreatedAt();
                    
                    // Determine status based on highest precedence: APPROVED > PENDING > REJECTED
                    boolean hasApproved = false;
                    boolean hasPending = false;

                    for (MedicalRecord r : records) {
                        if (r.getStatus().equals("APPROVED")) {
                            hasApproved = true;
                            break; // Compliant wins instantly
                        } else if (r.getStatus().equals("PENDING")) {
                            hasPending = true;
                        }
                    }

                    if (hasApproved) {
                        complianceStatus = "COMPLIANT";
                    } else if (hasPending) {
                        complianceStatus = "PENDING_REVIEW";
                    } else {
                        complianceStatus = "NON_COMPLIANT";
                    }
                }

                Map<String, Object> athleteMap = new HashMap<>();
                athleteMap.put("userId", student.getId());
                athleteMap.put("fullName", student.getFullName());
                athleteMap.put("studentId", student.getEmail().split("@")[0]); // or get studentId if mapped, wait studentId might not be mapped in UserAccount directly so use email prefix or default
                athleteMap.put("email", student.getEmail());
                athleteMap.put("complianceStatus", complianceStatus);
                athleteMap.put("lastUpdated", lastUpdated);
                athleteMap.put("recordsCount", records.size());

                athletes.add(athleteMap);
            }

            // Audit Log
            auditLogService.log(currentUser, "MEDICAL_RECORD_VIEWED_ALL", Map.of(
                "accessedBy", currentUser.getFullName(),
                "role", currentUser.getRole().name()
            ));

            return ResponseEntity.ok(athletes);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "message", "An error occurred: " + e.getMessage()
            ));
        }
    }

    /**
     * Simple token verification and user loading.
     */
    private UserAccount getAuthenticatedUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Unauthorized: Missing bearer token.");
        }
        String token = authHeader.replace("Bearer ", "").trim();
        if (!token.startsWith("demo-token-")) {
            throw new IllegalArgumentException("Unauthorized: Invalid token format.");
        }
        try {
            Long userId = Long.parseLong(token.replace("demo-token-", ""));
            return userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("Unauthorized: User not found."));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Unauthorized: Invalid token signature.");
        }
    }
}

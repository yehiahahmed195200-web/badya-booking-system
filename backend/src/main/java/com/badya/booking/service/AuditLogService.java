package com.badya.booking.service;

import com.badya.booking.model.AuditLog;
import com.badya.booking.model.UserAccount;
import com.badya.booking.repository.AuditLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AuditLogService {
    @Autowired
    private AuditLogRepository auditLogRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Log an admin action with details
     */
    public AuditLog log(UserAccount admin, String action, Map<String, Object> details) {
        AuditLog auditLog = new AuditLog();
        auditLog.setAdmin(admin);
        auditLog.setAction(action);
        auditLog.setCreatedAt(LocalDateTime.now());

        try {
            auditLog.setDetails(objectMapper.writeValueAsString(details));
        } catch (Exception e) {
            auditLog.setDetails("{}");
        }

        // Capture request info
        try {
            ServletRequestAttributes requestAttributes =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (requestAttributes != null) {
                HttpServletRequest request = requestAttributes.getRequest();
                auditLog.setIpAddress(getClientIpAddress(request));
                auditLog.setUserAgent(request.getHeader("User-Agent"));
            }
        } catch (Exception e) {
            // Ignore if not in HTTP context
        }

        return auditLogRepository.save(auditLog);
    }

    /**
     * Convenience method for logging
     */
    public void log(UserAccount admin, String action, String key, Object value) {
        Map<String, Object> details = new HashMap<>();
        details.put(key, value);
        log(admin, action, details);
    }

    /**
     * Get all audit logs (paginated)
     */
    public Page<AuditLog> getAllLogs(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    /**
     * Get audit logs by admin
     */
    public Page<AuditLog> getLogsByAdmin(UserAccount admin, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return auditLogRepository.findByAdminOrderByCreatedAtDesc(admin, pageable);
    }

    /**
     * Get audit logs by action
     */
    public Page<AuditLog> getLogsByAction(String action, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return auditLogRepository.findByActionOrderByCreatedAtDesc(action, pageable);
    }

    /**
     * Get audit logs within date range
     */
    public List<AuditLog> getLogsByDateRange(LocalDateTime start, LocalDateTime end) {
        return auditLogRepository.findByCreatedAtBetween(start, end);
    }

    /**
     * Extract client IP address
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String[] headers = {"X-Forwarded-For", "Proxy-Client-IP", "WL-Proxy-Client-IP", "HTTP_CLIENT_IP", "HTTP_X_FORWARDED_FOR"};
        String ip = null;

        for (String header : headers) {
            ip = request.getHeader(header);
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                return ip.split(",")[0].trim();
            }
        }

        if (ip == null || ip.isEmpty()) {
            ip = request.getRemoteAddr();
        }

        return ip;
    }
}

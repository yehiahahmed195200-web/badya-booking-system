package com.badya.booking.repository;

import com.badya.booking.model.UserAccount;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByEmail(String email);
    Optional<UserAccount> findByBarcode(String barcode);
    Optional<UserAccount> findByStudentId(String studentId);
    Optional<UserAccount> findByDeviceId(String deviceId);
    java.util.List<UserAccount> findByRole(com.badya.booking.model.UserRole role);
}

package com.badya.booking.repository;

import com.badya.booking.model.Notification;
import com.badya.booking.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserOrderByCreatedAtDesc(UserAccount user);
    List<Notification> findByUserAndReadFalse(UserAccount user);
}

package com.badya.booking.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(1) // Run before DataSeeder
public class DatabaseSchemaInitializer implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    public DatabaseSchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
        System.out.println("Running database schema synchronization...");

        try {
            // 1. Alter 'users' to add 'reserved_credits' if it doesn't exist
            try {
                jdbcTemplate.execute("SELECT reserved_credits FROM users LIMIT 1");
                System.out.println("users.reserved_credits column already exists.");
            } catch (Exception e) {
                System.out.println("Adding users.reserved_credits column...");
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN reserved_credits INT NOT NULL DEFAULT 0");
            }

            // 2. Alter 'bookings' to add 'expiry_time' if it doesn't exist
            try {
                jdbcTemplate.execute("SELECT expiry_time FROM bookings LIMIT 1");
                System.out.println("bookings.expiry_time column already exists.");
            } catch (Exception e) {
                System.out.println("Adding bookings.expiry_time column...");
                jdbcTemplate.execute("ALTER TABLE bookings ADD COLUMN expiry_time DATETIME NULL");
            }

            // 3. Modify 'bookings.status' column to be VARCHAR(50) instead of Enum to support RESERVED_PENDING_PLAYERS
            try {
                System.out.println("Ensuring bookings.status column supports all statuses by changing to VARCHAR(50)...");
                jdbcTemplate.execute("ALTER TABLE bookings MODIFY COLUMN status VARCHAR(50) NOT NULL");
            } catch (Exception e) {
                System.err.println("Failed to modify bookings.status: " + e.getMessage());
            }

            // 4. Create 'booking_participants' table if not exists
            try {
                System.out.println("Ensuring booking_participants table exists...");
                jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS booking_participants (" +
                        "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                        "booking_id BIGINT NOT NULL," +
                        "user_id BIGINT NOT NULL," +
                        "team VARCHAR(50) NOT NULL DEFAULT 'A'," +
                        "status VARCHAR(50) NOT NULL DEFAULT 'PENDING'," +
                        "CONSTRAINT fk_bp_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE," +
                        "CONSTRAINT fk_bp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE," +
                        "UNIQUE KEY uq_bp_booking_user (booking_id, user_id)" +
                        ")");
            } catch (Exception e) {
                System.err.println("Failed to create booking_participants table: " + e.getMessage());
            }

            // 5. Create 'booking_events' table if not exists
            try {
                System.out.println("Ensuring booking_events table exists...");
                jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS booking_events (" +
                        "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                        "booking_id BIGINT NOT NULL," +
                        "user_id BIGINT NULL," +
                        "event_type VARCHAR(255) NOT NULL," +
                        "details TEXT NULL," +
                        "created_at DATETIME NOT NULL" +
                        ")");
            } catch (Exception e) {
                System.err.println("Failed to create booking_events table: " + e.getMessage());
            }

            System.out.println("Database schema synchronization complete!");

        } catch (Exception ex) {
            System.err.println("Database schema synchronization error: " + ex.getMessage());
        }
    }
}

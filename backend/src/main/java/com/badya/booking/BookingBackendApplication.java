package com.badya.booking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BookingBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(BookingBackendApplication.class, args);
    }
}

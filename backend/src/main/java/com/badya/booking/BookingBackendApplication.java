package com.badya.booking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class BookingBackendApplication {
    
    @PostConstruct
    public void init() {
        TimeZone.setDefault(TimeZone.getTimeZone("Africa/Cairo"));
    }

    public static void main(String[] args) {
        SpringApplication.run(BookingBackendApplication.class, args);
    }
}


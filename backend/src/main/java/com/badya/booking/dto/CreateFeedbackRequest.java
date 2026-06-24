package com.badya.booking.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public class CreateFeedbackRequest {
    private String content;
    private String comment;
    private Long facilityId;
    private Long bookingId;
    
    @Min(1) @Max(5)
    private Integer rating;
    private String type;

    public CreateFeedbackRequest() {}

    public String getContent() {
        return content != null ? content : comment;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Long getFacilityId() {
        return facilityId;
    }

    public void setFacilityId(Long facilityId) {
        this.facilityId = facilityId;
    }

    public Long getBookingId() {
        return bookingId;
    }

    public void setBookingId(Long bookingId) {
        this.bookingId = bookingId;
    }

    public Integer getRating() {
        return rating;
    }

    public void setRating(Integer rating) {
        this.rating = rating;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}


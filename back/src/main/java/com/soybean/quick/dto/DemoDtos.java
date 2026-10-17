package com.soybean.quick.dto;
import jakarta.validation.constraints.*;
public class DemoDtos {
 public record Progress(String id,String bookId,Integer currentDay,String completedDays,String reflection,Boolean submitted,Boolean witnessOne,Boolean witnessTwo) {}
 public record Submit(@Min(0) @Max(2) int answer,@NotBlank @Size(min=10,max=500) String reflection) {}
 public record Confirm(@Min(1) @Max(2) int witness) {}
}

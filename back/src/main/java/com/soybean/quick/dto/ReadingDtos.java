package com.soybean.quick.dto;

import jakarta.validation.constraints.*;

import java.util.List;

public final class ReadingDtos {
    private ReadingDtos() {}

    public record Config(
            int contractVersion,
            long chainId,
            String rpcUrl,
            String contractAddress,
            String explorer,
            String bookTitle) {}

    public record Book(String id, String slug, String name, String title, String author,
            String cover, String categories, String tone, String accent, Boolean challengeEnabled,
            Integer sortOrder) {}

    public record Task(int day, String title, String card, String question, List<String> options) {}

    public record Answer(@Min(0) @Max(20) int day, @Min(0) @Max(2) int answer) {}

    public record Prepare(
            @Pattern(regexp = "0x[0-9a-fA-F]{64}") @NotBlank String bookId,
            @Pattern(regexp = "[1-9][0-9]{0,18}") @NotBlank String challengeId,
            @Min(0) @Max(20) int day,
            @Pattern(regexp = "0x[0-9a-fA-F]{40}") @NotBlank String wallet,
            @Min(0) @Max(2) int answer,
            @NotBlank @Size(min = 10, max = 500) String reflection) {}

    public record Confirm(
            @Pattern(regexp = "0x[0-9a-fA-F]{64}") @NotBlank String contentHash,
            @Pattern(regexp = "0x[0-9a-fA-F]{130}") @NotBlank String signature) {}

    public record Submission(
            String contentHash,
            String bookId,
            String contractAddress,
            Integer answer,
            String wallet,
            String challengeId,
            Integer day,
            String reflection,
            String signingMessage,
            Long expiresAt,
            String signature) {}
}

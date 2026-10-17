package com.soybean.quick.entity;

import com.baomidou.mybatisplus.annotation.*;

import lombok.Data;

@Data
@TableName("reading_submissions")
public class ReadingSubmission {
    @TableId(type = IdType.INPUT)
    private String contentHash;

    private String wallet;
    private String bookId;
    private String contractAddress;
    private Integer answer;
    private String challengeId;
    private Integer readingDay;
    private String reflection;
    private String signingMessage;
    private Long expiresAt;
    private String signature;
}

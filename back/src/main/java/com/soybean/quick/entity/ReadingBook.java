package com.soybean.quick.entity;
import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
@Data
@TableName("reading_books")
public class ReadingBook {
    @TableId(type = IdType.INPUT)
    private String id;
    private String slug;
    private String name;
    private String title;
    private String author;
    private String cover;
    private String categories;
    private String tone;
    private String accent;
    private Boolean challengeEnabled;
    private Integer sortOrder;
    private Boolean catalogVisible;
}

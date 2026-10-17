package com.soybean.quick.entity;
import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
@Data
@TableName("reading_demos")
public class ReadingDemo {
 @TableId(type=IdType.INPUT) private String id;
 private String bookId;
 private Integer currentDay;
 private String completedDays;
 private String reflection;
 private Boolean submitted;
 private Boolean witnessOne;
 private Boolean witnessTwo;
}

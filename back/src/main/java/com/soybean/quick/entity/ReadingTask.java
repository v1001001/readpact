package com.soybean.quick.entity;
import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
@Data
@TableName("reading_tasks")
public class ReadingTask {
    @TableId(type = IdType.INPUT)
    private String id;
    private String bookId;
    private Integer taskIndex;
    private String title;
    private String card;
    private String question;
    private String optionZero;
    private String optionOne;
    private String optionTwo;
    private Integer answer;
}

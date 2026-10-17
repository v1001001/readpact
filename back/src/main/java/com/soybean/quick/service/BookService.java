package com.soybean.quick.service;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.soybean.quick.common.ResultCode;
import com.soybean.quick.dto.ReadingDtoMapper;
import com.soybean.quick.dto.ReadingDtos;
import com.soybean.quick.entity.ReadingBook;
import com.soybean.quick.entity.ReadingTask;
import com.soybean.quick.exception.BusinessException;
import com.soybean.quick.mapper.ReadingBookMapper;
import com.soybean.quick.mapper.ReadingTaskMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
@Service
@RequiredArgsConstructor
public class BookService {
    private final ReadingBookMapper books;
    private final ReadingTaskMapper tasks;
    private final ReadingDtoMapper mapper;
    public List<ReadingDtos.Book> list() {
        return books.selectList(new QueryWrapper<ReadingBook>().eq("catalog_visible", true).orderByAsc("sort_order")).stream().map(mapper::toDto).toList();
    }
    public ReadingDtos.Book get(String id) {
        var book=books.selectById(id.toLowerCase(java.util.Locale.ROOT));
        if(book==null) throw new BusinessException(ResultCode.NOT_FOUND);
        return mapper.toDto(book);
    }
    private ReadingTask row(String bookId,int day) {
        get(bookId);
        if(day<0 || day>=21) throw new BusinessException(ResultCode.BAD_REQUEST);
        var task=tasks.selectOne(new QueryWrapper<ReadingTask>().eq("book_id",bookId.toLowerCase(java.util.Locale.ROOT)).eq("task_index",day%3));
        if(task==null) throw new BusinessException(ResultCode.NOT_FOUND);
        return task;
    }
    public ReadingDtos.Task task(String bookId,int day) {
        var row=row(bookId,day);
        return new ReadingDtos.Task(day,row.getTitle(),row.getCard(),row.getQuestion(),List.of(row.getOptionZero(),row.getOptionOne(),row.getOptionTwo()));
    }
    public void checkAnswer(String bookId,int day,int answer) {
        if(row(bookId,day).getAnswer()!=answer) throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),"请再读一次阅读卡，选择更能体现理解的分享方式");
    }
}

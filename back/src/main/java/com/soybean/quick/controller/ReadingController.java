package com.soybean.quick.controller;

import com.soybean.quick.common.Result;
import com.soybean.quick.dto.ReadingDtos;
import com.soybean.quick.service.ReadingService;
import com.soybean.quick.service.BookService;
import java.util.List;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/readpact")
@RequiredArgsConstructor
public class ReadingController {
    private final ReadingService service;
    private final BookService books;

    @GetMapping("/config")
    public Result<ReadingDtos.Config> config() {
        return Result.success(service.config());
    }

    @GetMapping("/books")
    public Result<List<ReadingDtos.Book>> books() { return Result.success(books.list()); }
    @GetMapping("/books/{bookId}/tasks/{day}")
    public Result<ReadingDtos.Task> task(@PathVariable String bookId,@PathVariable int day) {
        return Result.success(books.task(bookId,day));
    }

    @PostMapping("/books/{bookId}/answers/check")
    public Result<Boolean> checkAnswer(@PathVariable String bookId, @Valid @RequestBody ReadingDtos.Answer request) {
        books.checkAnswer(bookId,request.day(),request.answer());
        return Result.success(true);
    }

    @PostMapping("/submissions/prepare")
    public Result<ReadingDtos.Submission> prepare(@Valid @RequestBody ReadingDtos.Prepare request) {
        return Result.success(service.prepare(request));
    }

    @PostMapping("/submissions/confirm")
    public Result<ReadingDtos.Submission> confirm(@Valid @RequestBody ReadingDtos.Confirm request) {
        return Result.success(service.confirm(request));
    }

    @GetMapping("/submissions/{hash}")
    public Result<ReadingDtos.Submission> get(@PathVariable String hash) {
        return Result.success(service.get(hash));
    }
}

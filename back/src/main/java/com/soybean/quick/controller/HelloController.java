package com.soybean.quick.controller;

import com.soybean.quick.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Hello")
@RestController
@RequestMapping("/api")
public class HelloController {

    @Operation(summary = "Health check / hello")
    @GetMapping("/hello")
    public Result<String> hello() {
        return Result.success("Hello from Spring Boot!");
    }
}

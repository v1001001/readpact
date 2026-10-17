package com.soybean.quick.controller;
import com.soybean.quick.common.Result;
import com.soybean.quick.dto.DemoDtos;
import com.soybean.quick.service.DemoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/readpact/demos/algorithms")
@RequiredArgsConstructor
public class DemoController {
 private final DemoService service;
 @PostMapping("/reset") public Result<DemoDtos.Progress> reset(){return Result.success(service.reset());}
 @GetMapping public Result<DemoDtos.Progress> get(){return Result.success(service.get());}
 @PostMapping("/submit") public Result<DemoDtos.Progress> submit(@Valid @RequestBody DemoDtos.Submit request){return Result.success(service.submit(request));}
 @PostMapping("/confirm") public Result<DemoDtos.Progress> confirm(@Valid @RequestBody DemoDtos.Confirm request){return Result.success(service.confirm(request));}
}

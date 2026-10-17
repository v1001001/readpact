package com.soybean.quick.controller;

import com.soybean.quick.common.PageResult;
import com.soybean.quick.common.Result;
import com.soybean.quick.dto.UserResponse;
import com.soybean.quick.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@Tag(name = "User")
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @Operation(summary = "Current logged-in user")
    @GetMapping("/me")
    public Result<UserResponse> me(@AuthenticationPrincipal UserDetails ud) {
        return Result.success(userService.getCurrent(ud.getUsername()));
    }

    @Operation(summary = "List users (paged)")
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Result<PageResult<UserResponse>> page(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return Result.success(userService.page(page, size));
    }
}

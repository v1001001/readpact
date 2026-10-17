package com.soybean.quick.controller;

import com.soybean.quick.common.Result;
import com.soybean.quick.dto.LoginRequest;
import com.soybean.quick.dto.LoginResponse;
import com.soybean.quick.dto.RegisterRequest;
import com.soybean.quick.dto.UserResponse;
import com.soybean.quick.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Auth")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "quick.auth", name = "enabled", havingValue = "true")
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "Register")
    @PostMapping("/register")
    public Result<UserResponse> register(@Valid @RequestBody RegisterRequest req) {
        return Result.success(authService.register(req));
    }

    @Operation(summary = "Login")
    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        return Result.success(authService.login(req));
    }
}

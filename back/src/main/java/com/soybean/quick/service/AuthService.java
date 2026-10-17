package com.soybean.quick.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.soybean.quick.common.ResultCode;
import com.soybean.quick.dto.LoginRequest;
import com.soybean.quick.dto.LoginResponse;
import com.soybean.quick.dto.RegisterRequest;
import com.soybean.quick.dto.UserResponse;
import com.soybean.quick.entity.User;
import com.soybean.quick.exception.BusinessException;
import com.soybean.quick.mapper.UserMapper;
import com.soybean.quick.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Transactional
    public UserResponse register(RegisterRequest req) {
        long existing = userMapper.selectCount(
                Wrappers.<User>lambdaQuery().eq(User::getUsername, req.getUsername()));
        if (existing > 0) {
            throw new BusinessException("username already exists");
        }
        User u = User.builder()
                .username(req.getUsername())
                .password(passwordEncoder.encode(req.getPassword()))
                .nickname(req.getNickname())
                .role("USER")
                .enabled(true)
                .build();
        userMapper.insert(u);
        return UserResponse.from(u);
    }

    public LoginResponse login(LoginRequest req) {
        User u = userMapper.selectOne(
                Wrappers.<User>lambdaQuery().eq(User::getUsername, req.getUsername()));
        if (u == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED.getCode(), "invalid credentials");
        }
        if (!passwordEncoder.matches(req.getPassword(), u.getPassword())) {
            throw new BusinessException(ResultCode.UNAUTHORIZED.getCode(), "invalid credentials");
        }
        if (!Boolean.TRUE.equals(u.getEnabled())) {
            throw new BusinessException(ResultCode.FORBIDDEN.getCode(), "user disabled");
        }
        String token = jwtUtil.generate(u.getUsername(), u.getRole());
        return new LoginResponse(token, UserResponse.from(u));
    }
}

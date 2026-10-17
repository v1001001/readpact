package com.soybean.quick.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.soybean.quick.common.PageResult;
import com.soybean.quick.dto.UserResponse;
import com.soybean.quick.entity.User;
import com.soybean.quick.exception.BusinessException;
import com.soybean.quick.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;

    public UserResponse getCurrent(String username) {
        User u = userMapper.selectOne(Wrappers.<User>lambdaQuery().eq(User::getUsername, username));
        if (u == null) {
            throw new BusinessException("user not found");
        }
        return UserResponse.from(u);
    }

    public PageResult<UserResponse> page(int page, int size) {
        Page<User> p = userMapper.selectPage(Page.of(page + 1L, size), Wrappers.emptyWrapper());
        return new PageResult<>(
                p.getRecords().stream().map(UserResponse::from).toList(),
                p.getTotal(),
                page,
                size
        );
    }
}

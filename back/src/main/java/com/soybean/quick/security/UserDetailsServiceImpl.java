package com.soybean.quick.security;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.soybean.quick.entity.User;
import com.soybean.quick.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserMapper userMapper;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User u = userMapper.selectOne(Wrappers.<User>lambdaQuery().eq(User::getUsername, username));
        if (u == null) {
            throw new UsernameNotFoundException("user not found: " + username);
        }
        String role = u.getRole() == null ? "USER" : u.getRole();
        boolean enabled = Boolean.TRUE.equals(u.getEnabled());
        return new org.springframework.security.core.userdetails.User(
                u.getUsername(),
                u.getPassword(),
                enabled,
                true, true, true,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
        );
    }
}

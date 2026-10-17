package com.soybean.quick.dto;

import com.soybean.quick.entity.User;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private Long id;
    private String username;
    private String nickname;
    private String role;

    public static UserResponse from(User u) {
        return new UserResponse(u.getId(), u.getUsername(), u.getNickname(), u.getRole());
    }
}
